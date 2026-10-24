import { jsonSuccess, jsonError, formatInternalErrorMessage } from "@/lib/api/http";
import { prisma } from "@/lib/db";
import { hashInvitationToken, isInvitationExpired } from "@/lib/invitations/crypto";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

type Context = {
  params: Promise<{ token: string }>;
};

export async function GET(request: Request, context: Context) {
  try {
    // Enforce rate limiting on public token lookup: 60 requests per minute per IP
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`invite-lookup:${clientIp}`, {
      windowMs: 60 * 1000,
      max: 60,
    });

    if (!rateLimit.success) {
      const retryAfterSeconds = Math.ceil(rateLimit.resetMs / 1000);
      return jsonError(
        "TOO_MANY_REQUESTS",
        "Too many requests. Please try again later.",
        {
          headers: {
            "Retry-After": retryAfterSeconds.toString(),
          },
        }
      );
    }

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
            slug: true,
          },
        },
        invitedBy: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!invitation) {
      return jsonError("NOT_FOUND", "Invalid or expired invitation link.");
    }

    // Check expiration and lazily update
    let currentStatus = invitation.status;
    if (currentStatus === "PENDING" && isInvitationExpired(invitation.expiresAt)) {
      currentStatus = "EXPIRED";
      await prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
    }

    return jsonSuccess({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: currentStatus,
      expiresAt: invitation.expiresAt,
      workspace: invitation.workspace,
      inviterName: invitation.invitedBy?.name || "A workspace admin",
    });
  } catch (error) {
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to load invitation.")
    );
  }
}
