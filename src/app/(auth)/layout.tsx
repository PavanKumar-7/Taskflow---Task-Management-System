import { Workflow } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="hidden">
        <div className="flex items-center gap-2 select-none">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Workflow className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            TaskFlow
          </span>
        </div>
      </header>
      <AuthShell>{children}</AuthShell>
    </div>
  );
}
