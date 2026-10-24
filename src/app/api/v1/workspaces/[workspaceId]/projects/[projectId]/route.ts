import { z } from "zod";
import { jsonSuccess, jsonError, formatInternalErrorMessage } from "@/lib/api/http";
import { prisma } from "@/lib/db";
import { requireWorkspaceMember, AuthError } from "@/lib/permissions/workspace";

const updateProjectSchema = z.object({
  name: z.string().trim().min(2, "Project name must be at least 2 characters long.").optional(),
  description: z.string().trim().nullable().optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
});

type Context = {
  params: Promise<{ workspaceId: string; projectId: string }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    const { workspaceId, projectId } = await context.params;
    await requireWorkspaceMember(workspaceId);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
    });

    if (!project || project.workspaceId !== workspaceId) {
      return jsonError("NOT_FOUND", "Project not found in this workspace.");
    }

    return jsonSuccess(project);
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message);
    }
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to fetch project.")
    );
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { workspaceId, projectId } = await context.params;
    const { user } = await requireWorkspaceMember(workspaceId, ["OWNER", "ADMIN"]);

    const body = await request.json();
    const parsed = updateProjectSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("BAD_REQUEST", parsed.error.issues[0]?.message || "Invalid input.");
    }

    const existingProject = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!existingProject || existingProject.workspaceId !== workspaceId) {
      return jsonError("NOT_FOUND", "Project not found in this workspace.");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const proj = await tx.project.update({
        where: { id: projectId },
        data: parsed.data,
      });

      if (parsed.data.status && parsed.data.status !== existingProject.status) {
        await tx.activityLog.create({
          data: {
            workspaceId,
            projectId,
            userId: user.id,
            action: parsed.data.status === "ARCHIVED" ? "PROJECT_ARCHIVED" : "PROJECT_RESTORED",
            details: JSON.stringify({ previousStatus: existingProject.status }),
          },
        });
      }

      return proj;
    });

    return jsonSuccess(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message);
    }
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to update project.")
    );
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { workspaceId, projectId } = await context.params;
    await requireWorkspaceMember(workspaceId, ["OWNER", "ADMIN"]);

    const existingProject = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!existingProject || existingProject.workspaceId !== workspaceId) {
      return jsonError("NOT_FOUND", "Project not found in this workspace.");
    }

    await prisma.project.delete({
      where: { id: projectId },
    });

    return jsonSuccess({ message: "Project deleted successfully." });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message);
    }
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to delete project.")
    );
  }
}
