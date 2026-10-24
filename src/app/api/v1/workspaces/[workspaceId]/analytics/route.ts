import { jsonSuccess, jsonError, formatInternalErrorMessage } from "@/lib/api/http";
import { prisma } from "@/lib/db";
import { requireWorkspaceMember, AuthError } from "@/lib/permissions/workspace";
import { calculateWorkspaceAnalytics } from "@/lib/analytics/calculator";

type Context = {
  params: Promise<{ workspaceId: string }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);

    // Fetch aggregated data efficiently
    const [tasks, projects, memberCount] = await Promise.all([
      prisma.task.findMany({
        where: { workspaceId },
        include: {
          project: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      }),
      prisma.project.findMany({
        where: { workspaceId },
        select: {
          id: true,
          name: true,
          status: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.workspaceMember.count({
        where: { workspaceId },
      }),
    ]);

    const result = calculateWorkspaceAnalytics({
      projects,
      tasks,
      memberCount,
    });

    return jsonSuccess(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message);
    }
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to compute analytics.")
    );
  }
}
