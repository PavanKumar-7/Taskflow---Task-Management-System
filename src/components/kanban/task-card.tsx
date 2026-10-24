"use client";

import React from "react";
import {
  Calendar,
  Clock,
  MessageSquare,
  MoreHorizontal,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import type { TaskWithRelations, TaskStatus, TaskPriority } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type TaskCardProps = {
  task: TaskWithRelations;
  onSelect: (task: TaskWithRelations) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
};

const priorityStyles: Record<TaskPriority, { badge: string; label: string }> = {
  URGENT: {
    badge:
      "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400 font-semibold",
    label: "Urgent",
  },
  HIGH: {
    badge:
      "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium",
    label: "High",
  },
  MEDIUM: {
    badge:
      "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium",
    label: "Medium",
  },
  LOW: {
    badge: "border-muted bg-muted/60 text-muted-foreground font-normal",
    label: "Low",
  },
};

const nextStatuses: Record<
  TaskStatus,
  { status: TaskStatus; label: string }[]
> = {
  TODO: [
    { status: "IN_PROGRESS", label: "In Progress" },
    { status: "IN_REVIEW", label: "In Review" },
    { status: "DONE", label: "Done" },
  ],
  IN_PROGRESS: [
    { status: "IN_REVIEW", label: "In Review" },
    { status: "DONE", label: "Done" },
    { status: "TODO", label: "To Do" },
  ],
  IN_REVIEW: [
    { status: "DONE", label: "Done" },
    { status: "IN_PROGRESS", label: "In Progress" },
    { status: "TODO", label: "To Do" },
  ],
  DONE: [
    { status: "TODO", label: "To Do" },
    { status: "IN_PROGRESS", label: "In Progress" },
  ],
};

function getAssigneeInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

export function TaskCard({
  task,
  onSelect,
  onStatusChange,
  onDragStart,
}: TaskCardProps) {
  const isOverdue =
    task.status !== "DONE" &&
    (task.priorityReason?.some((r) => r.toLowerCase().includes("overdue")) ??
      false);

  const priorityConfig = priorityStyles[task.priority] || priorityStyles.MEDIUM;
  const targetOptions = nextStatuses[task.status] || [];

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={() => onSelect(task)}
      className="group relative cursor-pointer rounded-xl border border-border bg-card p-3.5 shadow-xs transition-colors duration-150 hover:border-primary/50 hover:shadow-xs select-none active:cursor-grabbing"
    >
      {/* Top row: Priority badge, Priority score, Menu */}
      <div className="flex items-center justify-between gap-1.5 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge
            variant="outline"
            className={cn(
              "px-1.5 py-0 text-[10px] uppercase tracking-wider",
              priorityConfig.badge,
            )}
          >
            {priorityConfig.label}
          </Badge>

          {task.priorityScore !== undefined && task.status !== "DONE" && (
            <span
              className="inline-flex items-center gap-0.5 rounded px-1 py-0 text-[10px] font-mono font-medium bg-muted text-muted-foreground"
              title={
                task.priorityReason?.join(" · ") ||
                `Score: ${task.priorityScore}`
              }
            >
              <Sparkles className="size-2.5 text-amber-500" />
              {task.priorityScore}
            </span>
          )}
        </div>

        {/* Quick status change menu */}
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="size-6 opacity-40 group-hover:opacity-100 hover:bg-muted"
                aria-label="Move task"
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Move to column
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {targetOptions.map((opt) => (
                <DropdownMenuItem
                  key={opt.status}
                  onClick={() => onStatusChange(task.id, opt.status)}
                  className="cursor-pointer gap-2 text-xs"
                >
                  <ArrowRight className="size-3 text-muted-foreground" />
                  <span>{opt.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Title */}
      <h4 className="text-sm font-medium leading-snug line-clamp-2 text-foreground mb-2 group-hover:text-primary transition-colors">
        {task.title}
      </h4>

      {/* Description preview */}
      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
          {task.description}
        </p>
      )}

      {/* Footer row: Due date, estimated hours, comments, assignee */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1.5 border-t border-border/50">
        <div className="flex items-center gap-2">
          {task.dueDate && (
            <div
              className={cn(
                "flex items-center gap-1 font-mono text-[11px]",
                isOverdue
                  ? "text-destructive font-semibold"
                  : "text-muted-foreground",
              )}
              title={isOverdue ? "Overdue deadline" : "Due date"}
            >
              <Calendar className="size-3" />
              <span>
                {new Date(task.dueDate).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          )}

          {task.status !== "DONE" && task.estimatedHours && (
            <div
              className="flex items-center gap-0.5 text-[11px]"
              title="Estimated hours"
            >
              <Clock className="size-3 text-muted-foreground" />
              <span>{task.estimatedHours}h</span>
            </div>
          )}

          {(task._count?.comments || 0) > 0 && (
            <div
              className="flex items-center gap-0.5 text-[11px]"
              title="Comments"
            >
              <MessageSquare className="size-3 text-muted-foreground" />
              <span>{task._count?.comments}</span>
            </div>
          )}
        </div>

        {/* Assignee Avatar */}
        {task.assignee ? (
          <Avatar
            size="sm"
            className="size-6 text-[10px]"
            title={`Assigned to ${task.assignee.name}`}
          >
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-[10px]">
              {getAssigneeInitials(task.assignee.name)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <span className="text-[10px] text-muted-foreground/60 italic">
            Unassigned
          </span>
        )}
      </div>
    </div>
  );
}
