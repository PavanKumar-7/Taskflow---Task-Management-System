import { z } from "zod";
import { jsonSuccess, jsonError, formatInternalErrorMessage } from "@/lib/api/http";
import { prisma } from "@/lib/db";
import { requireWorkspaceMember, AuthError } from "@/lib/permissions/workspace";
import { calculateTaskPriority } from "@/lib/prioritization/engine";
import { createNotification } from "@/lib/notifications/service";
import type { TaskPriority, TaskStatus } from "@/types";

const createTaskSchema = z.object({
  projectId: z.string().min(1, "Project is required."),
  title: z.string().trim().min(1, "Task title is required."),
  description: z.string().trim().nullable().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]).default("TODO"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueDate: z.string().nullable().optional(),
  estimatedHours: z.number().positive().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
});

type Context = {
  params: Promise<{ workspaceId: string }>;
};

export async function GET(request: Request, context: Context) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status") as TaskStatus | null;
    const priority = searchParams.get("priority") as TaskPriority | null;
    const assigneeId = searchParams.get("assigneeId");
    const search = searchParams.get("search");
    const sortBy = searchParams.get("sortBy") || "position";
    const sortOrder = (searchParams.get("sortOrder") || "asc").toLowerCase() === "desc" ? "desc" : "asc";
    const rawLimit = searchParams.get("limit");
    const limit = rawLimit ? Math.min(100, Math.max(1, parseInt(rawLimit, 10))) : undefined;

    const where: Record<string, unknown> = {
      workspaceId,
    };

    if (projectId) {
      where.projectId = projectId;
    }

    if (status && ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"].includes(status)) {
      where.status = status;
    }

    if (priority && ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority)) {
      where.priority = priority;
    }

    if (assigneeId) {
      where.assigneeId = assigneeId === "unassigned" ? null : assigneeId;
    }

    if (search && search.trim().length > 0) {
      where.OR = [
        { title: { contains: search.trim(), mode: "insensitive" } },
        { description: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    // Default db order if not sorting by dynamic priorityScore
    const orderBy: Record<string, string>[] = [];
    if (sortBy === "dueDate") {
      orderBy.push({ dueDate: sortOrder });
    } else if (sortBy === "createdAt") {
      orderBy.push({ createdAt: sortOrder });
    } else {
      orderBy.push({ position: "asc" });
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        project: {
          select: { id: true, name: true },
        },
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { comments: true },
        },
      },
      orderBy,
      take: limit,
    });

    const enrichedTasks = tasks.map((task) => {
      const priorityInfo = calculateTaskPriority({
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        estimatedHours: task.estimatedHours,
        createdAt: task.createdAt,
      });

      return {
        ...task,
        dueDate: task.dueDate ? task.dueDate.toISOString() : null,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        priorityScore: priorityInfo.score,
        priorityReason: priorityInfo.reasons,
      };
    });

    // If sorting by dynamic priority score
    if (sortBy === "priorityScore") {
      enrichedTasks.sort((a, b) => {
        return sortOrder === "desc"
          ? b.priorityScore - a.priorityScore
          : a.priorityScore - b.priorityScore;
      });
    }

    return jsonSuccess(enrichedTasks);
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message);
    }
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to fetch tasks.")
    );
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { workspaceId } = await context.params;
    const { user } = await requireWorkspaceMember(workspaceId);

    const body = await request.json();
    const parsed = createTaskSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("BAD_REQUEST", parsed.error.issues[0]?.message || "Invalid task data.");
    }

    const { projectId, title, description, status, priority, dueDate, estimatedHours, assigneeId } = parsed.data;

    // Verify project belongs to this workspace
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project || project.workspaceId !== workspaceId) {
      return jsonError("BAD_REQUEST", "Selected project does not belong to this workspace.");
    }

    // Verify assignee belongs to this workspace if provided
    if (assigneeId) {
      const member = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: assigneeId,
          },
        },
      });

      if (!member) {
        return jsonError("BAD_REQUEST", "Assignee must be a member of this workspace.");
      }
    }

    // Get highest position in column for clean append
    const highestInColumn = await prisma.task.findFirst({
      where: { workspaceId, status },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const position = highestInColumn ? highestInColumn.position + 1000 : 1000;

    const task = await prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          workspaceId,
          projectId,
          title,
          description: description || null,
          status,
          priority,
          position,
          dueDate: dueDate ? new Date(dueDate) : null,
          estimatedHours: estimatedHours || null,
          assigneeId: assigneeId || null,
          creatorId: user.id,
        },
        include: {
          project: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
          creator: { select: { id: true, name: true, email: true } },
          _count: { select: { comments: true } },
        },
      });

      await tx.activityLog.create({
        data: {
          workspaceId,
          projectId,
          taskId: created.id,
          userId: user.id,
          action: "TASK_CREATED",
          details: JSON.stringify({
            title,
            status,
            priority,
          }),
        },
      });

      return created;
    });

    // Notify assignee if assigned to someone else
    if (task.assigneeId && task.assigneeId !== user.id) {
      await createNotification({
        userId: task.assigneeId,
        workspaceId,
        type: "TASK_ASSIGNED",
        title: "Task Assigned",
        message: `${user.name} assigned you to "${task.title}"`,
        link: `/projects/${projectId}?taskId=${task.id}`,
      });
    }

    const priorityInfo = calculateTaskPriority({
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      estimatedHours: task.estimatedHours,
      createdAt: task.createdAt,
    });

    return jsonSuccess(
      {
        ...task,
        dueDate: task.dueDate ? task.dueDate.toISOString() : null,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        priorityScore: priorityInfo.score,
        priorityReason: priorityInfo.reasons,
      },
      201,
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message);
    }
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to create task.")
    );
  }
}
