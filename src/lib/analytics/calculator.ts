import { calculateTaskPriority } from "@/lib/prioritization/engine";
import type { TaskPriority, TaskStatus, ProjectStatus } from "@/types";

export type AnalyticsProject = {
  id: string;
  name: string;
  status: ProjectStatus;
  updatedAt?: Date | string;
};

export type AnalyticsTask = {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  projectId: string;
  dueDate?: Date | string | null;
  estimatedHours?: number | null;
  createdAt: Date | string;
  updatedAt?: Date | string;
  project?: { id: string; name: string };
  assignee?: { id: string; name: string; email: string; avatarUrl?: string | null } | null;
};

export type ProjectSummary = {
  id: string;
  name: string;
  status: ProjectStatus;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
};

export type AnalyticsMetrics = {
  totalProjects: number;
  activeProjects: number;
  archivedProjects: number;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  inReviewTasks: number;
  todoTasks: number;
  overdueTasks: number;
  dueSoonTasks: number;
  memberCount: number;
  completionRate: number;
};

export type AnalyticsResult = {
  metrics: AnalyticsMetrics;
  statusDistribution: Record<TaskStatus, number>;
  priorityDistribution: Record<TaskPriority, number>;
  projectSummaries: ProjectSummary[];
  upcomingTasks: Array<{
    id: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate: string | null;
    project?: { id: string; name: string };
    assignee?: { id: string; name: string; email: string; avatarUrl?: string | null } | null;
  }>;
  topPriorityTasks: Array<{
    id: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate: string | null;
    priorityScore: number;
    priorityReason: string[];
    project?: { id: string; name: string };
    assignee?: { id: string; name: string; email: string; avatarUrl?: string | null } | null;
  }>;
};

export type CalculateAnalyticsOptions = {
  projects: AnalyticsProject[];
  tasks: AnalyticsTask[];
  memberCount: number;
  now?: Date;
};

export function getDueStatus(
  dueDate: Date | string | null | undefined,
  status: TaskStatus,
  referenceDate: Date = new Date()
): { isOverdue: boolean; isDueSoon: boolean; daysDiff: number | null } {
  if (!dueDate || status === "DONE") {
    return { isOverdue: false, isDueSoon: false, daysDiff: null };
  }

  const due = new Date(dueDate);
  if (isNaN(due.getTime())) {
    return { isOverdue: false, isDueSoon: false, daysDiff: null };
  }

  const todayUtc = Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate()
  );
  const dueUtc = Date.UTC(
    due.getUTCFullYear(),
    due.getUTCMonth(),
    due.getUTCDate()
  );
  const msDiff = dueUtc - todayUtc;
  const daysDiff = Math.round(msDiff / (1000 * 60 * 60 * 24));

  // Overdue: due date is strictly before today
  const isOverdue = daysDiff < 0;
  // Due soon: due date is within today to next 7 days inclusive
  const isDueSoon = daysDiff >= 0 && daysDiff <= 7;

  return { isOverdue, isDueSoon, daysDiff };
}

export function calculateWorkspaceAnalytics(options: CalculateAnalyticsOptions): AnalyticsResult {
  const { projects = [], tasks = [], memberCount = 0, now = new Date() } = options;

  const totalProjects = projects.length;
  let activeProjects = 0;
  let archivedProjects = 0;

  for (const p of projects) {
    if (p.status === "ACTIVE") {
      activeProjects++;
    } else if (p.status === "ARCHIVED") {
      archivedProjects++;
    }
  }

  const statusDistribution: Record<TaskStatus, number> = {
    TODO: 0,
    IN_PROGRESS: 0,
    IN_REVIEW: 0,
    DONE: 0,
  };

  const priorityDistribution: Record<TaskPriority, number> = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    URGENT: 0,
  };

  const projectStats: Record<string, { total: number; completed: number }> = {};
  for (const p of projects) {
    projectStats[p.id] = { total: 0, completed: 0 };
  }

  let completedTasks = 0;
  let inProgressTasks = 0;
  let inReviewTasks = 0;
  let todoTasks = 0;
  let overdueTasks = 0;
  let dueSoonTasks = 0;

  const upcomingCandidates: Array<AnalyticsTask & { daysDiff: number }> = [];

  const scoredPendingTasks: Array<{
    id: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate: string | null;
    priorityScore: number;
    priorityReason: string[];
    project?: { id: string; name: string };
    assignee?: { id: string; name: string; email: string; avatarUrl?: string | null } | null;
  }> = [];

  for (const task of tasks) {
    statusDistribution[task.status] = (statusDistribution[task.status] || 0) + 1;
    priorityDistribution[task.priority] = (priorityDistribution[task.priority] || 0) + 1;

    // Track per-project totals
    if (projectStats[task.projectId]) {
      projectStats[task.projectId].total++;
    }

    if (task.status === "DONE") {
      completedTasks++;
      if (projectStats[task.projectId]) {
        projectStats[task.projectId].completed++;
      }
    } else {
      if (task.status === "IN_PROGRESS") inProgressTasks++;
      else if (task.status === "IN_REVIEW") inReviewTasks++;
      else if (task.status === "TODO") todoTasks++;

      const dueInfo = getDueStatus(task.dueDate, task.status, now);
      if (dueInfo.isOverdue) {
        overdueTasks++;
      } else if (dueInfo.isDueSoon && dueInfo.daysDiff !== null) {
        dueSoonTasks++;
        upcomingCandidates.push({ ...task, daysDiff: dueInfo.daysDiff });
      }

      const priorityInfo = calculateTaskPriority({
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate || null,
        estimatedHours: task.estimatedHours,
        createdAt: task.createdAt,
      });

      scoredPendingTasks.push({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
        priorityScore: priorityInfo.score,
        priorityReason: priorityInfo.reasons,
        project: task.project,
        assignee: task.assignee,
      });
    }
  }

  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const projectSummaries: ProjectSummary[] = projects.map((p) => {
    const stats = projectStats[p.id] || { total: 0, completed: 0 };
    const pCompletionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      totalTasks: stats.total,
      completedTasks: stats.completed,
      completionRate: pCompletionRate,
    };
  });

  // Sort upcoming tasks by earliest due date
  upcomingCandidates.sort((a, b) => a.daysDiff - b.daysDiff);
  const upcomingTasks = upcomingCandidates.slice(0, 5).map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
    project: t.project,
    assignee: t.assignee,
  }));

  // Sort top priority tasks by score descending
  scoredPendingTasks.sort((a, b) => b.priorityScore - a.priorityScore);
  const topPriorityTasks = scoredPendingTasks.slice(0, 5);

  return {
    metrics: {
      totalProjects,
      activeProjects,
      archivedProjects,
      totalTasks,
      completedTasks,
      inProgressTasks,
      inReviewTasks,
      todoTasks,
      overdueTasks,
      dueSoonTasks,
      memberCount,
      completionRate,
    },
    statusDistribution,
    priorityDistribution,
    projectSummaries,
    upcomingTasks,
    topPriorityTasks,
  };
}
