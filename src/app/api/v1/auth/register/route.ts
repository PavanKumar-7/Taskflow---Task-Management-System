import { z } from "zod";
import { jsonSuccess, jsonError, formatInternalErrorMessage } from "@/lib/api/http";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { hashInvitationToken, isInvitationExpired } from "@/lib/invitations/crypto";
import { createNotification } from "@/lib/notifications/service";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

const registerSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters long."),
  name: z.string().trim().min(2, "Name must be at least 2 characters long."),
  workspaceName: z.string().trim().min(2).optional(),
  inviteToken: z.string().trim().optional(),
});

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const rand = Math.random().toString(36).substring(2, 7);
  return `${base || "workspace"}-${rand}`;
}

export async function POST(request: Request) {
  try {
    // Enforce rate limiting: 10 registrations per minute per IP
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`register:${clientIp}`, {
      windowMs: 60 * 1000,
      max: 10,
    });

    if (!rateLimit.success) {
      const retryAfterSeconds = Math.ceil(rateLimit.resetMs / 1000);
      return jsonError(
        "TOO_MANY_REQUESTS",
        "Too many registration requests. Please try again later.",
        {
          headers: {
            "Retry-After": retryAfterSeconds.toString(),
          },
        }
      );
    }

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("BAD_REQUEST", parsed.error.issues[0]?.message || "Invalid input.");
    }

    const { email, password, name, workspaceName, inviteToken } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return jsonError("CONFLICT", "An account with this email already exists.");
    }

    // If an invitation token is provided, validate it first
    let verifiedInvitation: {
      id: string;
      workspaceId: string;
      email: string;
      role: "OWNER" | "ADMIN" | "MEMBER";
      invitedById: string;
      workspaceName: string;
    } | null = null;

    if (inviteToken) {
      const tokenHash = hashInvitationToken(inviteToken);
      const invitation = await prisma.workspaceInvitation.findUnique({
        where: { tokenHash },
        include: {
          workspace: {
            select: { name: true },
          },
        },
      });

      if (!invitation) {
        return jsonError("NOT_FOUND", "Invalid invitation token.");
      }

      if (invitation.status === "REVOKED") {
        return jsonError("BAD_REQUEST", "This invitation has been revoked.");
      }

      if (invitation.status === "ACCEPTED") {
        return jsonError("BAD_REQUEST", "This invitation has already been accepted.");
      }

      if (isInvitationExpired(invitation.expiresAt)) {
        await prisma.workspaceInvitation.update({
          where: { id: invitation.id },
          data: { status: "EXPIRED" },
        });
        return jsonError("BAD_REQUEST", "This invitation has expired.");
      }

      if (invitation.email.toLowerCase() !== normalizedEmail) {
        return jsonError(
          "FORBIDDEN",
          `Registration email (${normalizedEmail}) does not match the invited email (${invitation.email}).`
        );
      }

      verifiedInvitation = {
        id: invitation.id,
        workspaceId: invitation.workspaceId,
        email: invitation.email,
        role: invitation.role,
        invitedById: invitation.invitedById,
        workspaceName: invitation.workspace.name,
      };
    }

    const passwordHash = await hashPassword(password);

    // Atomically create User and assign/create Workspace
    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          name,
        },
      });

      let activeWorkspace: {
        id: string;
        name: string;
        slug: string;
        role: "OWNER" | "ADMIN" | "MEMBER";
      };

      if (verifiedInvitation) {
        // User joined via invitation: add to existing invited workspace
        await tx.workspaceMember.create({
          data: {
            workspaceId: verifiedInvitation.workspaceId,
            userId: newUser.id,
            role: verifiedInvitation.role,
          },
        });

        const updateResult = await tx.workspaceInvitation.updateMany({
          where: { id: verifiedInvitation.id, status: "PENDING" },
          data: { status: "ACCEPTED" },
        });

        if (updateResult.count === 0) {
          throw new Error("This invitation has already been accepted.");
        }

        await tx.activityLog.create({
          data: {
            workspaceId: verifiedInvitation.workspaceId,
            userId: newUser.id,
            action: "MEMBER_JOINED",
            details: JSON.stringify({
              invitationId: verifiedInvitation.id,
              role: verifiedInvitation.role,
            }),
          },
        });

        activeWorkspace = {
          id: verifiedInvitation.workspaceId,
          name: verifiedInvitation.workspaceName,
          slug: "",
          role: verifiedInvitation.role,
        };
      } else {
        // Standard registration: create default workspace for the user
        const resolvedWsName = workspaceName || `${name}'s Workspace`;
        const wsSlug = generateSlug(resolvedWsName);

        const newWorkspace = await tx.workspace.create({
          data: {
            name: resolvedWsName,
            slug: wsSlug,
            ownerId: newUser.id,
          },
        });

        await tx.workspaceMember.create({
          data: {
            workspaceId: newWorkspace.id,
            userId: newUser.id,
            role: "OWNER",
          },
        });

        const initialProject = await tx.project.create({
          data: {
            workspaceId: newWorkspace.id,
            name: "General",
            description: "Default project for organizing team tasks",
          },
        });

        await tx.activityLog.create({
          data: {
            workspaceId: newWorkspace.id,
            projectId: initialProject.id,
            userId: newUser.id,
            action: "WORKSPACE_CREATED",
            details: JSON.stringify({ name: resolvedWsName }),
          },
        });

        activeWorkspace = {
          id: newWorkspace.id,
          name: newWorkspace.name,
          slug: newWorkspace.slug,
          role: "OWNER",
        };
      }

      return {
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          avatarUrl: newUser.avatarUrl,
        },
        workspace: activeWorkspace,
      };
    });

    // Notify inviter if applicable
    if (verifiedInvitation && verifiedInvitation.invitedById !== result.user.id) {
      await createNotification({
        userId: verifiedInvitation.invitedById,
        workspaceId: verifiedInvitation.workspaceId,
        type: "WORKSPACE_INVITATION",
        title: "Invitation Accepted",
        message: `${result.user.name} accepted your invitation to join "${verifiedInvitation.workspaceName}"`,
        link: `/workspaces`,
      });
    }

    // Create session and set cookie
    const token = await createSessionToken({
      sub: result.user.id,
      email: result.user.email,
      name: result.user.name,
    });
    await setSessionCookie(token);

    return jsonSuccess(result, 201);
  } catch (error) {
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to register account.")
    );
  }
}
