"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Loader2,
  X,
  AlertCircle,
  Folder,
  CheckCircle2,
  Clock,
  Eye,
  CircleDot,
} from "lucide-react";
import { useWorkspace } from "@/context/workspace-context";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TaskWithRelations, TaskStatus, TaskPriority } from "@/types";

const STATUS_ICONS: Record<
  TaskStatus,
  React.ComponentType<{ className?: string }>
> = {
  TODO: CircleDot,
  IN_PROGRESS: Clock,
  IN_REVIEW: Eye,
  DONE: CheckCircle2,
};

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; textClass: string; bgClass: string }
> = {
  TODO: {
    label: "To Do",
    textClass: "text-slate-600 dark:text-slate-400",
    bgClass: "bg-slate-500/10",
  },
  IN_PROGRESS: {
    label: "In Progress",
    textClass: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-500/10",
  },
  IN_REVIEW: {
    label: "In Review",
    textClass: "text-amber-600 dark:text-amber-400",
    bgClass: "bg-amber-500/10",
  },
  DONE: {
    label: "Done",
    textClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-500/10",
  },
};

const PRIORITY_CONFIG: Record<
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

export function GlobalSearch() {
  const router = useRouter();
  const { currentWorkspace, isLoading: isWorkspaceLoading } = useWorkspace();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TaskWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      setSelectedIndex(-1);
      setIsOpen(false);
    } else {
      setIsOpen(true);
    }
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setIsLoading(false);
    setError(null);
    setSelectedIndex(-1);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // Debounced search effect
  useEffect(() => {
    const trimmed = query.trim();

    if (!currentWorkspace?.id || trimmed.length < 2) {
      return;
    }

    const timer = setTimeout(async () => {
      // Abort previous in-flight request if any
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/v1/workspaces/${currentWorkspace.id}/tasks?search=${encodeURIComponent(trimmed)}`,
          {
            signal: controller.signal,
            cache: "no-store",
          },
        );

        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          throw new Error(errJson?.error?.message || "Search request failed.");
        }

        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setResults(data.data);
          setIsOpen(true);
          setSelectedIndex(-1);
        } else {
          setResults([]);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return; // Ignore aborted requests
        }
        setError(
          err instanceof Error ? err.message : "Failed to search tasks.",
        );
        setResults([]);
        setIsOpen(true);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, currentWorkspace?.id]);

  const handleSelectTask = useCallback(
    (task: TaskWithRelations) => {
      setIsOpen(false);
      setQuery("");
      setResults([]);
      setSelectedIndex(-1);
      router.push(`/projects/${task.projectId}?taskId=${task.id}`);
    },
    [router],
  );

  // Auto-scroll the active keyboard selection into view inside the dropdown
  useEffect(() => {
    if (selectedIndex >= 0) {
      const selectedEl = document.getElementById(
        `search-result-${selectedIndex}`,
      );
      selectedEl?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setSelectedIndex(-1);
      inputRef.current?.blur();
      return;
    }

    if (!isOpen || results.length === 0) {
      if (e.key === "ArrowDown" && query.trim().length >= 2) {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelectTask(results[selectedIndex]);
      }
    }
  };

  const isDisabled = isWorkspaceLoading || !currentWorkspace;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls="global-search-dropdown"
          aria-activedescendant={
            selectedIndex >= 0 ? `search-result-${selectedIndex}` : undefined
          }
          placeholder={
            isDisabled
              ? "Select a workspace to search tasks..."
              : "Search tasks by title or description..."
          }
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => {
            if (query.trim().length >= 2) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
          className="h-8 pl-8 pr-8 text-xs focus-visible:ring-1 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
          aria-label="Search tasks"
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
          {isLoading ? (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          ) : query ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground focus:outline-none"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Search Results Dropdown */}
      {isOpen && query.trim().length >= 2 && (
        <div
          id="global-search-dropdown"
          role="listbox"
          tabIndex={-1}
          className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-[min(22.5rem,calc(100vh-5rem))] overflow-y-auto overscroll-contain rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
        >
          {error ? (
            <div className="flex items-center gap-2 p-3 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : isLoading && results.length === 0 ? (
            <div className="flex items-center justify-center gap-2 p-4 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" />
              <span>Searching workspace tasks...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              <p className="font-medium">No tasks found</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                No tasks match &ldquo;{query.trim()}&rdquo; in this workspace.
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              <div className="sticky top-0 z-10 bg-popover px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Matching Tasks ({results.length})
              </div>
              {results.map((task, index) => {
                const StatusIcon = STATUS_ICONS[task.status] || CircleDot;
                const statusConfig = STATUS_CONFIG[task.status];
                const priorityConfig = PRIORITY_CONFIG[task.priority];
                const isSelected = index === selectedIndex;

                return (
                  <button
                    key={task.id}
                    id={`search-result-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    type="button"
                    onClick={() => handleSelectTask(task)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      "flex w-full items-start justify-between gap-3 rounded-sm p-2 text-left text-xs transition-colors focus:outline-none",
                      isSelected
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted/60",
                    )}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {task.title}
                        </span>
                      </div>

                      {task.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1">
                          {task.description}
                        </p>
                      )}

                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {task.project && (
                          <span className="flex items-center gap-1 font-medium">
                            <Folder className="size-3 text-muted-foreground" />
                            {task.project.name}
                          </span>
                        )}
                        {task.dueDate && (
                          <span>
                            Due{" "}
                            {new Date(task.dueDate).toLocaleDateString(
                              undefined,
                              { month: "short", day: "numeric" },
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0 pt-0.5">
                      <div className="flex items-center gap-1">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
                            statusConfig.bgClass,
                            statusConfig.textClass,
                          )}
                        >
                          <StatusIcon className="size-3" />
                          {statusConfig.label}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] py-0 px-1 font-medium",
                            priorityConfig.badgeClass,
                          )}
                        >
                          {priorityConfig.label}
                        </Badge>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
