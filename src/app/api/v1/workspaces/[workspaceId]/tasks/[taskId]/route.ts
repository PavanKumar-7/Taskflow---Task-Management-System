import { z } from "zod";
import { jsonSuccess, jsonError, formatInternalErrorMessage } from "@/lib/api/http";
import { prisma } from "@/lib/db";
import { requireWorkspaceMember, AuthError } from "@/lib/permissions/workspace";
import { calculateTaskPriority } from "@/lib/prioritization/engine";
import { createNotification } from "@/lib/notifications/service";

const updateTaskSchema = z.object({
  title: z.string().trim().min(1, "Task title is required.").optional(),
  description: z.string().trim().nullable().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  position: z.number().optional(),
  dueDate: z.string().nullable().optional(),
  estimatedHours: z.number().positive().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  projectId: z.string().optional(),
});

type Context = {
  params: Promise<{ workspaceId: string; taskId: string }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    const { workspaceId, taskId } = await context.params;
    await requireWorkspaceMember(workspaceId);

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        creator: { select: { id: true, name: true, email: true } },
        comments: {
          include: {
            author: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        activityLogs: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 30,
        },
      },
    });

    if (!task || task.workspaceId !== workspaceId) {
      return jsonError("NOT_FOUND", "Task not found in this workspace.");
    }

    const priorityInfo = calculateTaskPriority({
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      estimatedHours: task.estimatedHours,
      createdAt: task.createdAt,
    });

    return jsonSuccess({
      ...task,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      priorityScore: priorityInfo.score,
      priorityReason: priorityInfo.reasons,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message);
    }
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to fetch task details.")
    );
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { workspaceId, taskId } = await context.params;
    const { user } = await requireWorkspaceMember(workspaceId);

    const body = await request.json();
    const parsed = updateTaskSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("BAD_REQUEST", parsed.error.issues[0]?.message || "Invalid update data.");
    }

    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: { select: { id: true, name: true } },
      },
    });

    if (!existingTask || existingTask.workspaceId !== workspaceId) {
      return jsonError("NOT_FOUND", "Task not found in this workspace.");
    }

    // If assigneeId is provided and not null, verify workspace membership
    if (parsed.data.assigneeId) {
      const member = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: parsed.data.assigneeId,
          },
        },
      });

      if (!member) {
        return jsonError("BAD_REQUEST", "Assignee must be a member of this workspace.");
      }
    }

    // If projectId is provided, verify it belongs to this workspace
    if (parsed.data.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: parsed.data.projectId },
      });

      if (!project || project.workspaceId !== workspaceId) {
        return jsonError("BAD_REQUEST", "Project does not belong to this workspace.");
      }
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
    if (parsed.data.priority !== undefined) updateData.priority = parsed.data.priority;
    if (parsed.data.position !== undefined) updateData.position = parsed.data.position;
    if (parsed.data.estimatedHours !== undefined) updateData.estimatedHours = parsed.data.estimatedHours;
    if (parsed.data.assigneeId !== undefined) updateData.assigneeId = parsed.data.assigneeId;
    if (parsed.data.projectId !== undefined) updateData.projectId = parsed.data.projectId;
    if (parsed.data.dueDate !== undefined) {
      updateData.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
    }

    const updatedTask = await prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id: taskId },
        data: updateData,
        include: {
          project: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
          creator: { select: { id: true, name: true, email: true } },
          _count: { select: { comments: true } },
        },
      });

      // Track activity logs for significant state transitions
      if (parsed.data.status && parsed.data.status !== existingTask.status) {
        await tx.activityLog.create({
          data: {
            workspaceId,
            projectId: updated.projectId,
            taskId,
            userId: user.id,
            action: "STATUS_CHANGED",
            details: JSON.stringify({
              from: existingTask.status,
              to: parsed.data.status,
            }),
          },
        });
      }

      if (parsed.data.priority && parsed.data.priority !== existingTask.priority) {
        await tx.activityLog.create({
          data: {
            workspaceId,
            projectId: updated.projectId,
            taskId,
            userId: user.id,
            action: "PRIORITY_CHANGED",
            details: JSON.stringify({
              from: existingTask.priority,
              to: parsed.data.priority,
            }),
          },
        });
      }

      if (parsed.data.assigneeId !== undefined && parsed.data.assigneeId !== existingTask.assigneeId) {
        await tx.activityLog.create({
          data: {
            workspaceId,
            projectId: updated.projectId,
            taskId,
            userId: user.id,
            action: "ASSIGNEE_CHANGED",
            details: JSON.stringify({
              from: existingTask.assignee?.name || "Unassigned",
              to: updated.assignee?.name || "Unassigned",
            }),
          },
        });
      }

      return updated;
    });

    // Notify new assignee if assignee changed and is not self
    if (
      parsed.data.assigneeId !== undefined &&
      parsed.data.assigneeId !== existingTask.assigneeId &&
      updatedTask.assigneeId &&
      updatedTask.assigneeId !== user.id
    ) {
      await createNotification({
        userId: updatedTask.assigneeId,
        workspaceId,
        type: "TASK_ASSIGNED",
        title: "Task Assigned",
        message: `${user.name} assigned you to "${updatedTask.title}"`,
        link: `/projects/${updatedTask.projectId}?taskId=${updatedTask.id}`,
      });
    }

    const priorityInfo = calculateTaskPriority({
      status: updatedTask.status,
      priority: updatedTask.priority,
      dueDate: updatedTask.dueDate,
      estimatedHours: updatedTask.estimatedHours,
      createdAt: updatedTask.createdAt,
    });

    return jsonSuccess({
      ...updatedTask,
      dueDate: updatedTask.dueDate ? updatedTask.dueDate.toISOString() : null,
      createdAt: updatedTask.createdAt.toISOString(),
      updatedAt: updatedTask.updatedAt.toISOString(),
      priorityScore: priorityInfo.score,
      priorityReason: priorityInfo.reasons,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message);
    }
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to update task.")
    );
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { workspaceId, taskId } = await context.params;
    const { user } = await requireWorkspaceMember(workspaceId);

    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!existingTask || existingTask.workspaceId !== workspaceId) {
      return jsonError("NOT_FOUND", "Task not found in this workspace.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.activityLog.create({
        data: {
          workspaceId,
          projectId: existingTask.projectId,
          userId: user.id,
          action: "TASK_DELETED",
          details: JSON.stringify({
            taskId: existingTask.id,
            title: existingTask.title,
            status: existingTask.status,
            priority: existingTask.priority,
          }),
        },
      });

      await tx.task.delete({
        where: { id: taskId },
      });
    });

    return jsonSuccess({ message: "Task deleted successfully." });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message);
    }
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to delete task.")
    );
  }
}
