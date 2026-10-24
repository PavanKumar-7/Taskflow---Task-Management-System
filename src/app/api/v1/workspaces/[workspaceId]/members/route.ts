import { z } from "zod";
import { jsonSuccess, jsonError, formatInternalErrorMessage } from "@/lib/api/http";
import { prisma } from "@/lib/db";
import { requireWorkspaceMember, AuthError } from "@/lib/permissions/workspace";

const addMemberSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address."),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

type Context = {
  params: Promise<{ workspaceId: string }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
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
      orderBy: { joinedAt: "asc" },
    });

    return jsonSuccess(members);
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message);
    }
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to fetch members.")
    );
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { workspaceId } = await context.params;
    const { user: currentUser, member: currentMember } = await requireWorkspaceMember(workspaceId, [
      "OWNER",
      "ADMIN",
    ]);

    const body = await request.json();
    const parsed = addMemberSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("BAD_REQUEST", parsed.error.issues[0]?.message || "Invalid member data.");
    }

    const { email, role } = parsed.data;

    // Only OWNER can add members directly with the ADMIN role
    if (currentMember.role === "ADMIN" && role === "ADMIN") {
      return jsonError("FORBIDDEN", "Only workspace owners can add members with the admin role.");
    }

    // Find user by email
    const targetUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!targetUser) {
      return jsonError(
        "NOT_FOUND",
        "No registered user found with that email. Ask them to create an account first.",
      );
    }

    // Check if already member
    const existingMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: targetUser.id,
        },
      },
    });

    if (existingMember) {
      return jsonError("CONFLICT", "User is already a member of this workspace.");
    }

    const newMember = await prisma.$transaction(async (tx) => {
      const member = await tx.workspaceMember.create({
        data: {
          workspaceId,
          userId: targetUser.id,
          role,
        },
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
          action: "MEMBER_ADDED",
          details: JSON.stringify({
            addedUserId: targetUser.id,
            addedUserEmail: targetUser.email,
            role,
          }),
        },
      });

      return member;
    });

    return jsonSuccess(newMember, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message);
    }
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to add member.")
    );
  }
}
