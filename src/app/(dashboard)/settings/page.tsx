import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Profile and account settings will use the authenticated user from Phase 2."
      />
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          There is no signed-in user yet. This screen will load the current user
          from a server-side session, not from the browser.
        </CardContent>
      </Card>
    </div>
  );
}
