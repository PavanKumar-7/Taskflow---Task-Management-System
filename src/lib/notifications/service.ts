import { prisma } from "@/lib/db";
import type { NotificationType } from "@/types";

export type CreateNotificationParams = {
  userId: string;
  workspaceId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
};

/**
 * Validates and sanitizes notification links to prevent open redirects and script injection.
 * Only allows relative application routes (e.g., /workspaces, /projects/123).
 */
export function sanitizeNotificationLink(link?: string | null): string | null {
  if (!link) return null;
  const trimmed = link.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes(":") || trimmed.includes("\\")) {
    return null;
  }
  return trimmed;
}

/**
 * Creates an in-app notification for a designated user.
 * Avoids duplicate notifications if an identical unread notification already exists.
 */
export async function createNotification({
  userId,
  workspaceId,
  type,
  title,
  message,
  link,
}: CreateNotificationParams) {
  if (!userId) return null;

  const safeLink = sanitizeNotificationLink(link);

  // Prevent duplicate unread notifications for the same event/link
  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      type,
      title,
      read: false,
      link: safeLink,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.notification.create({
    data: {
      userId,
      workspaceId: workspaceId || null,
      type,
      title,
      message,
      link: safeLink,
    },
  });
}

/**
 * Fetch notifications for a specific user with pagination.
 */
export async function getNotificationsForUser(
  userId: string,
  options?: { limit?: number; unreadOnly?: boolean }
) {
  const limit = Math.min(100, Math.max(1, options?.limit || 20));
  const where: { userId: string; read?: boolean } = { userId };

  if (options?.unreadOnly) {
    where.read = false;
  }

  return prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

/**
 * Get unread notification count for a user.
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      userId,
      read: false,
    },
  });
}

/**
 * Mark a single notification as read, strictly enforcing recipient ownership.
 */
export async function markNotificationAsRead(notificationId: string, userId: string) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification || notification.userId !== userId) {
    return null;
  }

  if (notification.read) {
    return notification;
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });
}

/**
 * Mark all notifications for a user as read.
 */
export async function markAllNotificationsAsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      read: false,
    },
    data: { read: true },
  });

  return result.count;
}
