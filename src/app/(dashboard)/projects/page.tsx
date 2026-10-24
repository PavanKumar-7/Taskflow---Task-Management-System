import { PageHeader } from "@/components/layout/page-header";
import { ProjectList } from "@/components/projects/project-list";

export const metadata = {
  title: "Projects",
  description: "View and manage workspace projects",
};

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Organize your team's workflows and tasks across dedicated project boards."
      />
      <ProjectList />
    </div>
  );
}
