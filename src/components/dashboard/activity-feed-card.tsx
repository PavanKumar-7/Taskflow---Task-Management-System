import React from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Activity, History } from "lucide-react";

export type ActivityItem = {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
  task: {
    id: string;
    title: string;
  } | null;
  project: {
    id: string;
    name: string;
  } | null;
};

type ActivityFeedCardProps = {
  activities: ActivityItem[];
  isLoading?: boolean;
};

function formatInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function renderActivityDescription(activity: ActivityItem) {
  const { action, details, task, project } = activity;

  switch (action) {
    case "TASK_CREATED":
      return (
        <span>
          created task{" "}
          <span className="font-semibold text-foreground">
            {task ? task.title : details || "a task"}
          </span>
          {project && (
            <>
              {" in "}
              <Link
                href={`/projects/${project.id}`}
                className="font-medium text-foreground hover:underline"
              >
                {project.name}
              </Link>
            </>
          )}
        </span>
      );
    case "TASK_STATUS_CHANGED":
      return (
        <span>
          moved{" "}
          <span className="font-semibold text-foreground">
            {task ? task.title : "task"}
          </span>{" "}
          {details ? `to ${details.replace(/_/g, " ")}` : "status updated"}
        </span>
      );
    case "TASK_UPDATED":
      return (
        <span>
          updated{" "}
          <span className="font-semibold text-foreground">
            {task ? task.title : "task"}
          </span>
          {details && (
            <span className="text-muted-foreground text-xs"> ({details})</span>
          )}
        </span>
      );
    case "TASK_DELETED":
      return (
        <span>
          deleted task{" "}
          <span className="font-semibold text-foreground">
            {details || (task ? task.title : "")}
          </span>
        </span>
      );
    case "COMMENT_ADDED":
      return (
        <span>
          commented on{" "}
          <span className="font-semibold text-foreground">
            {task ? task.title : "task"}
          </span>
        </span>
      );
    case "PROJECT_CREATED":
      return (
        <span>
          created project{" "}
          <span className="font-semibold text-foreground">
            {project ? project.name : details || "new project"}
          </span>
        </span>
      );
    case "PROJECT_UPDATED":
      return (
        <span>
          updated project{" "}
          <span className="font-semibold text-foreground">
            {project ? project.name : details || "project"}
          </span>
        </span>
      );
    default:
      return (
        <span>
          {action.toLowerCase().replace(/_/g, " ")}{" "}
          {details && (
            <span className="text-foreground font-medium">{details}</span>
          )}
        </span>
      );
  }
}

export function ActivityFeedCard({
  activities,
  isLoading,
}: ActivityFeedCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              Chronological audit log of recent workspace events.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 flex-1">
        {isLoading ? (
          <div className="space-y-3 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
                  <div className="h-2.5 w-1/4 rounded bg-muted animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center text-muted-foreground">
            <History className="size-8 text-muted-foreground/40 mb-2" />
            <p className="text-xs font-medium">No recent activity</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xs">
              Actions taken by team members will automatically appear here.
            </p>
          </div>
        ) : (
          <div className="relative pl-6 space-y-4 before:absolute before:bottom-2 before:left-2 before:top-2 before:w-0.5 before:bg-border/60">
            {activities.map((item) => (
              <div
                key={item.id}
                className="relative flex items-start gap-3 text-xs"
              >
                {/* Timeline node */}
                <span className="absolute -left-6 top-1 flex size-4 items-center justify-center rounded-full bg-background ring-2 ring-primary/30">
                  <span className="size-1.5 rounded-full bg-primary" />
                </span>

                <Avatar className="size-6 text-[10px] shrink-0 mt-0.5">
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {formatInitials(item.user.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-foreground mr-1">
                      {item.user.name}
                    </span>
                    {renderActivityDescription(item)}
                  </p>
                  <span className="text-[10px] text-muted-foreground font-mono mt-0.5 block">
                    {formatRelativeTime(item.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
