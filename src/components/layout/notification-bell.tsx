"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  Loader2,
  Mail,
  MessageSquare,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NotificationDetails, NotificationType } from "@/types";

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case "TASK_ASSIGNED":
      return <UserCheck className="size-4 text-blue-500 shrink-0 mt-0.5" />;
    case "TASK_COMMENT":
      return (
        <MessageSquare className="size-4 text-amber-500 shrink-0 mt-0.5" />
      );
    case "WORKSPACE_INVITATION":
      return <Mail className="size-4 text-emerald-500 shrink-0 mt-0.5" />;
    default:
      return <Bell className="size-4 text-primary shrink-0 mt-0.5" />;
  }
}

export function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationDetails[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/notifications?limit=20", {
        cache: "no-store",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setNotifications(json.data.notifications || []);
        setUnreadCount(json.data.unreadCount || 0);
      }
    } catch {
      // Background poll silently fails on network issues
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadInitial() {
      try {
        const res = await fetch("/api/v1/notifications?limit=20", {
          cache: "no-store",
        });
        const json = await res.json();
        if (ignore) return;
        if (res.ok && json.success) {
          setNotifications(json.data.notifications || []);
          setUnreadCount(json.data.unreadCount || 0);
        }
      } catch {
        // Silently ignore
      }
    }

    loadInitial();

    const interval = setInterval(() => {
      loadInitial();
    }, 30000);

    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, []);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setIsLoading(true);
      fetchNotifications().finally(() => setIsLoading(false));
    }
  };

  const handleMarkAsRead = async (
    notification: NotificationDetails,
    e?: React.MouseEvent,
  ) => {
    if (e) e.stopPropagation();

    if (notification.read) return;

    // Optimistically update UI
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await fetch(`/api/v1/notifications/${notification.id}/read`, {
        method: "PATCH",
      });
    } catch {
      // Re-sync on failure
      fetchNotifications();
    }
  };

  const handleNotificationClick = async (notification: NotificationDetails) => {
    await handleMarkAsRead(notification);
    setIsOpen(false);
    if (
      notification.link &&
      notification.link.startsWith("/") &&
      !notification.link.startsWith("//") &&
      !notification.link.includes(":")
    ) {
      router.push(notification.link);
    }
  };

  const handleMarkAllAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (unreadCount === 0) return;

    setIsMarkingAll(true);
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);

    try {
      const res = await fetch("/api/v1/notifications/mark-all-read", {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error("Failed to mark all as read.");
        fetchNotifications();
      } else {
        toast.success("All notifications marked as read.");
      }
    } catch {
      toast.error("Network error.");
      fetchNotifications();
    } finally {
      setIsMarkingAll(false);
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="View notifications"
          className="relative size-9 rounded-lg text-muted-foreground hover:text-foreground"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span
              data-testid="unread-badge"
              className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white shadow-xs shadow-primary animate-in zoom-in-75 duration-200"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-80 sm:w-96 p-0 shadow-lg border-border/80"
      >
        <DropdownMenuLabel className="p-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <Badge
                variant="secondary"
                className="px-1.5 py-0 text-[11px] font-medium"
              >
                {unreadCount} unread
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={isMarkingAll}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              {isMarkingAll ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <CheckCheck className="size-3.5" />
              )}
              <span>Mark all read</span>
            </Button>
          )}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <div className="max-h-[22rem] overflow-y-auto divide-y">
          {isLoading && notifications.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              <Loader2 className="size-5 animate-spin mx-auto mb-2 text-primary" />
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <div className="flex size-10 mx-auto items-center justify-center rounded-full bg-muted/60 text-muted-foreground mb-2">
                <Check className="size-5" />
              </div>
              <p className="text-sm font-medium text-foreground">
                You&apos;re all caught up
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                No new notifications at this time.
              </p>
            </div>
          ) : (
            <DropdownMenuGroup>
              {notifications.map((notification) => {
                return (
                  <DropdownMenuItem
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`flex items-start gap-3 p-3 cursor-pointer rounded-none text-left transition-colors ${
                      !notification.read
                        ? "bg-primary/10 hover:bg-primary/15"
                        : "hover:bg-muted opacity-80"
                    }`}
                  >
                    {getNotificationIcon(notification.type)}

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-foreground truncate">
                          {notification.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatRelativeTime(notification.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {notification.message}
                      </p>

                      {notification.link && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline pt-0.5">
                          View details
                          <ExternalLink className="size-2.5" />
                        </span>
                      )}
                    </div>

                    {!notification.read && (
                      <span
                        className="size-2 rounded-full bg-primary shrink-0 self-center"
                        title="Unread"
                      />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
