import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AuthError,
  canManageMembers,
  canManageProjects,
  canDeleteWorkspace,
} from "../src/lib/permissions/workspace";

describe("Workspace Authorization & Permission Rules", () => {
  describe("Role Capabilities", () => {
    it("allows only OWNER and ADMIN to manage workspace members, denying MEMBER", () => {
      assert.equal(canManageMembers("OWNER"), true);
      assert.equal(canManageMembers("ADMIN"), true);
      assert.equal(canManageMembers("MEMBER"), false);
    });

    it("allows only OWNER and ADMIN to manage projects, denying MEMBER", () => {
      assert.equal(canManageProjects("OWNER"), true);
      assert.equal(canManageProjects("ADMIN"), true);
      assert.equal(canManageProjects("MEMBER"), false);
    });

    it("strictly allows only OWNER to delete a workspace, denying ADMIN and MEMBER", () => {
      assert.equal(canDeleteWorkspace("OWNER"), true);
      assert.equal(canDeleteWorkspace("ADMIN"), false);
      assert.equal(canDeleteWorkspace("MEMBER"), false);
    });
  });

  describe("Typed Authorization Errors", () => {
    it("properly constructs and formats AuthError for missing authentication", () => {
      const unauth = new AuthError("Authentication required.", "UNAUTHENTICATED");
      assert.equal(unauth.code, "UNAUTHENTICATED");
      assert.equal(unauth.message, "Authentication required.");
      assert.ok(unauth instanceof Error);
    });

    it("properly constructs and formats AuthError for cross-workspace access attempts", () => {
      const forbidden = new AuthError(
        "Access denied. You are not a member of this workspace.",
        "FORBIDDEN",
      );
      assert.equal(forbidden.code, "FORBIDDEN");
      assert.ok(forbidden.message.includes("not a member of this workspace"));
    });

    it("properly constructs and formats AuthError for role restriction violations", () => {
      const roleError = new AuthError(
        "Action requires one of the following roles: OWNER, ADMIN.",
        "FORBIDDEN",
      );
      assert.equal(roleError.code, "FORBIDDEN");
      assert.ok(roleError.message.includes("requires one of the following roles"));
    });
  });
});
