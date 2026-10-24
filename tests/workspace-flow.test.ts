import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import type { WorkspaceItem } from "../src/context/workspace-context";

// Validation schemas matching UI & API rules
const loginFormSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address."),
  password: z.string().min(1, "Password is required."),
});

const registerFormSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters long."),
  email: z.string().trim().email("Please provide a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters long."),
  workspaceName: z.string().trim().min(2).optional(),
});

const createWorkspaceFormSchema = z.object({
  name: z.string().trim().min(2, "Workspace name must be at least 2 characters long."),
});

// Workspace selection algorithm identical to WorkspaceProvider
function resolveActiveWorkspace(
  workspaces: WorkspaceItem[],
  storedId: string | null
): WorkspaceItem | null {
  if (storedId) {
    const found = workspaces.find((w) => w.id === storedId);
    if (found) return found;
  }
  return workspaces.length > 0 ? workspaces[0] : null;
}

// Initials generation algorithm identical to UserMenu
function getInitials(name?: string): string {
  if (!name) return "TF";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase() || "TF";
}

describe("Authentication UI & Workspace Flow", () => {
  describe("Form Validation Schemas", () => {
    it("validates valid login credentials", () => {
      const result = loginFormSchema.safeParse({
        email: "alice@example.com",
        password: "securePassword123",
      });
      assert.equal(result.success, true);
    });

    it("rejects malformed email for login", () => {
      const result = loginFormSchema.safeParse({
        email: "not-an-email",
        password: "securePassword123",
      });
      assert.equal(result.success, false);
      if (!result.success) {
        assert.match(result.error.issues[0].message, /valid email/i);
      }
    });

    it("rejects empty password for login", () => {
      const result = loginFormSchema.safeParse({
        email: "alice@example.com",
        password: "",
      });
      assert.equal(result.success, false);
    });

    it("validates valid registration inputs with optional workspace", () => {
      const result = registerFormSchema.safeParse({
        name: "Jane Doe",
        email: "jane@example.com",
        password: "password123",
        workspaceName: "Acme Corp",
      });
      assert.equal(result.success, true);
    });

    it("validates registration without optional workspace", () => {
      const result = registerFormSchema.safeParse({
        name: "Jane Doe",
        email: "jane@example.com",
        password: "password123",
      });
      assert.equal(result.success, true);
    });

    it("rejects short names (< 2 characters) for registration", () => {
      const result = registerFormSchema.safeParse({
        name: "J",
        email: "jane@example.com",
        password: "password123",
      });
      assert.equal(result.success, false);
      if (!result.success) {
        assert.match(result.error.issues[0].message, /at least 2 characters/i);
      }
    });

    it("rejects short passwords (< 6 characters) for registration", () => {
      const result = registerFormSchema.safeParse({
        name: "Jane Doe",
        email: "jane@example.com",
        password: "123",
      });
      assert.equal(result.success, false);
      if (!result.success) {
        assert.match(result.error.issues[0].message, /at least 6 characters/i);
      }
    });

    it("validates workspace creation name requirements", () => {
      const valid = createWorkspaceFormSchema.safeParse({ name: "Frontend Core" });
      assert.equal(valid.success, true);

      const invalid = createWorkspaceFormSchema.safeParse({ name: " " });
      assert.equal(invalid.success, false);
    });
  });

  describe("Workspace Selection and Persistence Logic", () => {
    const mockWorkspaces: WorkspaceItem[] = [
      {
        id: "ws-1",
        name: "Acme Main",
        slug: "acme-main",
        role: "OWNER",
      },
      {
        id: "ws-2",
        name: "Acme Secondary",
        slug: "acme-sec",
        role: "MEMBER",
      },
    ];

    it("selects stored workspace when matching ID exists in user memberships", () => {
      const active = resolveActiveWorkspace(mockWorkspaces, "ws-2");
      assert.ok(active);
      assert.equal(active.id, "ws-2");
      assert.equal(active.name, "Acme Secondary");
      assert.equal(active.role, "MEMBER");
    });

    it("falls back to the first workspace when stored ID does not match any membership", () => {
      const active = resolveActiveWorkspace(mockWorkspaces, "ws-nonexistent");
      assert.ok(active);
      assert.equal(active.id, "ws-1");
      assert.equal(active.role, "OWNER");
    });

    it("falls back to the first workspace when no ID is stored in localStorage", () => {
      const active = resolveActiveWorkspace(mockWorkspaces, null);
      assert.ok(active);
      assert.equal(active.id, "ws-1");
    });

    it("returns null safely when user has no workspaces", () => {
      const active = resolveActiveWorkspace([], "ws-1");
      assert.equal(active, null);
    });
  });

  describe("User Initials Formatting for Header UI", () => {
    it("extracts two-letter initials from multi-word names", () => {
      assert.equal(getInitials("Jane Doe"), "JD");
      assert.equal(getInitials("Alice Bob Charlie"), "AB");
    });

    it("extracts two-letter initials from single-word names", () => {
      assert.equal(getInitials("Admin"), "AD");
    });

    it("safely falls back to default when name is empty or undefined", () => {
      assert.equal(getInitials(""), "TF");
      assert.equal(getInitials(undefined), "TF");
    });
  });
});
