import { z } from "zod";
import { jsonSuccess, jsonError, formatInternalErrorMessage } from "@/lib/api/http";
import { prisma } from "@/lib/db";
import { requireWorkspaceMember, AuthError } from "@/lib/permissions/workspace";
import { createNotification } from "@/lib/notifications/service";

const createCommentSchema = z.object({
  content: z.string().trim().min(1, "Comment content cannot be empty."),
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
      select: { workspaceId: true },
    });

    if (!task || task.workspaceId !== workspaceId) {
      return jsonError("NOT_FOUND", "Task not found in this workspace.");
    }

    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return jsonSuccess(comments);
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message);
    }
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to fetch comments.")
    );
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { workspaceId, taskId } = await context.params;
    const { user } = await requireWorkspaceMember(workspaceId);

    const body = await request.json();
    const parsed = createCommentSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("BAD_REQUEST", parsed.error.issues[0]?.message || "Invalid comment.");
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        workspaceId: true,
        projectId: true,
        title: true,
        assigneeId: true,
        creatorId: true,
      },
    });

    if (!task || task.workspaceId !== workspaceId) {
      return jsonError("NOT_FOUND", "Task not found in this workspace.");
    }

    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: {
          taskId,
          authorId: user.id,
          content: parsed.data.content,
        },
        include: {
          author: {
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
          projectId: task.projectId,
          taskId,
          userId: user.id,
          action: "COMMENT_ADDED",
          details: JSON.stringify({ snippet: parsed.data.content.slice(0, 80) }),
        },
      });

      return created;
    });

    // Notify task assignee and creator (excluding the comment author, deduplicated)
    const recipientIds = new Set<string>();
    if (task.assigneeId && task.assigneeId !== user.id) {
      recipientIds.add(task.assigneeId);
    }
    if (task.creatorId && task.creatorId !== user.id) {
      recipientIds.add(task.creatorId);
    }

    const snippet =
      parsed.data.content.length > 60
        ? `${parsed.data.content.slice(0, 60)}...`
        : parsed.data.content;

    for (const recipientId of recipientIds) {
      await createNotification({
        userId: recipientId,
        workspaceId,
        type: "TASK_COMMENT",
        title: "New Task Comment",
        message: `${user.name} commented on "${task.title}": "${snippet}"`,
        link: `/projects/${task.projectId}?taskId=${taskId}`,
      });
    }

    return jsonSuccess(comment, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message);
    }
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to post comment.")
    );
  }
}
