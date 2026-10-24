"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { WorkspaceRole, SessionUser } from "@/types";

export type WorkspaceItem = {
  id: string;
  name: string;
  slug: string;
  ownerId?: string;
  role: WorkspaceRole;
  joinedAt?: string;
  counts?: {
    members?: number;
    projects?: number;
    tasks?: number;
  };
};

type WorkspaceContextType = {
  user: SessionUser | null;
  workspaces: WorkspaceItem[];
  currentWorkspace: WorkspaceItem | null;
  isLoading: boolean;
  setCurrentWorkspace: (workspace: WorkspaceItem) => void;
  setCurrentWorkspaceById: (workspaceId: string) => void;
  refreshWorkspaces: () => Promise<void>;
  createWorkspace: (name: string) => Promise<{ success: boolean; error?: string; workspace?: WorkspaceItem }>;
  signOut: () => Promise<void>;
};

const STORAGE_KEY = "taskflow_active_workspace_id";

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [currentWorkspace, setCurrentWorkspaceState] = useState<WorkspaceItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const selectAndPersistWorkspace = useCallback((ws: WorkspaceItem | null) => {
    setCurrentWorkspaceState(ws);
    if (typeof window !== "undefined") {
      if (ws) {
        localStorage.setItem(STORAGE_KEY, ws.id);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const setCurrentWorkspace = useCallback(
    (workspace: WorkspaceItem) => {
      selectAndPersistWorkspace(workspace);
    },
    [selectAndPersistWorkspace]
  );

  const setCurrentWorkspaceById = useCallback(
    (workspaceId: string) => {
      const found = workspaces.find((w) => w.id === workspaceId);
      if (found) {
        selectAndPersistWorkspace(found);
      }
    },
    [workspaces, selectAndPersistWorkspace]
  );

  const refreshWorkspaces = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/auth/me", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401) {
          setUser(null);
          setWorkspaces([]);
          selectAndPersistWorkspace(null);
        }
        return;
      }

      const json = await res.json();
      if (json.success && json.data) {
        setUser(json.data.user);
        const wsList: WorkspaceItem[] = json.data.workspaces || [];
        setWorkspaces(wsList);

        // Retain current selection if valid, or pick from localStorage, or default to first
        let activeWs: WorkspaceItem | null = null;
        const storedId = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;

        if (storedId) {
          activeWs = wsList.find((w) => w.id === storedId) || null;
        }

        if (!activeWs && wsList.length > 0) {
          activeWs = wsList[0];
        }

        selectAndPersistWorkspace(activeWs);
      }
    } catch {
      // Network or parsing error: keep state as is
    } finally {
      setIsLoading(false);
    }
  }, [selectAndPersistWorkspace]);

  useEffect(() => {
    let ignore = false;

    async function loadInitial() {
      try {
        const res = await fetch("/api/v1/auth/me", { cache: "no-store" });
        if (ignore) return;

        if (!res.ok) {
          if (res.status === 401) {
            setUser(null);
            setWorkspaces([]);
            selectAndPersistWorkspace(null);
            router.push("/login");
          }
          return;
        }

        const json = await res.json();
        if (ignore) return;

        if (json.success && json.data) {
          setUser(json.data.user);
          const wsList: WorkspaceItem[] = json.data.workspaces || [];
          setWorkspaces(wsList);

          let activeWs: WorkspaceItem | null = null;
          const storedId = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;

          if (storedId) {
            activeWs = wsList.find((w) => w.id === storedId) || null;
          }

          if (!activeWs && wsList.length > 0) {
            activeWs = wsList[0];
          }

          selectAndPersistWorkspace(activeWs);
        }
      } catch {
        // Network or parsing error: keep state as is
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadInitial();

    return () => {
      ignore = true;
    };
  }, [selectAndPersistWorkspace, router]);

  const createWorkspace = async (
    name: string
  ): Promise<{ success: boolean; error?: string; workspace?: WorkspaceItem }> => {
    try {
      const res = await fetch("/api/v1/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        return {
          success: false,
          error: json.error?.message || "Failed to create workspace.",
        };
      }

      const created: WorkspaceItem = json.data;
      const updatedList = [...workspaces, created];
      setWorkspaces(updatedList);
      selectAndPersistWorkspace(created);

      return { success: true, workspace: created };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Failed to create workspace.",
      };
    }
  };

  const signOut = async () => {
    try {
      await fetch("/api/v1/auth/logout", {
        method: "POST",
      });
    } finally {
      setUser(null);
      setWorkspaces([]);
      selectAndPersistWorkspace(null);
      router.push("/login");
      router.refresh();
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{
        user,
        workspaces,
        currentWorkspace,
        isLoading,
        setCurrentWorkspace,
        setCurrentWorkspaceById,
        refreshWorkspaces,
        createWorkspace,
        signOut,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
