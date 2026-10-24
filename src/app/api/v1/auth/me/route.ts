import { jsonSuccess, jsonError, formatInternalErrorMessage } from "@/lib/api/http";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return jsonError("UNAUTHENTICATED", "No active session.");
    }

    const userWithWorkspaces = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      include: {
        memberships: {
          include: {
            workspace: true,
          },
        },
      },
    });

    if (!userWithWorkspaces) {
      return jsonError("UNAUTHENTICATED", "User not found.");
    }

    const workspaces = userWithWorkspaces.memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      ownerId: m.workspace.ownerId,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    }));

    return jsonSuccess({
      user: {
        id: userWithWorkspaces.id,
        email: userWithWorkspaces.email,
        name: userWithWorkspaces.name,
        avatarUrl: userWithWorkspaces.avatarUrl,
      },
      workspaces,
    });
  } catch (error) {
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to retrieve user profile.")
    );
  }
}
