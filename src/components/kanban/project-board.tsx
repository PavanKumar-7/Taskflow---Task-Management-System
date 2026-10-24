"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Circle,
  HelpCircle,
  FolderKanban,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/context/workspace-context";
import type {
  TaskWithRelations,
  TaskStatus,
  TaskPriority,
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
import { TaskCard } from "@/components/kanban/task-card";
import { TaskDetailsModal } from "@/components/kanban/task-details-modal";

type ProjectData = {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "ARCHIVED";
  workspaceId: string;
};

const COLUMNS: {
  status: TaskStatus;
  title: string;
  icon: React.ElementType;
  color: string;
}[] = [
  { status: "TODO", title: "To Do", icon: Circle, color: "text-slate-500" },
  {
    status: "IN_PROGRESS",
    title: "In Progress",
    icon: Clock,
    color: "text-blue-500",
  },
  {
    status: "IN_REVIEW",
    title: "In Review",
    icon: HelpCircle,
    color: "text-amber-500",
  },
  {
    status: "DONE",
    title: "Done",
    icon: CheckCircle2,
    color: "text-emerald-500",
  },
];

export function ProjectBoard({
  projectId,
  initialTaskId,
}: {
  projectId: string;
  initialTaskId?: string;
}) {
  const { currentWorkspace, isLoading: isWorkspaceLoading } = useWorkspace();

  const [project, setProject] = useState<ProjectData | null>(null);
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<
    "position" | "priorityScore" | "dueDate"
  >("position");

  // Selected task for modal
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    initialTaskId || null,
  );
  const [prevInitialTaskId, setPrevInitialTaskId] = useState(initialTaskId);

  if (initialTaskId !== prevInitialTaskId) {
    setPrevInitialTaskId(initialTaskId);
    if (initialTaskId) {
      setSelectedTaskId(initialTaskId);
    }
  }

  // Create task modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createStatus, setCreateStatus] = useState<TaskStatus>("TODO");
  const [createPriority, setCreatePriority] = useState<TaskPriority>("MEDIUM");
  const [createAssigneeId, setCreateAssigneeId] = useState<string>("");
  const [createDueDate, setCreateDueDate] = useState<string>("");
  const [createEstimatedHours, setCreateEstimatedHours] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Load project, tasks, and workspace members
  const loadData = useCallback(async () => {
    if (!currentWorkspace) return;

    try {
      setIsLoading(true);
      setError(null);

      const [projRes, tasksRes, membersRes] = await Promise.all([
        fetch(
          `/api/v1/workspaces/${currentWorkspace.id}/projects/${projectId}`,
          { cache: "no-store" },
        ),
        fetch(
          `/api/v1/workspaces/${currentWorkspace.id}/tasks?projectId=${projectId}&sortBy=${sortBy}`,
          { cache: "no-store" },
        ),
        fetch(`/api/v1/workspaces/${currentWorkspace.id}/members`, {
          cache: "no-store",
        }),
      ]);

      const projJson = await projRes.json();
      const tasksJson = await tasksRes.json();
      const membersJson = await membersRes.json();

      if (!projRes.ok || !projJson.success) {
        setError(
          projJson.error?.message || "Project not found in this workspace.",
        );
        return;
      }

      setProject(projJson.data);
      if (tasksJson.success && tasksJson.data) {
        setTasks(tasksJson.data);
      }
      if (membersJson.success && membersJson.data) {
        setMembers(membersJson.data);
      }
    } catch {
      setError("Network error while loading project board.");
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace, projectId, sortBy]);

  useEffect(() => {
    let ignore = false;

    async function initialFetch() {
      if (!currentWorkspace) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const [projRes, tasksRes, membersRes] = await Promise.all([
          fetch(
            `/api/v1/workspaces/${currentWorkspace.id}/projects/${projectId}`,
            { cache: "no-store" },
          ),
          fetch(
            `/api/v1/workspaces/${currentWorkspace.id}/tasks?projectId=${projectId}&sortBy=${sortBy}`,
            { cache: "no-store" },
          ),
          fetch(`/api/v1/workspaces/${currentWorkspace.id}/members`, {
            cache: "no-store",
          }),
        ]);

        const projJson = await projRes.json();
        const tasksJson = await tasksRes.json();
        const membersJson = await membersRes.json();

        if (ignore) return;

        if (!projRes.ok || !projJson.success) {
          setError(
            projJson.error?.message || "Project not found in this workspace.",
          );
          return;
        }

        setProject(projJson.data);
        if (tasksJson.success && tasksJson.data) {
          setTasks(tasksJson.data);
        }
        if (membersJson.success && membersJson.data) {
          setMembers(membersJson.data);
        }
      } catch {
        if (!ignore) {
          setError("Network error while loading project board.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void initialFetch();

    return () => {
      ignore = true;
    };
  }, [currentWorkspace, projectId, sortBy]);

  // Update task status (drag-and-drop or menu)
  const handleStatusChange = async (
    taskId: string,
    targetStatus: TaskStatus,
  ) => {
    if (!currentWorkspace) return;

    // Optimistically update local state
    const previousTasks = [...tasks];
    setTasks((current) =>
      current.map((t) =>
        t.id === taskId ? { ...t, status: targetStatus } : t,
      ),
    );

    try {
      const res = await fetch(
        `/api/v1/workspaces/${currentWorkspace.id}/tasks/${taskId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: targetStatus }),
        },
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        // Rollback
        setTasks(previousTasks);
        toast.error(json.error?.message || "Failed to update task status.");
        return;
      }

      // Update with server recalculated priority score
      setTasks((current) =>
        current.map((t) => (t.id === taskId ? { ...t, ...json.data } : t)),
      );
    } catch {
      setTasks(previousTasks);
      toast.error("Failed to update task status.");
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    if (taskId) {
      handleStatusChange(taskId, targetStatus);
    }
  };

  // Create task submit
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace) return;
    setCreateError(null);

    const trimmedTitle = createTitle.trim();
    if (!trimmedTitle) {
      setCreateError("Task title is required.");
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch(
        `/api/v1/workspaces/${currentWorkspace.id}/tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            title: trimmedTitle,
            description: createDescription.trim() || undefined,
            status: createStatus,
            priority: createPriority,
            assigneeId: createAssigneeId || undefined,
            dueDate: createDueDate
              ? new Date(createDueDate).toISOString()
              : undefined,
            estimatedHours: createEstimatedHours
              ? Number(createEstimatedHours)
              : undefined,
          }),
        },
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json.error?.message || "Failed to create task.";
        setCreateError(msg);
        toast.error(msg);
        return;
      }

      toast.success("Task created!");
      setCreateTitle("");
      setCreateDescription("");
      setCreateDueDate("");
      setCreateEstimatedHours("");
      setIsCreateOpen(false);
      loadData();
    } catch {
      setCreateError("Network error while creating task.");
      toast.error("Network error while creating task.");
    } finally {
      setIsCreating(false);
    }
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDesc = task.description?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc) return false;
      }

      // Priority filter
      if (priorityFilter !== "ALL" && task.priority !== priorityFilter) {
        return false;
      }

      // Assignee filter
      if (assigneeFilter === "UNASSIGNED") {
        if (task.assigneeId !== null) return false;
      } else if (assigneeFilter !== "ALL") {
        if (task.assigneeId !== assigneeFilter) return false;
      }

      return true;
    });
  }, [tasks, searchQuery, priorityFilter, assigneeFilter]);

  if (isWorkspaceLoading || isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 rounded bg-muted animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-96 rounded-xl border bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="py-12 text-center space-y-4">
        <AlertCircle className="size-10 text-destructive mx-auto" />
        <h2 className="text-xl font-bold">Project Unavailable</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {error ||
            "Project not found or you do not have permission to access it."}
        </p>
        <Button variant="outline" asChild>
          <Link href="/projects" className="gap-2">
            <ArrowLeft className="size-4" />
            <span>Back to Projects</span>
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Bar: Breadcrumb, Project Name, Status, Add Task */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Link
              href="/projects"
              className="hover:text-foreground transition-colors"
            >
              Projects
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">{project.name}</span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <FolderKanban className="size-6 text-primary" />
              {project.name}
            </h1>
            <Badge
              variant={project.status === "ACTIVE" ? "default" : "secondary"}
              className="text-xs uppercase"
            >
              {project.status}
            </Badge>
          </div>
          {project.description && (
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
              {project.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={() => {
              setCreateStatus("TODO");
              setCreateError(null);
              setIsCreateOpen(true);
            }}
            className="gap-1.5"
            size="sm"
          >
            <Plus className="size-4" />
            <span>New Task</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between text-xs">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tasks by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Filter className="size-3.5" />
            <span>Filter:</span>
          </div>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
            aria-label="Filter by priority"
          >
            <option value="ALL" className="bg-popover text-popover-foreground">
              All Priorities
            </option>
            <option
              value="URGENT"
              className="bg-popover text-popover-foreground"
            >
              Urgent
            </option>
            <option value="HIGH" className="bg-popover text-popover-foreground">
              High
            </option>
            <option
              value="MEDIUM"
              className="bg-popover text-popover-foreground"
            >
              Medium
            </option>
            <option value="LOW" className="bg-popover text-popover-foreground">
              Low
            </option>
          </select>

          {/* Assignee filter */}
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
            aria-label="Filter by assignee"
          >
            <option value="ALL" className="bg-popover text-popover-foreground">
              All Assignees
            </option>
            <option
              value="UNASSIGNED"
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
                {m.user.name}
              </option>
            ))}
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(
                e.target.value as "position" | "priorityScore" | "dueDate",
              )
            }
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
            aria-label="Sort tasks"
          >
            <option
              value="position"
              className="bg-popover text-popover-foreground"
            >
              Manual Position
            </option>
            <option
              value="priorityScore"
              className="bg-popover text-popover-foreground"
            >
              Priority Score (Highest)
            </option>
            <option
              value="dueDate"
              className="bg-popover text-popover-foreground"
            >
              Due Date (Earliest)
            </option>
          </select>
        </div>
      </div>

      {/* Kanban Board Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {COLUMNS.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.status);
          const ColIcon = col.icon;

          return (
            <div
              key={col.status}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.status)}
              className="flex flex-col rounded-xl border border-border bg-muted/30 min-h-[500px] transition-colors duration-150 hover:border-border/80 shadow-xs"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between p-3.5 border-b border-border bg-muted/40 rounded-t-xl">
                <div className="flex items-center gap-2">
                  <ColIcon className={`size-4 ${col.color}`} />
                  <span className="text-sm font-semibold text-foreground tracking-tight">
                    {col.title}
                  </span>
                  <Badge
                    variant="secondary"
                    className="px-1.5 py-0 text-xs font-mono bg-muted text-muted-foreground border border-border"
                  >
                    {colTasks.length}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    setCreateStatus(col.status);
                    setCreateError(null);
                    setIsCreateOpen(true);
                  }}
                  className="size-6 text-muted-foreground hover:text-foreground hover:bg-muted"
                  aria-label={`Add task to ${col.title}`}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>

              {/* Cards Container */}
              <div className="flex-1 p-2.5 space-y-2.5 overflow-y-auto max-h-[calc(100vh-280px)]">
                {colTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl bg-background/50">
                    <span>Drop tasks here</span>
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onSelect={(t) => setSelectedTaskId(t.id)}
                      onStatusChange={handleStatusChange}
                      onDragStart={handleDragStart}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Details Modal */}
      {selectedTaskId && currentWorkspace && (
        <TaskDetailsModal
          taskId={selectedTaskId}
          workspaceId={currentWorkspace.id}
          members={members}
          onClose={() => setSelectedTaskId(null)}
          onTaskUpdated={() => loadData()}
          onTaskDeleted={() => {
            setSelectedTaskId(null);
            loadData();
          }}
        />
      )}

      {/* Create Task Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Add a new task to {project.name}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4">
            {createError && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/50 bg-destructive/10 p-2.5 text-xs text-destructive"
              >
                {createError}
              </div>
            )}
            <div className="space-y-1.5">
              <label
                htmlFor="task-title"
                className="text-xs font-medium text-foreground"
              >
                Task Title
              </label>
              <Input
                id="task-title"
                placeholder="e.g. Implement user profile endpoint"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                disabled={isCreating}
                autoFocus
                required
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="task-desc"
                className="text-xs font-medium text-foreground"
              >
                Description{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </label>
              <Textarea
                id="task-desc"
                placeholder="Key requirements and scope..."
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                disabled={isCreating}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label
                  htmlFor="create-status"
                  className="font-medium text-foreground"
                >
                  Status
                </label>
                <select
                  id="create-status"
                  value={createStatus}
                  onChange={(e) =>
                    setCreateStatus(e.target.value as TaskStatus)
                  }
                  disabled={isCreating}
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

              <div className="space-y-1">
                <label
                  htmlFor="create-priority"
                  className="font-medium text-foreground"
                >
                  Priority
                </label>
                <select
                  id="create-priority"
                  value={createPriority}
                  onChange={(e) =>
                    setCreatePriority(e.target.value as TaskPriority)
                  }
                  disabled={isCreating}
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

              <div className="space-y-1">
                <label
                  htmlFor="create-assignee"
                  className="font-medium text-foreground"
                >
                  Assignee
                </label>
                <select
                  id="create-assignee"
                  value={createAssigneeId}
                  onChange={(e) => setCreateAssigneeId(e.target.value)}
                  disabled={isCreating}
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
                      {m.user.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="create-due-date"
                  className="font-medium text-foreground"
                >
                  Due Date
                </label>
                <Input
                  id="create-due-date"
                  type="date"
                  value={createDueDate}
                  onChange={(e) => setCreateDueDate(e.target.value)}
                  disabled={isCreating}
                  className="h-8 text-xs"
                />
              </div>

              {createStatus !== "DONE" && (
                <div className="space-y-1 col-span-2">
                  <label
                    htmlFor="create-hours"
                    className="font-medium text-foreground"
                  >
                    Estimated Hours{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </label>
                  <Input
                    id="create-hours"
                    type="number"
                    step="0.5"
                    min="0.5"
                    placeholder="e.g. 4"
                    value={createEstimatedHours}
                    onChange={(e) => setCreateEstimatedHours(e.target.value)}
                    disabled={isCreating}
                    className="h-8 text-xs max-w-xs"
                  />
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  "Create Task"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
