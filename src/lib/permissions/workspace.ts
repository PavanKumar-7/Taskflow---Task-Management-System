import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import type { WorkspaceRole, SessionUser } from "@/types";

export class AuthError extends Error {
  code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND";
  constructor(message: string, code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND") {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError("Authentication required.", "UNAUTHENTICATED");
  }
  return user;
}

export async function requireWorkspaceMember(
  workspaceId: string,
  allowedRoles?: WorkspaceRole[],
): Promise<{ user: SessionUser; member: { id: string; role: WorkspaceRole } }> {
  const user = await requireAuth();

  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: user.id,
      },
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (!member) {
    throw new AuthError("Access denied. You are not a member of this workspace.", "FORBIDDEN");
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(member.role)) {
      throw new AuthError(
        `Action requires one of the following roles: ${allowedRoles.join(", ")}.`,
        "FORBIDDEN",
      );
    }
  }

  return { user, member };
}

export * from "./roles";
