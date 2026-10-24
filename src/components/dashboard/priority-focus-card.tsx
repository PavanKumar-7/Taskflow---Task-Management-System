import React from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Flame, Calendar, CheckCircle2, Clock } from "lucide-react";
import type { TaskPriority, TaskStatus } from "@/types";

type TopPriorityTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  priorityScore: number;
  priorityReason: string[];
  project?: { id: string; name: string };
  assignee?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  } | null;
};

type UpcomingTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  project?: { id: string; name: string };
  assignee?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  } | null;
};

type PriorityFocusCardProps = {
  topPriorityTasks: TopPriorityTask[];
  upcomingTasks: UpcomingTask[];
  overdueCount: number;
  dueSoonCount: number;
};

const PRIORITY_STYLES: Record<
  TaskPriority,
  { label: string; badgeClass: string }
> = {
  URGENT: {
    label: "Urgent",
    badgeClass:
      "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
  },
  HIGH: {
    label: "High",
    badgeClass:
      "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  MEDIUM: {
    label: "Medium",
    badgeClass:
      "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
  },
  LOW: {
    label: "Low",
    badgeClass:
      "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20",
  },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "No date";
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function PriorityFocusCard({
  topPriorityTasks,
  upcomingTasks,
  overdueCount,
  dueSoonCount,
}: PriorityFocusCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Flame className="size-4 text-amber-500" />
              Priority Focus & Deadlines
            </CardTitle>
            <CardDescription>
              Smart scoring highlights urgent tasks needing immediate team
              attention.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5">
            {overdueCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {overdueCount} overdue
              </Badge>
            )}
            {dueSoonCount > 0 && (
              <Badge
                variant="outline"
                className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
              >
                {dueSoonCount} due soon
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 flex-1">
        {/* Top Priority Tasks Section */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2.5">
            Highest Priority Tasks
          </p>
          {topPriorityTasks.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              <span>No pending tasks requiring urgent focus. Great job!</span>
            </div>
          ) : (
            <div className="space-y-2">
              {topPriorityTasks.map((task) => {
                const priorityInfo = PRIORITY_STYLES[task.priority];
                const boardHref = task.project?.id
                  ? `/projects/${task.project.id}`
                  : "/projects";

                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-2.5 hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={boardHref}
                          className="text-xs font-medium text-foreground hover:underline truncate"
                        >
                          {task.title}
                        </Link>
                        <Badge
                          variant="outline"
                          className={`text-[10px] py-0 px-1.5 shrink-0 font-medium ${priorityInfo.badgeClass}`}
                        >
                          {priorityInfo.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                        {task.project && (
                          <span className="truncate max-w-[120px]">
                            {task.project.name}
                          </span>
                        )}
                        {task.dueDate && (
                          <span className="flex items-center gap-1 shrink-0">
                            <Clock className="size-3" />
                            {formatDate(task.dueDate)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Priority Score with transparent reason tooltip */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex flex-col items-end shrink-0 cursor-help">
                          <span className="inline-flex items-center gap-1 rounded bg-muted/80 px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                            {task.priorityScore} pts
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent
                        side="left"
                        className="max-w-xs text-xs space-y-1"
                      >
                        <p className="font-semibold">
                          Priority Score Breakdown:
                        </p>
                        <ul className="list-disc pl-3 space-y-0.5 text-[11px] text-muted-foreground">
                          {task.priorityReason.map((reason, idx) => (
                            <li key={idx}>{reason}</li>
                          ))}
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming Deadlines Section */}
        {upcomingTasks.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2.5 flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              Upcoming Deadlines (Next 7 Days)
            </p>
            <div className="space-y-1.5">
              {upcomingTasks.map((task) => {
                const boardHref = task.project?.id
                  ? `/projects/${task.project.id}`
                  : "/projects";
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-muted/40 transition-colors"
                  >
                    <Link
                      href={boardHref}
                      className="truncate font-medium text-foreground hover:underline pr-2"
                    >
                      {task.title}
                    </Link>
                    <div className="flex items-center gap-2 shrink-0">
                      {task.project && (
                        <span className="text-[11px] text-muted-foreground hidden sm:inline">
                          {task.project.name}
                        </span>
                      )}
                      <span className="font-medium text-[11px] bg-muted px-1.5 py-0.5 rounded text-foreground">
                        {formatDate(task.dueDate)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
