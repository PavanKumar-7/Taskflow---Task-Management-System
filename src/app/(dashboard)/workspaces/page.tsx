import { PageHeader } from "@/components/layout/page-header";
import { WorkspaceList } from "@/components/workspaces/workspace-list";
import { WorkspaceMembers } from "@/components/workspaces/workspace-members";

export const metadata = {
  title: "Workspaces",
  description: "Manage your TaskFlow workspaces and team memberships",
};

export default function WorkspacesPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Workspaces & Collaboration"
        description="Collaborate with your team across isolated workspaces with role-based access."
      />
      <WorkspaceList />
      <WorkspaceMembers />
    </div>
  );
}
