import { Suspense } from "react";
import { ProjectBoard } from "@/components/kanban/project-board";
import { Skeleton } from "@/components/ui/skeleton";

type PageProps = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{ taskId?: string }>;
};

export const metadata = {
  title: "Project Board",
  description: "Manage project tasks on the Kanban board",
};

async function BoardContent({ params, searchParams }: PageProps) {
  const { projectId } = await params;
  const sp = searchParams ? await searchParams : undefined;
  return <ProjectBoard projectId={projectId} initialTaskId={sp?.taskId} />;
}

function BoardLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  );
}

export default function ProjectDetailPage(props: PageProps) {
  return (
    <Suspense fallback={<BoardLoadingSkeleton />}>
      <BoardContent {...props} />
    </Suspense>
  );
}
