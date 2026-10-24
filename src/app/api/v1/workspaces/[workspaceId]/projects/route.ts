import { z } from "zod";
import { jsonSuccess, jsonError, formatInternalErrorMessage } from "@/lib/api/http";
import { prisma } from "@/lib/db";
import { requireWorkspaceMember, AuthError } from "@/lib/permissions/workspace";

const createProjectSchema = z.object({
  name: z.string().trim().min(2, "Project name must be at least 2 characters long."),
  description: z.string().trim().optional(),
});

type Context = {
  params: Promise<{ workspaceId: string }>;
};

export async function GET(request: Request, context: Context) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");

    const where: { workspaceId: string; status?: "ACTIVE" | "ARCHIVED" } = {
      workspaceId,
    };

    if (statusParam === "ACTIVE" || statusParam === "ARCHIVED") {
      where.status = statusParam;
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        _count: {
          select: {
            tasks: true,
          },
        },
        tasks: {
          select: {
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = projects.map((p) => {
      const completedCount = p.tasks.filter((t) => t.status === "DONE").length;
      return {
        id: p.id,
        workspaceId: p.workspaceId,
        name: p.name,
        description: p.description,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        taskCount: p._count.tasks,
        completedCount,
      };
    });

    return jsonSuccess(formatted);
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message);
    }
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to fetch projects.")
    );
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { workspaceId } = await context.params;
    const { user } = await requireWorkspaceMember(workspaceId, ["OWNER", "ADMIN"]);

    const body = await request.json();
    const parsed = createProjectSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("BAD_REQUEST", parsed.error.issues[0]?.message || "Invalid input.");
    }

    const { name, description } = parsed.data;

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          workspaceId,
          name,
          description: description || null,
        },
      });

      await tx.activityLog.create({
        data: {
          workspaceId,
          projectId: created.id,
          userId: user.id,
          action: "PROJECT_CREATED",
          details: JSON.stringify({ name }),
        },
      });

      return created;
    });

    return jsonSuccess(
      {
        id: project.id,
        workspaceId: project.workspaceId,
        name: project.name,
        description: project.description,
        status: project.status,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        taskCount: 0,
        completedCount: 0,
      },
      201,
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message);
    }
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to create project.")
    );
  }
}
