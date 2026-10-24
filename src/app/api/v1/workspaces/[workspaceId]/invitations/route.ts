import { z } from "zod";
import { jsonSuccess, jsonError, formatInternalErrorMessage } from "@/lib/api/http";
import { prisma } from "@/lib/db";
import { requireWorkspaceMember, AuthError } from "@/lib/permissions/workspace";
import {
  generateInvitationToken,
  getInvitationExpiryDate,
  isInvitationExpired,
} from "@/lib/invitations/crypto";
import { sendWorkspaceInvitationEmail } from "@/lib/email/service";
import { createNotification } from "@/lib/notifications/service";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

const createInvitationSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address."),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

type Context = {
  params: Promise<{ workspaceId: string }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId, ["OWNER", "ADMIN"]);

    const invitations = await prisma.workspaceInvitation.findMany({
      where: { workspaceId },
      select: {
        id: true,
        workspaceId: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Check and lazily update any expired pending invitations
    const now = new Date();
    const updatedInvitations = invitations.map((inv) => {
      if (inv.status === "PENDING" && new Date(inv.expiresAt) <= now) {
        return { ...inv, status: "EXPIRED" as const };
      }
      return inv;
    });

    return jsonSuccess(updatedInvitations);
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message);
    }
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to fetch invitations.")
    );
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { workspaceId } = await context.params;
    const { user, member } = await requireWorkspaceMember(workspaceId, ["OWNER", "ADMIN"]);

    // Enforce rate limiting: 20 invitations per minute per workspace & user
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`invite:${workspaceId}:${user.id}:${clientIp}`, {
      windowMs: 60 * 1000,
      max: 20,
    });

    if (!rateLimit.success) {
      const retryAfterSeconds = Math.ceil(rateLimit.resetMs / 1000);
      return jsonError(
        "TOO_MANY_REQUESTS",
        "Too many invitation requests. Please slow down.",
        {
          headers: {
            "Retry-After": retryAfterSeconds.toString(),
          },
        }
      );
    }

    const body = await request.json();
    const parsed = createInvitationSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("BAD_REQUEST", parsed.error.issues[0]?.message || "Invalid invitation data.");
    }

    const { email, role } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    // 1. Role elevation check: only OWNER can invite users as ADMIN
    if (member.role === "ADMIN" && role === "ADMIN") {
      return jsonError("FORBIDDEN", "Only workspace owners can grant the admin role.");
    }

    // 2. Check if user is already a member of this workspace
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, name: true },
    });

    if (existingUser) {
      const existingMember = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: existingUser.id,
          },
        },
      });

      if (existingMember) {
        return jsonError("CONFLICT", "User is already a member of this workspace.");
      }
    }

    // 3. Check for existing active pending invitation for this workspace and email
    const existingInvitation = await prisma.workspaceInvitation.findFirst({
      where: {
        workspaceId,
        email: normalizedEmail,
        status: "PENDING",
      },
    });

    if (existingInvitation) {
      if (isInvitationExpired(existingInvitation.expiresAt)) {
        await prisma.workspaceInvitation.update({
          where: { id: existingInvitation.id },
          data: { status: "EXPIRED" },
        });
      } else {
        return jsonError(
          "CONFLICT",
          "A pending invitation has already been sent to this email address."
        );
      }
    }

    // 4. Get workspace details
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true },
    });

    if (!workspace) {
      return jsonError("NOT_FOUND", "Workspace not found.");
    }

    // 5. Generate secure token & SHA-256 hash
    const { rawToken, tokenHash } = generateInvitationToken();
    const expiresAt = getInvitationExpiryDate(7);

    // 6. Save invitation record (storing only tokenHash)
    const invitation = await prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        email: normalizedEmail,
        role,
        tokenHash,
        invitedById: user.id,
        expiresAt,
        status: "PENDING",
      },
      select: {
        id: true,
        workspaceId: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    // 7. Dispatch invitation email via configured email provider
    const emailResult = await sendWorkspaceInvitationEmail({
      to: normalizedEmail,
      inviterName: user.name,
      workspaceName: workspace.name,
      role,
      rawToken,
    });

    // 8. If the invited user already has an account, send in-app notification
    if (existingUser) {
      await createNotification({
        userId: existingUser.id,
        workspaceId,
        type: "WORKSPACE_INVITATION",
        title: "Workspace Invitation",
        message: `${user.name} invited you to join "${workspace.name}" as ${role === "ADMIN" ? "Admin" : "Member"}`,
        link: `/invite/${rawToken}`,
      });
    }

    // 9. Log activity
    await prisma.activityLog.create({
      data: {
        workspaceId,
        userId: user.id,
        action: "INVITATION_SENT",
        details: JSON.stringify({
          recipientEmail: normalizedEmail,
          role,
          outcome: emailResult.outcome,
          provider: emailResult.provider,
          emailAccepted: emailResult.sent,
        }),
      },
    });

    return jsonSuccess(
      {
        invitation,
        outcome: emailResult.outcome,
        provider: emailResult.provider,
        emailDelivered: emailResult.sent,
        emailAccepted: emailResult.sent,
        emailReason: emailResult.reason,
        emailError: emailResult.sent ? undefined : emailResult.error,
        // Safe local development preview only in dev/test, never in production
        devInviteUrl: emailResult.devInviteUrl,
        devEmailPreview: emailResult.devEmailPreview,
      },
      201
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message);
    }
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to create invitation.")
    );
  }
}
