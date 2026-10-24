"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Clock,
  MessageSquare,
  Sparkles,
  Trash2,
  User,
  History,
  Send,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import type {
  TaskWithRelations,
  TaskStatus,
  TaskPriority,
  CommentWithAuthor,
  ActivityLogEntry,
  WorkspaceMemberDetails,
} from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type TaskDetailsModalProps = {
  taskId: string | null;
  workspaceId: string;
  members: WorkspaceMemberDetails[];
  onClose: () => void;
  onTaskUpdated: () => void;
  onTaskDeleted: (taskId: string) => void;
};

type FullTask = TaskWithRelations & {
  comments?: CommentWithAuthor[];
  activityLogs?: ActivityLogEntry[];
};

function formatActionText(action: string, detailsStr?: string | null): string {
  try {
    const details = detailsStr ? JSON.parse(detailsStr) : {};
    switch (action) {
      case "TASK_CREATED":
        return "created this task";
      case "STATUS_CHANGED":
        return `changed status from ${details.from || "?"} to ${details.to || "?"}`;
      case "PRIORITY_CHANGED":
        return `changed priority from ${details.from || "?"} to ${details.to || "?"}`;
      case "ASSIGNEE_CHANGED":
        return `changed assignee from ${details.from || "?"} to ${details.to || "?"}`;
      case "COMMENT_ADDED":
        return "added a comment";
      default:
        return action.toLowerCase().replace(/_/g, " ");
    }
  } catch {
    return action.toLowerCase().replace(/_/g, " ");
  }
}

export function TaskDetailsModal({
  taskId,
  workspaceId,
  members,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
}: TaskDetailsModalProps) {
  const [task, setTask] = useState<FullTask | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("TODO");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [estimatedHours, setEstimatedHours] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Comment field
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Delete confirm
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const reloadTask = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(
          `/api/v1/workspaces/${workspaceId}/tasks/${id}`,
          {
            cache: "no-store",
          },
        );
        const json = await res.json();
        if (json.success && json.data) {
          const data: FullTask = json.data;
          setTask(data);
          setTitle(data.title);
          setDescription(data.description || "");
          setStatus(data.status);
          setPriority(data.priority);
          setAssigneeId(data.assigneeId || "");
          setDueDate(data.dueDate ? data.dueDate.split("T")[0] : "");
          setEstimatedHours(
            data.estimatedHours ? String(data.estimatedHours) : "",
          );
        }
      } catch {
        // Keep state
      }
    },
    [workspaceId],
  );

  useEffect(() => {
    let ignore = false;

    if (!taskId) {
      return;
    }

    async function loadInitial() {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch(
          `/api/v1/workspaces/${workspaceId}/tasks/${taskId}`,
          {
            cache: "no-store",
          },
        );
        const json = await res.json();
        if (ignore) return;

        if (!res.ok || !json.success) {
          setError(json.error?.message || "Task not found or access denied.");
          return;
        }

        const data: FullTask = json.data;
        setTask(data);
        setTitle(data.title);
        setDescription(data.description || "");
        setStatus(data.status);
        setPriority(data.priority);
        setAssigneeId(data.assigneeId || "");
        setDueDate(data.dueDate ? data.dueDate.split("T")[0] : "");
        setEstimatedHours(
          data.estimatedHours ? String(data.estimatedHours) : "",
        );
      } catch {
        if (!ignore) {
          setError("Failed to load task details.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadInitial();

    return () => {
      ignore = true;
    };
  }, [taskId, workspaceId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskId) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Task title cannot be empty.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(
        `/api/v1/workspaces/${workspaceId}/tasks/${taskId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: trimmedTitle,
            description: description.trim() || null,
            status,
            priority,
            assigneeId: assigneeId || null,
            dueDate: dueDate ? new Date(dueDate).toISOString() : null,
            estimatedHours: estimatedHours ? Number(estimatedHours) : null,
          }),
        },
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Failed to update task.");
        return;
      }

      toast.success("Task updated successfully!");
      onTaskUpdated();
      reloadTask(taskId);
    } catch {
      toast.error("Network error while updating task.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskId || !newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      const res = await fetch(
        `/api/v1/workspaces/${workspaceId}/tasks/${taskId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: newComment.trim() }),
        },
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Failed to post comment.");
        return;
      }

      toast.success("Comment added!");
      setNewComment("");
      reloadTask(taskId);
      onTaskUpdated();
    } catch {
      toast.error("Failed to add comment.");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDelete = async () => {
    if (!taskId) return;

    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/v1/workspaces/${workspaceId}/tasks/${taskId}`,
        {
          method: "DELETE",
        },
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Failed to delete task.");
        return;
      }

      toast.success("Task deleted.");
      onTaskDeleted(taskId);
      onClose();
    } catch {
      toast.error("Failed to delete task.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!taskId) return null;

  return (
    <>
      <Dialog
        open={Boolean(taskId)}
        onOpenChange={(open) => !open && onClose()}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="size-5 animate-spin" />
              <span>Loading task details...</span>
            </div>
          ) : error || !task ? (
            <div className="py-10 text-center space-y-3">
              <AlertCircle className="size-8 text-destructive mx-auto" />
              <p className="text-sm text-destructive">
                {error || "Task not found"}
              </p>
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header */}
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge variant="outline" className="text-xs uppercase">
                    {task.project?.name || "Project"}
                  </Badge>
                  {task.priorityScore !== undefined && (
                    <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs font-mono font-medium text-muted-foreground">
                      <Sparkles className="size-3 text-amber-500" />
                      Priority Score: {task.priorityScore}
                    </span>
                  )}
                </div>
                <DialogTitle className="text-xl font-bold text-left">
                  {task.title}
                </DialogTitle>
                <DialogDescription className="text-left text-xs">
                  Created by {task.creator?.name || "Team member"} on{" "}
                  {new Date(task.createdAt).toLocaleDateString()}
                </DialogDescription>
              </DialogHeader>

              {/* Priority score explanation banner */}
              {task.priorityReason && task.priorityReason.length > 0 && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs space-y-1">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-amber-500" />
                    Prioritization Breakdown:
                  </div>
                  <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                    {task.priorityReason.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Form fields */}
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="edit-task-title"
                    className="text-xs font-medium text-foreground"
                  >
                    Title
                  </label>
                  <Input
                    id="edit-task-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isSaving}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="edit-task-desc"
                    className="text-xs font-medium text-foreground"
                  >
                    Description
                  </label>
                  <Textarea
                    id="edit-task-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isSaving}
                    placeholder="Add details, acceptance criteria, or links..."
                    rows={3}
                  />
                </div>

                {/* Grid for Status, Priority, Assignee, Due Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Status */}
                  <div className="space-y-1">
                    <label
                      htmlFor="status-select"
                      className="font-medium text-foreground"
                    >
                      Status
                    </label>
                    <select
                      id="status-select"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as TaskStatus)}
                      disabled={isSaving}
                      className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option
                        value="TODO"
                        className="bg-popover text-popover-foreground"
                      >
                        To Do
                      </option>
                      <option
                        value="IN_PROGRESS"
                        className="bg-popover text-popover-foreground"
                      >
                        In Progress
                      </option>
                      <option
                        value="IN_REVIEW"
                        className="bg-popover text-popover-foreground"
                      >
                        In Review
                      </option>
                      <option
                        value="DONE"
                        className="bg-popover text-popover-foreground"
                      >
                        Done
                      </option>
                    </select>
                  </div>

                  {/* Priority */}
                  <div className="space-y-1">
                    <label
                      htmlFor="priority-select"
                      className="font-medium text-foreground"
                    >
                      Priority
                    </label>
                    <select
                      id="priority-select"
                      value={priority}
                      onChange={(e) =>
                        setPriority(e.target.value as TaskPriority)
                      }
                      disabled={isSaving}
                      className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option
                        value="LOW"
                        className="bg-popover text-popover-foreground"
                      >
                        Low
                      </option>
                      <option
                        value="MEDIUM"
                        className="bg-popover text-popover-foreground"
                      >
                        Medium
                      </option>
                      <option
                        value="HIGH"
                        className="bg-popover text-popover-foreground"
                      >
                        High
                      </option>
                      <option
                        value="URGENT"
                        className="bg-popover text-popover-foreground"
                      >
                        Urgent
                      </option>
                    </select>
                  </div>

                  {/* Assignee */}
                  <div className="space-y-1">
                    <label
                      htmlFor="assignee-select"
                      className="font-medium text-foreground flex items-center gap-1"
                    >
                      <User className="size-3" />
                      Assignee
                    </label>
                    <select
                      id="assignee-select"
                      value={assigneeId}
                      onChange={(e) => setAssigneeId(e.target.value)}
                      disabled={isSaving}
                      className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option
                        value=""
                        className="bg-popover text-popover-foreground"
                      >
                        Unassigned
                      </option>
                      {members.map((m) => (
                        <option
                          key={m.userId}
                          value={m.userId}
                          className="bg-popover text-popover-foreground"
                        >
                          {m.user.name} ({m.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Due Date */}
                  <div className="space-y-1">
                    <label
                      htmlFor="due-date-input"
                      className="font-medium text-foreground flex items-center gap-1"
                    >
                      <Calendar className="size-3" />
                      Due Date
                    </label>
                    <Input
                      id="due-date-input"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      disabled={isSaving}
                      className="h-8 text-xs"
                    />
                  </div>

                  {/* Estimated Hours (hidden when status is DONE) */}
                  {status !== "DONE" && (
                    <div className="space-y-1 sm:col-span-2">
                      <label
                        htmlFor="est-hours-input"
                        className="font-medium text-foreground flex items-center gap-1"
                      >
                        <Clock className="size-3" />
                        Estimated Hours
                      </label>
                      <Input
                        id="est-hours-input"
                        type="number"
                        step="0.5"
                        min="0.5"
                        placeholder="e.g. 2.5"
                        value={estimatedHours}
                        onChange={(e) => setEstimatedHours(e.target.value)}
                        disabled={isSaving}
                        className="h-8 text-xs max-w-xs"
                      />
                    </div>
                  )}
                </div>

                {/* Actions row */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setIsConfirmDeleteOpen(true)}
                    disabled={isSaving}
                    className="gap-1.5"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Delete</span>
                  </Button>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onClose}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" disabled={isSaving}>
                      {isSaving ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin mr-1.5" />
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </div>
                </div>
              </form>

              {/* Comments Section */}
              <div className="space-y-3 pt-4 border-t">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <MessageSquare className="size-4 text-primary" />
                  Comments ({task.comments?.length || 0})
                </h3>

                {/* Comment list */}
                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                  {task.comments && task.comments.length > 0 ? (
                    task.comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="rounded-lg border bg-muted/30 p-2.5 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {comment.author?.name || "Member"}
                          </span>
                          <span className="text-[10px]">
                            {new Date(comment.createdAt).toLocaleDateString()}{" "}
                            at{" "}
                            {new Date(comment.createdAt).toLocaleTimeString(
                              [],
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </span>
                        </div>
                        <p className="text-foreground whitespace-pre-wrap">
                          {comment.content}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      No comments yet.
                    </p>
                  )}
                </div>

                {/* Add comment form */}
                <form onSubmit={handleAddComment} className="flex gap-2">
                  <Input
                    placeholder="Write a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    disabled={isSubmittingComment}
                    className="text-xs h-9 flex-1"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmittingComment || !newComment.trim()}
                    className="shrink-0 gap-1.5"
                  >
                    {isSubmittingComment ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Send className="size-3.5" />
                    )}
                    <span>Send</span>
                  </Button>
                </form>
              </div>

              {/* Activity History Section */}
              {task.activityLogs && task.activityLogs.length > 0 && (
                <div className="space-y-3 pt-4 border-t">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <History className="size-4 text-muted-foreground" />
                    Activity History
                  </h3>
                  <div className="space-y-2 max-h-36 overflow-y-auto text-xs text-muted-foreground">
                    {task.activityLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start justify-between gap-2 border-b border-border/40 pb-1.5"
                      >
                        <div>
                          <strong className="text-foreground font-medium">
                            {log.user?.name || "User"}
                          </strong>{" "}
                          <span>
                            {formatActionText(log.action, log.details)}
                          </span>
                        </div>
                        <span className="text-[10px] shrink-0">
                          {new Date(log.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this task? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsConfirmDeleteOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Deleting...
                </>
              ) : (
                "Delete Task"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
