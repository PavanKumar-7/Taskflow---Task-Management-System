import { z } from "zod";
import { jsonSuccess, jsonError, formatInternalErrorMessage } from "@/lib/api/http";
import { prisma } from "@/lib/db";
import { requireWorkspaceMember, AuthError } from "@/lib/permissions/workspace";

const updateMemberSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"]),
});

type Context = {
  params: Promise<{ workspaceId: string; memberId: string }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    const { workspaceId, memberId } = await context.params;
    const { user: currentUser, member: currentMember } = await requireWorkspaceMember(
      workspaceId,
      ["OWNER", "ADMIN"],
    );

    const body = await request.json();
    const parsed = updateMemberSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("BAD_REQUEST", parsed.error.issues[0]?.message || "Invalid role.");
    }

    const targetMember = await prisma.workspaceMember.findUnique({
      where: { id: memberId },
    });

    if (!targetMember || targetMember.workspaceId !== workspaceId) {
      return jsonError("NOT_FOUND", "Member not found in this workspace.");
    }

    if (targetMember.role === "OWNER") {
      return jsonError("FORBIDDEN", "Cannot modify the workspace owner's role.");
    }

    if (currentMember.role === "ADMIN" && targetMember.role === "ADMIN") {
      return jsonError("FORBIDDEN", "Admins cannot modify another admin's role.");
    }

    if (currentMember.role === "ADMIN" && parsed.data.role === "ADMIN") {
      return jsonError("FORBIDDEN", "Only workspace owners can promote members to admin.");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const member = await tx.workspaceMember.update({
        where: { id: memberId },
        data: { role: parsed.data.role },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      });

      await tx.activityLog.create({
        data: {
          workspaceId,
          userId: currentUser.id,
          action: "MEMBER_ROLE_CHANGED",
          details: JSON.stringify({
            targetUserId: targetMember.userId,
            from: targetMember.role,
            to: parsed.data.role,
          }),
        },
      });

      return member;
    });

    return jsonSuccess(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message);
    }
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to update member.")
    );
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { workspaceId, memberId } = await context.params;
    const { user: currentUser, member: currentMember } = await requireWorkspaceMember(workspaceId);

    const targetMember = await prisma.workspaceMember.findUnique({
      where: { id: memberId },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!targetMember || targetMember.workspaceId !== workspaceId) {
      return jsonError("NOT_FOUND", "Member not found in this workspace.");
    }

    // Workspace owner cannot be removed under any circumstance (prevents ownerless workspaces)
    if (targetMember.role === "OWNER") {
      return jsonError("FORBIDDEN", "The workspace owner cannot be removed.");
    }

    const isSelfRemoval = targetMember.userId === currentUser.id;

    if (!isSelfRemoval) {
      // Regular members cannot remove other members
      if (currentMember.role === "MEMBER") {
        return jsonError("FORBIDDEN", "Action requires one of the following roles: OWNER, ADMIN.");
      }
      // Admins cannot remove other admins
      if (currentMember.role === "ADMIN" && targetMember.role === "ADMIN") {
        return jsonError("FORBIDDEN", "Admins cannot remove other admins.");
      }
    }

    await prisma.$transaction(async (tx) => {
      // Unassign any tasks assigned to this user in this workspace
      await tx.task.updateMany({
        where: { workspaceId, assigneeId: targetMember.userId },
        data: { assigneeId: null },
      });

      await tx.workspaceMember.delete({
        where: { id: memberId },
      });

      await tx.activityLog.create({
        data: {
          workspaceId,
          userId: currentUser.id,
          action: isSelfRemoval ? "MEMBER_LEFT" : "MEMBER_REMOVED",
          details: JSON.stringify({
            removedUserId: targetMember.userId,
            removedUserEmail: targetMember.user?.email,
            role: targetMember.role,
            isSelfRemoval,
          }),
        },
      });
    });

    return jsonSuccess({
      message: isSelfRemoval ? "You have left the workspace." : "Member removed successfully.",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message);
    }
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to remove member.")
    );
  }
}
