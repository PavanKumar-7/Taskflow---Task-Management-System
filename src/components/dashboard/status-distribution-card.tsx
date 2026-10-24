import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { CircleDot, PlayCircle, Eye, CheckCircle2 } from "lucide-react";
import type { TaskStatus, TaskPriority } from "@/types";

type StatusDistributionProps = {
  statusDistribution: Record<TaskStatus, number>;
  priorityDistribution: Record<TaskPriority, number>;
  totalTasks: number;
  completionRate: number;
};

const STATUS_CONFIG: Record<
  TaskStatus,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
    barColor: string;
  }
> = {
  TODO: {
    label: "To Do",
    icon: CircleDot,
    color: "text-slate-600 dark:text-slate-400",
    bgColor: "bg-slate-500/10",
    barColor: "bg-slate-500",
  },
  IN_PROGRESS: {
    label: "In Progress",
    icon: PlayCircle,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-500/10",
    barColor: "bg-blue-500",
  },
  IN_REVIEW: {
    label: "In Review",
    icon: Eye,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-500/10",
    barColor: "bg-amber-500",
  },
  DONE: {
    label: "Done",
    icon: CheckCircle2,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-500/10",
    barColor: "bg-emerald-500",
  },
};

const PRIORITY_BADGES: Record<
  TaskPriority,
  { label: string; color: string; bg: string }
> = {
  URGENT: {
    label: "Urgent",
    color: "text-red-700 dark:text-red-400",
    bg: "bg-red-500/15",
  },
  HIGH: {
    label: "High",
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-500/15",
  },
  MEDIUM: {
    label: "Medium",
    color: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-500/15",
  },
  LOW: {
    label: "Low",
    color: "text-slate-700 dark:text-slate-400",
    bg: "bg-slate-500/15",
  },
};

export function StatusDistributionCard({
  statusDistribution,
  priorityDistribution,
  totalTasks,
  completionRate,
}: StatusDistributionProps) {
  const statuses: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
  const priorities: TaskPriority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Workflow Status
          </CardTitle>
          <span className="text-xs font-medium text-muted-foreground">
            {completionRate}% completed
          </span>
        </div>
        <CardDescription>
          Distribution of {totalTasks} task{totalTasks === 1 ? "" : "s"} across
          active workflow stages.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 flex-1">
        {/* Status Distribution Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statuses.map((status) => {
            const config = STATUS_CONFIG[status];
            const Icon = config.icon;
            const count = statusDistribution[status] || 0;
            const percentage =
              totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;

            return (
              <div
                key={status}
                className="flex flex-col justify-between rounded-xl border border-border bg-card p-3 space-y-2 hover:border-border/80 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {config.label}
                  </span>
                  <div
                    className={`rounded-lg p-1 border border-border ${config.bgColor}`}
                  >
                    <Icon className={`size-3.5 ${config.color}`} />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold">{count}</span>
                    <span className="text-xs text-muted-foreground">
                      {percentage}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full ${config.barColor} transition-all duration-300`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Priority breakdown */}
        <div className="border-t border-border pt-4 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Tasks by Priority
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {priorities.map((priority) => {
              const badge = PRIORITY_BADGES[priority];
              const count = priorityDistribution[priority] || 0;
              return (
                <div
                  key={priority}
                  className="flex items-center justify-between rounded-md border border-border/50 bg-background/50 px-3 py-2 text-xs"
                >
                  <span
                    className={`font-medium rounded px-1.5 py-0.5 ${badge.bg} ${badge.color}`}
                  >
                    {badge.label}
                  </span>
                  <span className="font-semibold text-foreground">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
