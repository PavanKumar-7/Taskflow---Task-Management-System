"use client";

import React, { useState, useSyncExternalStore } from "react";
import { Check, ChevronsUpDown, Plus, Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/context/workspace-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

export function WorkspaceSwitcher() {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const {
    workspaces,
    currentWorkspace,
    setCurrentWorkspace,
    createWorkspace,
    isLoading,
  } = useWorkspace();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    const trimmed = newWorkspaceName.trim();
    if (!trimmed || trimmed.length < 2) {
      setCreateError("Workspace name must be at least 2 characters long.");
      return;
    }

    setIsCreating(true);
    const result = await createWorkspace(trimmed);
    setIsCreating(false);

    if (result.success) {
      toast.success(`Workspace "${trimmed}" created!`);
      setNewWorkspaceName("");
      setIsDialogOpen(false);
    } else {
      setCreateError(result.error || "Failed to create workspace.");
      toast.error(result.error || "Failed to create workspace.");
    }
  };

  if (!mounted || isLoading) {
    return <div className="h-8 w-36 animate-pulse rounded-lg bg-muted" />;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="h-8 max-w-56 justify-between gap-2 px-2.5 text-xs font-medium"
            aria-label="Select workspace"
          >
            <div className="flex items-center gap-1.5 truncate">
              <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">
                {currentWorkspace ? currentWorkspace.name : "Select workspace"}
              </span>
            </div>
            {currentWorkspace && (
              <Badge
                variant="secondary"
                className="px-1 py-0 text-[10px] uppercase font-semibold"
              >
                {currentWorkspace.role}
              </Badge>
            )}
            <ChevronsUpDown className="size-3 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Workspaces
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {workspaces.length === 0 ? (
              <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                No workspaces available.
              </div>
            ) : (
              workspaces.map((ws) => {
                const isSelected = currentWorkspace?.id === ws.id;
                return (
                  <DropdownMenuItem
                    key={ws.id}
                    onClick={() => setCurrentWorkspace(ws)}
                    className="flex items-center justify-between cursor-pointer py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="size-4 shrink-0 text-muted-foreground" />
                      <span
                        className={cn(
                          "truncate text-sm",
                          isSelected && "font-semibold",
                        )}
                      >
                        {ws.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <Badge
                        variant="outline"
                        className="px-1 py-0 text-[10px] uppercase font-normal"
                      >
                        {ws.role}
                      </Badge>
                      {isSelected && (
                        <Check className="size-3.5 text-primary" />
                      )}
                    </div>
                  </DropdownMenuItem>
                );
              })
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              setCreateError(null);
              setIsDialogOpen(true);
            }}
            className="cursor-pointer gap-2 py-1.5"
          >
            <Plus className="size-4" />
            <span>Create workspace</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Workspace</DialogTitle>
            <DialogDescription>
              Workspaces isolate projects, tasks, and team members.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateWorkspace} className="space-y-4">
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
                htmlFor="ws-name"
                className="text-xs font-medium text-foreground"
              >
                Workspace name
              </label>
              <Input
                id="ws-name"
                placeholder="e.g. Engineering Team"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                disabled={isCreating}
                autoFocus
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
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
                  "Create Workspace"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
