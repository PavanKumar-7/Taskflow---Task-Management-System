import { jsonSuccess, jsonError, formatInternalErrorMessage } from "@/lib/api/http";
import { prisma } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/permissions/workspace";
import { hashInvitationToken, isInvitationExpired } from "@/lib/invitations/crypto";
import { createNotification } from "@/lib/notifications/service";

type Context = {
  params: Promise<{ token: string }>;
};

export async function POST(_request: Request, context: Context) {
  try {
    const user = await requireAuth();
    const { token } = await context.params;

    if (!token || typeof token !== "string") {
      return jsonError("BAD_REQUEST", "Missing invitation token.");
    }

    const tokenHash = hashInvitationToken(token);

    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { tokenHash },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!invitation) {
      return jsonError("NOT_FOUND", "Invalid invitation link.");
    }

    // 1. Check status
    if (invitation.status === "REVOKED") {
      return jsonError("BAD_REQUEST", "This invitation has been revoked.");
    }

    if (invitation.status === "ACCEPTED") {
      return jsonError("BAD_REQUEST", "This invitation has already been accepted.");
    }

    // 2. Check expiration
    if (isInvitationExpired(invitation.expiresAt)) {
      await prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
      return jsonError("BAD_REQUEST", "This invitation has expired.");
    }

    // 3. Email matching check
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return jsonError(
        "FORBIDDEN",
        `This invitation was sent to ${invitation.email}. You are currently logged in as ${user.email}. Please switch accounts to accept.`
      );
    }

    // 4. Transactional acceptance and membership creation
    const result = await prisma.$transaction(async (tx) => {
      // Check if already a member to prevent duplicate membership
      const existingMember = await tx.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: invitation.workspaceId,
            userId: user.id,
          },
        },
      });

      if (!existingMember) {
        await tx.workspaceMember.create({
          data: {
            workspaceId: invitation.workspaceId,
            userId: user.id,
            role: invitation.role,
          },
        });
      }

      // Mark invitation accepted atomically to guarantee concurrency safety
      const updateResult = await tx.workspaceInvitation.updateMany({
        where: { id: invitation.id, status: "PENDING" },
        data: { status: "ACCEPTED" },
      });

      if (updateResult.count === 0) {
        throw new Error("This invitation has already been accepted.");
      }

      // Log activity
      await tx.activityLog.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId: user.id,
          action: "MEMBER_JOINED",
          details: JSON.stringify({
            invitationId: invitation.id,
            role: invitation.role,
          }),
        },
      });

      return {
        workspaceId: invitation.workspaceId,
        workspaceName: invitation.workspace.name,
      };
    });

    // 5. Notify the inviter
    if (invitation.invitedById !== user.id) {
      await createNotification({
        userId: invitation.invitedById,
        workspaceId: invitation.workspaceId,
        type: "WORKSPACE_INVITATION",
        title: "Invitation Accepted",
        message: `${user.name} accepted your invitation to join "${invitation.workspace.name}"`,
        link: `/workspaces`,
      });
    }

    return jsonSuccess({
      message: `You have successfully joined "${result.workspaceName}"!`,
      workspaceId: result.workspaceId,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message);
    }
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to accept invitation.")
    );
  }
}
