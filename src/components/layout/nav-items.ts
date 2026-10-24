import {
  FolderKanban,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";

export const appNavItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/projects",
    label: "Projects",
    icon: FolderKanban,
  },
  {
    href: "/workspaces",
    label: "Workspaces",
    icon: Users,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
  },
] as const;
