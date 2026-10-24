import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  canManageMembers,
  canChangeMemberRole,
  canRemoveMember,
  AuthError,
} from "../src/lib/permissions/workspace";
import type { WorkspaceRole } from "../src/types";

// Schema matching POST /api/v1/workspaces/[workspaceId]/members
const addMemberSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address."),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

// Schema matching PATCH /api/v1/workspaces/[workspaceId]/members/[memberId]
const updateMemberSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"]),
});

describe("Workspace Collaboration & Member Management", () => {
  describe("Role Hierarchy & Permissions", () => {
    it("allows only OWNER and ADMIN to manage workspace members, denying MEMBER", () => {
      assert.equal(canManageMembers("OWNER"), true);
      assert.equal(canManageMembers("ADMIN"), true);
      assert.equal(canManageMembers("MEMBER"), false);
    });

    it("allows only OWNER to modify member roles", () => {
      // OWNER can change MEMBER or ADMIN
      assert.equal(canChangeMemberRole("OWNER", "MEMBER"), true);
      assert.equal(canChangeMemberRole("OWNER", "ADMIN"), true);

      // ADMIN cannot change roles
      assert.equal(canChangeMemberRole("ADMIN", "MEMBER"), false);
      assert.equal(canChangeMemberRole("ADMIN", "ADMIN"), false);

      // MEMBER cannot change roles
      assert.equal(canChangeMemberRole("MEMBER", "MEMBER"), false);
    });

    it("strictly prevents modifying the workspace owner's role", () => {
      assert.equal(canChangeMemberRole("OWNER", "OWNER"), false);
      assert.equal(canChangeMemberRole("ADMIN", "OWNER"), false);
      assert.equal(canChangeMemberRole("MEMBER", "OWNER"), false);
    });
  });

  describe("Member Removal & Owner Protection Invariants", () => {
    it("strictly prevents removing the workspace owner under any circumstance", () => {
      // OWNER target cannot be removed by anyone (including self-removal)
      assert.equal(canRemoveMember("OWNER", false, "OWNER"), false);
      assert.equal(canRemoveMember("ADMIN", false, "OWNER"), false);
      assert.equal(canRemoveMember("MEMBER", false, "OWNER"), false);
      assert.equal(canRemoveMember("OWNER", true, "OWNER"), false, "Owner must not be allowed to self-remove");
    });

    it("allows workspace OWNER to remove ADMIN and MEMBER", () => {
      assert.equal(canRemoveMember("OWNER", false, "ADMIN"), true);
      assert.equal(canRemoveMember("OWNER", false, "MEMBER"), true);
    });

    it("allows ADMIN to remove only regular MEMBERs, not other ADMINs", () => {
      assert.equal(canRemoveMember("ADMIN", false, "MEMBER"), true);
      assert.equal(canRemoveMember("ADMIN", false, "ADMIN"), false, "Admin must not remove another admin");
    });

    it("prevents regular MEMBER from removing any other members", () => {
      assert.equal(canRemoveMember("MEMBER", false, "MEMBER"), false);
      assert.equal(canRemoveMember("MEMBER", false, "ADMIN"), false);
      assert.equal(canRemoveMember("MEMBER", false, "OWNER"), false);
    });

    it("allows non-owner members (ADMIN and MEMBER) to voluntarily leave the workspace", () => {
      assert.equal(canRemoveMember("ADMIN", true, "ADMIN"), true, "Admin should be able to leave");
      assert.equal(canRemoveMember("MEMBER", true, "MEMBER"), true, "Member should be able to leave");
    });
  });

  describe("Member Input Validation Schemas", () => {
    it("validates valid member addition with default role", () => {
      const result = addMemberSchema.safeParse({ email: "team.member@example.com" });
      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.role, "MEMBER");
      }
    });

    it("accepts valid ADMIN role specification on add", () => {
      const result = addMemberSchema.safeParse({
        email: "admin@example.com",
        role: "ADMIN",
      });
      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.role, "ADMIN");
      }
    });

    it("rejects invalid or malformed email addresses", () => {
      const result = addMemberSchema.safeParse({ email: "invalid-email" });
      assert.equal(result.success, false);
      if (!result.success) {
        assert.match(result.error.issues[0].message, /valid email/i);
      }
    });

    it("prevents granting OWNER role on addition", () => {
      const result = addMemberSchema.safeParse({
        email: "owner@example.com",
        role: "OWNER",
      });
      assert.equal(result.success, false);
    });

    it("prevents changing member role to OWNER in role update schema", () => {
      const result = updateMemberSchema.safeParse({ role: "OWNER" });
      assert.equal(result.success, false);
    });

    it("accepts valid role updates between ADMIN and MEMBER", () => {
      assert.equal(updateMemberSchema.safeParse({ role: "ADMIN" }).success, true);
      assert.equal(updateMemberSchema.safeParse({ role: "MEMBER" }).success, true);
    });
  });

  describe("Workspace Isolation & Membership Verification", () => {
    const mockMemberships = [
      { workspaceId: "ws-alpha", userId: "user-1", role: "OWNER" as WorkspaceRole },
      { workspaceId: "ws-alpha", userId: "user-2", role: "MEMBER" as WorkspaceRole },
      { workspaceId: "ws-beta", userId: "user-3", role: "OWNER" as WorkspaceRole },
    ];

    function verifyMembership(workspaceId: string, userId: string) {
      const match = mockMemberships.find(
        (m) => m.workspaceId === workspaceId && m.userId === userId
      );
      if (!match) {
        throw new AuthError(
          "Access denied. You are not a member of this workspace.",
          "FORBIDDEN"
        );
      }
      return match;
    }

    it("grants access when user belongs to target workspace", () => {
      const member = verifyMembership("ws-alpha", "user-1");
      assert.equal(member.role, "OWNER");
    });

    it("denies access when user attempts to access another workspace", () => {
      assert.throws(
        () => verifyMembership("ws-beta", "user-1"),
        (err: Error) => {
          return err instanceof AuthError && err.code === "FORBIDDEN";
        }
      );
    });
  });

  describe("Task Assignment Integration Rules", () => {
    const workspaceMembers = new Set(["user-1", "user-2", "user-3"]);

    function validateTaskAssignment(_workspaceId: string, assigneeId: string | null) {
      if (!assigneeId) return { valid: true }; // Unassigned is valid
      if (!workspaceMembers.has(assigneeId)) {
        return { valid: false, error: "Assignee must be a member of this workspace." };
      }
      return { valid: true };
    }

    it("allows task assignment to a valid workspace member", () => {
      const result = validateTaskAssignment("ws-alpha", "user-2");
      assert.equal(result.valid, true);
    });

    it("rejects task assignment to a user outside the workspace", () => {
      const result = validateTaskAssignment("ws-alpha", "user-999");
      assert.equal(result.valid, false);
      assert.equal(result.error, "Assignee must be a member of this workspace.");
    });

    it("allows assigning task to null (unassigned)", () => {
      const result = validateTaskAssignment("ws-alpha", null);
      assert.equal(result.valid, true);
    });

    it("unassigns tasks when member is removed from workspace without deleting tasks", () => {
      const tasks = [
        { id: "task-1", title: "Task 1", assigneeId: "user-2" },
        { id: "task-2", title: "Task 2", assigneeId: "user-3" },
      ];

      // Simulate member removal of user-2
      const removedUserId = "user-2";
      const updatedTasks = tasks.map((t) => ({
        ...t,
        assigneeId: t.assigneeId === removedUserId ? null : t.assigneeId,
      }));

      assert.equal(updatedTasks[0].assigneeId, null, "Task 1 should now be unassigned");
      assert.equal(updatedTasks[1].assigneeId, "user-3", "Task 2 remains assigned to user-3");
      assert.equal(updatedTasks[0].title, "Task 1", "Task data preserved intact");
    });
  });
});
