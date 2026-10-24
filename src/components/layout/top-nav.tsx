"use client";

import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationBell } from "@/components/layout/notification-bell";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { GlobalSearch } from "@/components/layout/global-search";

export function TopNav() {
  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-3 md:px-4">
      <MobileNav />
      <WorkspaceSwitcher />
      <div className="relative ml-auto hidden min-w-0 flex-1 max-w-md sm:block">
        <GlobalSearch />
      </div>
      <div className="ml-auto flex items-center gap-1 sm:ml-0">
        <NotificationBell />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
