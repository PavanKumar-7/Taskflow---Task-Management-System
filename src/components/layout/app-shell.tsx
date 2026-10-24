"use client";

import { Suspense, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-svh bg-background text-foreground">
      <Suspense
        fallback={
          <div className="w-64 border-r border-sidebar-border bg-sidebar shrink-0 hidden md:block" />
        }
      >
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((value) => !value)}
        />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense
          fallback={
            <header className="relative z-30 h-14 border-b border-border bg-background" />
          }
        >
          <TopNav />
        </Suspense>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
