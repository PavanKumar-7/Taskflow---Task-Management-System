"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FolderKanban,
  Plus,
  MoreVertical,
  Archive,
  RotateCcw,
  Trash2,
  Edit2,
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/context/workspace-context";
import type { ProjectWithCounts } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ProjectList() {
  const { currentWorkspace, isLoading: isWorkspaceLoading } = useWorkspace();
  const [projects, setProjects] = useState<ProjectWithCounts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "ACTIVE" | "ARCHIVED"
  >("ACTIVE");

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Modal State
  const [editingProject, setEditingProject] =
    useState<ProjectWithCounts | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Confirm State
  const [deletingProject, setDeletingProject] =
    useState<ProjectWithCounts | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canManage = currentWorkspace
    ? currentWorkspace.role === "OWNER" || currentWorkspace.role === "ADMIN"
    : false;

  const reloadProjects = useCallback(async () => {
    if (!currentWorkspace) return;
    try {
      const res = await fetch(
        `/api/v1/workspaces/${currentWorkspace.id}/projects`,
        {
          cache: "no-store",
        },
      );
      const json = await res.json();
      if (json.success && json.data) {
        setProjects(json.data);
      }
    } catch {
      // Keep existing state
    }
  }, [currentWorkspace]);

  useEffect(() => {
    let ignore = false;

    async function loadInitial() {
      if (!currentWorkspace) {
        setProjects([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch(
          `/api/v1/workspaces/${currentWorkspace.id}/projects`,
          {
            cache: "no-store",
          },
        );
        const json = await res.json();
        if (ignore) return;

        if (!res.ok || !json.success) {
          setError(json.error?.message || "Failed to load projects.");
          return;
        }

        setProjects(json.data || []);
      } catch {
        if (!ignore) {
          setError("Network error while loading projects.");
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
  }, [currentWorkspace]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace) return;
    setCreateError(null);

    const trimmed = createName.trim();
    if (!trimmed || trimmed.length < 2) {
      setCreateError("Project name must be at least 2 characters long.");
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch(
        `/api/v1/workspaces/${currentWorkspace.id}/projects`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmed,
            description: createDescription.trim() || undefined,
          }),
        },
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json.error?.message || "Failed to create project.";
        setCreateError(msg);
        toast.error(msg);
        return;
      }

      toast.success(`Project "${trimmed}" created!`);
      setCreateName("");
      setCreateDescription("");
      setIsCreateOpen(false);
      reloadProjects();
    } catch {
      setCreateError("Network error. Please try again.");
      toast.error("Network error. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !editingProject) return;
    setEditError(null);

    const trimmed = editName.trim();
    if (!trimmed || trimmed.length < 2) {
      setEditError("Project name must be at least 2 characters long.");
      return;
    }

    setIsEditing(true);
    try {
      const res = await fetch(
        `/api/v1/workspaces/${currentWorkspace.id}/projects/${editingProject.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmed,
            description: editDescription.trim() || null,
          }),
        },
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json.error?.message || "Failed to update project.";
        setEditError(msg);
        toast.error(msg);
        return;
      }

      toast.success("Project updated successfully!");
      setEditingProject(null);
      reloadProjects();
    } catch {
      setEditError("Network error. Please try again.");
      toast.error("Network error. Please try again.");
    } finally {
      setIsEditing(false);
    }
  };

  const handleToggleArchive = async (project: ProjectWithCounts) => {
    if (!currentWorkspace) return;
    const newStatus = project.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE";

    try {
      const res = await fetch(
        `/api/v1/workspaces/${currentWorkspace.id}/projects/${project.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        },
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Failed to update project status.");
        return;
      }

      toast.success(
        newStatus === "ARCHIVED"
          ? `Project "${project.name}" archived.`
          : `Project "${project.name}" restored.`,
      );
      reloadProjects();
    } catch {
      toast.error("Network error. Please try again.");
    }
  };

  const handleDeleteProject = async () => {
    if (!currentWorkspace || !deletingProject) return;

    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/v1/workspaces/${currentWorkspace.id}/projects/${deletingProject.id}`,
        { method: "DELETE" },
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Failed to delete project.");
        return;
      }

      toast.success(`Project "${deletingProject.name}" deleted.`);
      setDeletingProject(null);
      reloadProjects();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredProjects = projects.filter((p) => {
    if (statusFilter === "ALL") return true;
    return p.status === statusFilter;
  });

  if (isWorkspaceLoading || isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-9 w-48 rounded bg-muted animate-pulse" />
          <div className="h-9 w-32 rounded bg-muted animate-pulse" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-44 rounded-xl border bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!currentWorkspace) {
    return (
      <Card className="text-center py-10">
        <CardHeader>
          <CardTitle>No workspace selected</CardTitle>
          <CardDescription>
            Select or create a workspace using the switcher in the header to
            view projects.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Header controls: Filter buttons and New Project button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-muted border border-border w-fit">
          <button
            type="button"
            onClick={() => setStatusFilter("ACTIVE")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              statusFilter === "ACTIVE"
                ? "bg-card text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Active ({projects.filter((p) => p.status === "ACTIVE").length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("ARCHIVED")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              statusFilter === "ARCHIVED"
                ? "bg-card text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Archived ({projects.filter((p) => p.status === "ARCHIVED").length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              statusFilter === "ALL"
                ? "bg-card text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({projects.length})
          </button>
        </div>

        {canManage && (
          <Button
            onClick={() => {
              setCreateError(null);
              setIsCreateOpen(true);
            }}
            size="sm"
            className="gap-1.5"
          >
            <Plus className="size-4" />
            <span>New Project</span>
          </Button>
        )}
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <Card className="text-center py-12 border-dashed">
          <CardHeader>
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2">
              <FolderKanban className="size-6" />
            </div>
            <CardTitle className="text-lg">
              {statusFilter === "ARCHIVED"
                ? "No archived projects"
                : "No projects found"}
            </CardTitle>
            <CardDescription className="max-w-md mx-auto text-sm">
              {statusFilter === "ARCHIVED"
                ? "Archived projects will appear here once archived."
                : "Create a project to start organizing tasks on the Kanban board."}
            </CardDescription>
          </CardHeader>
          {canManage && statusFilter !== "ARCHIVED" && (
            <CardContent>
              <Button
                onClick={() => {
                  setCreateError(null);
                  setIsCreateOpen(true);
                }}
                className="gap-2"
              >
                <Plus className="size-4" />
                <span>Create first project</span>
              </Button>
            </CardContent>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => {
            const progress =
              project.taskCount > 0
                ? Math.round((project.completedCount / project.taskCount) * 100)
                : 0;

            return (
              <Card
                key={project.id}
                className="group relative flex flex-col justify-between transition-shadow hover:shadow-md border"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/projects/${project.id}`}
                      className="flex-1 min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                    >
                      <CardTitle className="text-base font-semibold truncate hover:text-primary transition-colors">
                        {project.name}
                      </CardTitle>
                    </Link>

                    <div className="flex items-center gap-1 shrink-0">
                      <Badge
                        variant={
                          project.status === "ACTIVE" ? "default" : "secondary"
                        }
                        className="text-[10px] uppercase font-semibold"
                      >
                        {project.status}
                      </Badge>

                      {canManage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="size-7 opacity-70 hover:opacity-100"
                              aria-label="Project actions"
                            >
                              <MoreVertical className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingProject(project);
                                setEditName(project.name);
                                setEditDescription(project.description || "");
                                setEditError(null);
                              }}
                              className="cursor-pointer gap-2"
                            >
                              <Edit2 className="size-3.5" />
                              <span>Edit details</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleToggleArchive(project)}
                              className="cursor-pointer gap-2"
                            >
                              {project.status === "ACTIVE" ? (
                                <>
                                  <Archive className="size-3.5" />
                                  <span>Archive</span>
                                </>
                              ) : (
                                <>
                                  <RotateCcw className="size-3.5" />
                                  <span>Restore</span>
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeletingProject(project)}
                              className="cursor-pointer gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>

                  <CardDescription className="line-clamp-2 text-xs min-h-[2rem]">
                    {project.description || "No description provided."}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-0 space-y-3">
                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground font-medium">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="size-3 text-primary" />
                        {project.completedCount} / {project.taskCount} tasks
                        done
                      </span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="size-3" />
                      <span>
                        {new Date(project.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <Button variant="ghost" size="xs" asChild>
                      <Link href={`/projects/${project.id}`}>
                        Open Board &rarr;
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Project Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Projects group tasks together on a dedicated Kanban board.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-4">
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
                htmlFor="p-name"
                className="text-xs font-medium text-foreground"
              >
                Project Name
              </label>
              <Input
                id="p-name"
                placeholder="e.g. Website Redesign"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                disabled={isCreating}
                autoFocus
                required
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="p-desc"
                className="text-xs font-medium text-foreground"
              >
                Description{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </label>
              <Textarea
                id="p-desc"
                placeholder="Brief summary of project objectives..."
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                disabled={isCreating}
                rows={3}
              />
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
                  "Create Project"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog
        open={Boolean(editingProject)}
        onOpenChange={(open) => !open && setEditingProject(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project Details</DialogTitle>
            <DialogDescription>
              Update the name and description of this project.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateProject} className="space-y-4">
            {editError && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/50 bg-destructive/10 p-2.5 text-xs text-destructive"
              >
                {editError}
              </div>
            )}
            <div className="space-y-1.5">
              <label
                htmlFor="edit-p-name"
                className="text-xs font-medium text-foreground"
              >
                Project Name
              </label>
              <Input
                id="edit-p-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={isEditing}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="edit-p-desc"
                className="text-xs font-medium text-foreground"
              >
                Description
              </label>
              <Textarea
                id="edit-p-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                disabled={isEditing}
                rows={3}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingProject(null)}
                disabled={isEditing}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isEditing}>
                {isEditing ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deletingProject)}
        onOpenChange={(open) => !open && setDeletingProject(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong className="text-foreground">
                {deletingProject?.name}
              </strong>
              ? This will permanently delete all tasks and comments associated
              with this project.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingProject(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteProject}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete Project"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
