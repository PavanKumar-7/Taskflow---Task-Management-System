"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useWorkspace } from "@/context/workspace-context";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusDistributionCard } from "@/components/dashboard/status-distribution-card";
import { ProjectSummariesCard } from "@/components/dashboard/project-summaries-card";
import { PriorityFocusCard } from "@/components/dashboard/priority-focus-card";
import {
  ActivityFeedCard,
  type ActivityItem,
} from "@/components/dashboard/activity-feed-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FolderKanban,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  RotateCw,
  Plus,
  Building2,
  AlertCircle,
} from "lucide-react";
import type { AnalyticsResult } from "@/lib/analytics/calculator";

export function DashboardView() {
  const { currentWorkspace, isLoading: isWorkspaceLoading } = useWorkspace();

  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async (workspaceId: string) => {
    setLoading(true);
    setError(null);

    try {
      const [analyticsRes, activityRes] = await Promise.all([
        fetch(`/api/v1/workspaces/${workspaceId}/analytics`, {
          cache: "no-store",
        }),
        fetch(`/api/v1/workspaces/${workspaceId}/activity?limit=8`, {
          cache: "no-store",
        }),
      ]);

      if (!analyticsRes.ok) {
        if (analyticsRes.status === 401) {
          setError("Session expired. Please log in again.");
          return;
        }
        const errJson = await analyticsRes.json().catch(() => null);
        throw new Error(
          errJson?.error?.message || "Failed to load workspace analytics.",
        );
      }

      const analyticsJson = await analyticsRes.json();
      if (analyticsJson.success && analyticsJson.data) {
        setAnalytics(analyticsJson.data);
      }

      if (activityRes.ok) {
        const activityJson = await activityRes.json();
        if (activityJson.success && Array.isArray(activityJson.data)) {
          setActivities(activityJson.data);
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const workspaceId = currentWorkspace?.id;

  useEffect(() => {
    let ignore = false;

    if (!workspaceId) {
      return;
    }

    async function loadData() {
      try {
        const [analyticsRes, activityRes] = await Promise.all([
          fetch(`/api/v1/workspaces/${workspaceId}/analytics`, {
            cache: "no-store",
          }),
          fetch(`/api/v1/workspaces/${workspaceId}/activity?limit=8`, {
            cache: "no-store",
          }),
        ]);

        if (ignore) return;

        if (!analyticsRes.ok) {
          if (analyticsRes.status === 401) {
            setError("Session expired. Please log in again.");
            return;
          }
          const errJson = await analyticsRes.json().catch(() => null);
          throw new Error(
            errJson?.error?.message || "Failed to load workspace analytics.",
          );
        }

        const analyticsJson = await analyticsRes.json();
        if (ignore) return;
        if (analyticsJson.success && analyticsJson.data) {
          setAnalytics(analyticsJson.data);
        }

        if (activityRes.ok) {
          const activityJson = await activityRes.json();
          if (ignore) return;
          if (activityJson.success && Array.isArray(activityJson.data)) {
            setActivities(activityJson.data);
          }
        }
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error
              ? err.message
              : "An unexpected error occurred.",
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      ignore = true;
    };
  }, [workspaceId]);

  // Loading state when initial workspace or data is resolving
  const isDataLoading =
    isWorkspaceLoading || (Boolean(workspaceId) && loading && !analytics);
  if (isDataLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-80 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Empty state when user has no workspace selected or memberships
  if (!currentWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Building2 className="size-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold">No Workspace Selected</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Please select or create a workspace to view team analytics, tasks, and
          project progress.
        </p>
        <Button className="mt-6 gap-2" asChild>
          <Link href="/workspaces">
            <Plus className="size-4" />
            Create Workspace
          </Link>
        </Button>
      </div>
    );
  }

  const metrics = analytics?.metrics;

  return (
    <div className="space-y-6">
      {/* Dashboard Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">
              Workspace Overview
            </h1>
            <Badge variant="secondary" className="text-xs font-medium">
              {currentWorkspace.name}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Real-time project health, task velocity, and team activity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchDashboardData(currentWorkspace.id)}
            disabled={loading}
            className="h-9 gap-1.5"
            aria-label="Refresh workspace analytics"
          >
            <RotateCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button size="sm" asChild className="h-9 gap-1.5">
            <Link href="/projects">
              <Plus className="size-3.5" />
              New Project
            </Link>
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void fetchDashboardData(currentWorkspace.id)}
            className="h-8 text-xs hover:bg-destructive/20"
          >
            Retry
          </Button>
        </div>
      )}

      {/* 4 Core Metric Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Projects Card */}
        <StatCard
          title="Projects"
          value={metrics ? metrics.activeProjects : 0}
          subtitle={`${metrics ? metrics.totalProjects : 0} total (${metrics ? metrics.archivedProjects : 0} archived)`}
          icon={FolderKanban}
          iconColor="text-blue-600 dark:text-blue-400"
          href="/projects"
        />

        {/* 2. Tasks & Completion Card */}
        <StatCard
          title="Total Tasks"
          value={metrics ? metrics.totalTasks : 0}
          subtitle={`${metrics ? metrics.completedTasks : 0} completed (${metrics ? metrics.inProgressTasks : 0} in progress)`}
          icon={CheckCircle2}
          iconColor="text-emerald-600 dark:text-emerald-400"
          progress={metrics ? metrics.completionRate : 0}
        />

        {/* 3. Overdue Tasks Card */}
        <StatCard
          title="Overdue Tasks"
          value={metrics ? metrics.overdueTasks : 0}
          subtitle="Excludes completed tasks"
          icon={AlertTriangle}
          iconColor={
            metrics && metrics.overdueTasks > 0
              ? "text-red-600 dark:text-red-400"
              : "text-muted-foreground"
          }
          badge={
            metrics && metrics.overdueTasks > 0
              ? { text: "Action required", variant: "destructive" }
              : undefined
          }
        />

        {/* 4. Due Soon Tasks Card */}
        <StatCard
          title="Due Next 7 Days"
          value={metrics ? metrics.dueSoonTasks : 0}
          subtitle="Impending deadlines"
          icon={Calendar}
          iconColor="text-amber-600 dark:text-amber-400"
        />
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column (2 Cols wide on desktop): Workflow Distribution & Projects */}
        <div className="space-y-6 lg:col-span-2">
          {/* Status Breakdown (TODO, IN_PROGRESS, IN_REVIEW, DONE) */}
          <StatusDistributionCard
            statusDistribution={
              analytics?.statusDistribution || {
                TODO: 0,
                IN_PROGRESS: 0,
                IN_REVIEW: 0,
                DONE: 0,
              }
            }
            priorityDistribution={
              analytics?.priorityDistribution || {
                LOW: 0,
                MEDIUM: 0,
                HIGH: 0,
                URGENT: 0,
              }
            }
            totalTasks={metrics?.totalTasks || 0}
            completionRate={metrics?.completionRate || 0}
          />

          {/* Project Progress Summaries */}
          <ProjectSummariesCard
            projectSummaries={analytics?.projectSummaries || []}
          />
        </div>

        {/* Right Column (1 Col wide on desktop): Priority Focus & Recent Activity */}
        <div className="space-y-6">
          {/* Priority Focus & Urgent Tasks */}
          <PriorityFocusCard
            topPriorityTasks={analytics?.topPriorityTasks || []}
            upcomingTasks={analytics?.upcomingTasks || []}
            overdueCount={metrics?.overdueTasks || 0}
            dueSoonCount={metrics?.dueSoonTasks || 0}
          />

          {/* Recent Activity Audit Feed */}
          <ActivityFeedCard
            activities={activities}
            isLoading={loading && activities.length === 0}
          />
        </div>
      </div>
    </div>
  );
}
