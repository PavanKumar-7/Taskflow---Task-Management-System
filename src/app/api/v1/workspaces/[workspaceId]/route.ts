import { z } from "zod";
import { jsonSuccess, jsonError, formatInternalErrorMessage } from "@/lib/api/http";
import { prisma } from "@/lib/db";
import { requireWorkspaceMember, AuthError } from "@/lib/permissions/workspace";

const updateSchema = z.object({
  name: z.string().trim().min(2, "Workspace name must be at least 2 characters long."),
});

type Context = {
  params: Promise<{ workspaceId: string }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    const { workspaceId } = await context.params;
    const { member } = await requireWorkspaceMember(workspaceId);

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
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
        },
        _count: {
          select: {
            projects: true,
            tasks: true,
          },
        },
      },
    });

    if (!workspace) {
      return jsonError("NOT_FOUND", "Workspace not found.");
    }

    return jsonSuccess({
      ...workspace,
      currentUserRole: member.role,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message);
    }
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to fetch workspace.")
    );
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId, ["OWNER", "ADMIN"]);

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("BAD_REQUEST", parsed.error.issues[0]?.message || "Invalid input.");
    }

    const updated = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: parsed.data.name },
    });

    return jsonSuccess(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message);
    }
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to update workspace.")
    );
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId, ["OWNER"]);

    await prisma.workspace.delete({
      where: { id: workspaceId },
    });

    return jsonSuccess({ message: "Workspace deleted successfully." });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message);
    }
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to delete workspace.")
    );
  }
}
