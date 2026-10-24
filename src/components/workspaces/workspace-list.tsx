"use client";

import React, { useState } from "react";
import { Building2, Check, Plus, Shield, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/context/workspace-context";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function WorkspaceList() {
  const {
    workspaces,
    currentWorkspace,
    setCurrentWorkspace,
    createWorkspace,
    isLoading,
  } = useWorkspace();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) {
      setError("Workspace name must be at least 2 characters long.");
      return;
    }

    setIsCreating(true);
    const result = await createWorkspace(trimmed);
    setIsCreating(false);

    if (result.success) {
      toast.success(`Workspace "${trimmed}" created!`);
      setName("");
      setIsDialogOpen(false);
    } else {
      setError(result.error || "Failed to create workspace.");
      toast.error(result.error || "Failed to create workspace.");
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-40 rounded-xl bg-muted/50 animate-pulse border"
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Your Workspaces
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage your workspaces and team collaborations
          </p>
        </div>
        <Button
          onClick={() => setIsDialogOpen(true)}
          className="gap-1.5"
          size="sm"
        >
          <Plus className="size-4" />
          <span>New Workspace</span>
        </Button>
      </div>

      {workspaces.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No workspaces found</CardTitle>
            <CardDescription>
              Create your first workspace to start collaborating and managing
              projects.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
              <Plus className="size-4" />
              <span>Create Workspace</span>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws) => {
            const isActive = currentWorkspace?.id === ws.id;

            return (
              <Card
                key={ws.id}
                className={
                  isActive
                    ? "border-primary/60 bg-primary/[0.04] shadow-md shadow-primary/10"
                    : undefined
                }
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/20 shadow-xs shadow-primary/10">
                        <Building2 className="size-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold">
                          {ws.name}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {ws.slug}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge
                      variant={isActive ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {ws.role}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Shield className="size-3.5" />
                      <span>Role: {ws.role}</span>
                    </div>
                    {ws.counts?.members !== undefined && (
                      <div className="flex items-center gap-1">
                        <Users className="size-3.5" />
                        <span>{ws.counts.members} members</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    {isActive ? (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                        <Check className="size-4" />
                        <span>Active workspace</span>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentWorkspace(ws)}
                      >
                        Switch to workspace
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Workspace</DialogTitle>
            <DialogDescription>
              A workspace lets you organize tasks, projects, and collaborate
              with your team.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/50 bg-destructive/10 p-2.5 text-xs text-destructive"
              >
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <label
                htmlFor="modal-ws-name"
                className="text-xs font-medium text-foreground"
              >
                Workspace name
              </label>
              <Input
                id="modal-ws-name"
                placeholder="e.g. Acme Marketing"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
