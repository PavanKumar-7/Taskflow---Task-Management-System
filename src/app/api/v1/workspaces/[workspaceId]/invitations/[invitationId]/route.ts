import { jsonSuccess, jsonError, formatInternalErrorMessage } from "@/lib/api/http";
import { prisma } from "@/lib/db";
import { requireWorkspaceMember, AuthError } from "@/lib/permissions/workspace";

type Context = {
  params: Promise<{ workspaceId: string; invitationId: string }>;
};

export async function DELETE(_request: Request, context: Context) {
  try {
    const { workspaceId, invitationId } = await context.params;
    const { user } = await requireWorkspaceMember(workspaceId, ["OWNER", "ADMIN"]);

    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation || invitation.workspaceId !== workspaceId) {
      return jsonError("NOT_FOUND", "Invitation not found in this workspace.");
    }

    if (invitation.status === "ACCEPTED") {
      return jsonError("BAD_REQUEST", "Cannot revoke an invitation that has already been accepted.");
    }

    if (invitation.status === "REVOKED") {
      return jsonError("BAD_REQUEST", "Invitation is already revoked.");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const revoked = await tx.workspaceInvitation.update({
        where: { id: invitationId },
        data: { status: "REVOKED" },
        select: {
          id: true,
          email: true,
          status: true,
        },
      });

      await tx.activityLog.create({
        data: {
          workspaceId,
          userId: user.id,
          action: "INVITATION_REVOKED",
          details: JSON.stringify({
            invitationId,
            recipientEmail: invitation.email,
          }),
        },
      });

      return revoked;
    });

    return jsonSuccess({ message: "Invitation revoked successfully.", invitation: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message);
    }
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to revoke invitation.")
    );
  }
}
