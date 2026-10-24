import React from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderKanban, ArrowRight, Plus } from "lucide-react";
import type { ProjectSummary } from "@/lib/analytics/calculator";

type ProjectSummariesCardProps = {
  projectSummaries: ProjectSummary[];
};

export function ProjectSummariesCard({
  projectSummaries,
}: ProjectSummariesCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold">
              Project Progress
            </CardTitle>
            <CardDescription>
              Task completion status across workspace projects.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="h-8 gap-1 text-xs"
          >
            <Link href="/projects">
              View all
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 flex-1">
        {projectSummaries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
            <FolderKanban className="size-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium">No projects yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Create your first project to start organizing tasks and tracking
              progress.
            </p>
            <Button size="sm" className="mt-4 gap-1.5" asChild>
              <Link href="/projects">
                <Plus className="size-3.5" />
                Create project
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {projectSummaries.map((project) => (
              <div
                key={project.id}
                className="group relative flex flex-col justify-between rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/projects/${project.id}`}
                        className="font-medium text-sm text-foreground hover:underline truncate focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
                      >
                        {project.name}
                      </Link>
                      <Badge
                        variant={
                          project.status === "ACTIVE" ? "outline" : "secondary"
                        }
                        className="text-[10px] uppercase tracking-wider py-0 px-1.5 shrink-0"
                      >
                        {project.status.toLowerCase()}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {project.completedTasks} of {project.totalTasks} task
                      {project.totalTasks === 1 ? "" : "s"} completed
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 opacity-80 group-hover:opacity-100 group-hover:text-primary shrink-0"
                    asChild
                  >
                    <Link
                      href={`/projects/${project.id}`}
                      aria-label={`Open board for ${project.name}`}
                    >
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>

                <div className="mt-2.5 space-y-1">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Progress</span>
                    <span className="font-medium text-foreground">
                      {project.completionRate}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${project.completionRate}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
