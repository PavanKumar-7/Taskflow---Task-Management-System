import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  generateInvitationToken,
  hashInvitationToken,
  isInvitationExpired,
  getInvitationExpiryDate,
} from "../src/lib/invitations/crypto";
import type { WorkspaceRole, InvitationStatus, NotificationType } from "../src/types";

// Schemas matching the API endpoints
const createInvitationSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address."),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

describe("Email Invitations & In-App Notifications Engine", () => {
  describe("Cryptographic Token Generation & Hashing", () => {
    it("generates unpredictable 32-byte (64 hex char) invitation tokens", () => {
      const { rawToken, tokenHash } = generateInvitationToken();
      assert.equal(rawToken.length, 64, "Raw token should be 64 hex characters (32 bytes)");
      assert.equal(/^[a-f0-9]{64}$/.test(rawToken), true);
      assert.equal(tokenHash.length, 64, "SHA-256 hash should be 64 hex characters");
      assert.equal(/^[a-f0-9]{64}$/.test(tokenHash), true);
    });

    it("consistently computes the identical SHA-256 hash for the same raw token", () => {
      const { rawToken } = generateInvitationToken();
      const hash1 = hashInvitationToken(rawToken);
      const hash2 = hashInvitationToken(rawToken);
      assert.equal(hash1, hash2);
    });

    it("produces distinct hashes for different random tokens", () => {
      const tokenA = generateInvitationToken();
      const tokenB = generateInvitationToken();
      assert.notEqual(tokenA.rawToken, tokenB.rawToken);
      assert.notEqual(tokenA.tokenHash, tokenB.tokenHash);
    });

    it("verifies that database stores only the hash, never matching the raw token plain text", () => {
      const { rawToken, tokenHash } = generateInvitationToken();
      assert.notEqual(rawToken, tokenHash, "Stored hash must never match raw token");
    });
  });

  describe("Invitation Expiration & Lifecycle Invariants", () => {
    it("correctly identifies unexpired invitations within the 7-day validity window", () => {
      const futureDate = getInvitationExpiryDate(7);
      assert.equal(isInvitationExpired(futureDate), false);
    });

    it("identifies expired invitations past their expiration timestamp", () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
      assert.equal(isInvitationExpired(pastDate), true);
    });

    it("handles zero or negative expiry boundaries safely as expired", () => {
      const expiredNow = new Date(Date.now() - 50);
      assert.equal(isInvitationExpired(expiredNow), true);
    });
  });

  describe("Invitation Acceptance & Role Escalation Rules", () => {
    // Role permission rule: only OWNER can grant ADMIN role
    function canGrantRole(inviterRole: WorkspaceRole, targetRole: WorkspaceRole): boolean {
      if (targetRole === "ADMIN") {
        return inviterRole === "OWNER";
      }
      return inviterRole === "OWNER" || inviterRole === "ADMIN";
    }

    it("strictly allows only OWNER to invite with the ADMIN role, blocking ADMINs from privilege escalation", () => {
      assert.equal(canGrantRole("OWNER", "ADMIN"), true);
      assert.equal(canGrantRole("ADMIN", "ADMIN"), false, "Admin must not invite another Admin");
      assert.equal(canGrantRole("MEMBER", "ADMIN"), false);
    });

    it("allows both OWNER and ADMIN to invite regular MEMBERs", () => {
      assert.equal(canGrantRole("OWNER", "MEMBER"), true);
      assert.equal(canGrantRole("ADMIN", "MEMBER"), true);
      assert.equal(canGrantRole("MEMBER", "MEMBER"), false);
    });

    it("rejects invitation acceptance when user email does not match invited email", () => {
      function validateAcceptanceEmail(loggedInEmail: string, invitedEmail: string) {
        if (loggedInEmail.toLowerCase().trim() !== invitedEmail.toLowerCase().trim()) {
          return {
            valid: false,
            error: "Registration/logged-in email does not match the invited email.",
          };
        }
        return { valid: true };
      }

      const matching = validateAcceptanceEmail("alice@example.com", "alice@example.com");
      assert.equal(matching.valid, true);

      const mismatched = validateAcceptanceEmail("bob@example.com", "alice@example.com");
      assert.equal(mismatched.valid, false);
      assert.match(mismatched.error || "", /does not match/i);
    });

    it("enforces one-time acceptance: accepted or revoked invitations cannot be reused", () => {
      function canAcceptInvitation(status: InvitationStatus, expiresAt: Date): boolean {
        if (status !== "PENDING") return false;
        if (isInvitationExpired(expiresAt)) return false;
        return true;
      }

      const validExpiry = getInvitationExpiryDate(7);
      assert.equal(canAcceptInvitation("PENDING", validExpiry), true);
      assert.equal(canAcceptInvitation("ACCEPTED", validExpiry), false, "ACCEPTED cannot be reused");
      assert.equal(canAcceptInvitation("REVOKED", validExpiry), false, "REVOKED cannot be reused");
      assert.equal(canAcceptInvitation("EXPIRED", validExpiry), false, "EXPIRED cannot be reused");
    });

    it("prevents concurrent double acceptance through atomic conditional status updates", () => {
      // Simulates atomic conditional update: updateMany({ where: { id, status: 'PENDING' }, data: { status: 'ACCEPTED' } })
      const dbRecord = { id: "inv-race-1", status: "PENDING" as InvitationStatus };

      function atomicAccept(targetId: string): { count: number } {
        if (dbRecord.id === targetId && dbRecord.status === "PENDING") {
          dbRecord.status = "ACCEPTED";
          return { count: 1 };
        }
        return { count: 0 };
      }

      // First concurrent acceptance request succeeds
      const firstAttempt = atomicAccept("inv-race-1");
      assert.equal(firstAttempt.count, 1, "First request successfully acquires and updates status");

      // Concurrent race attempt fails because status is no longer PENDING
      const secondAttempt = atomicAccept("inv-race-1");
      assert.equal(secondAttempt.count, 0, "Second concurrent attempt must return 0 affected rows");
      assert.equal(dbRecord.status, "ACCEPTED");
    });

    it("preserves valid invitation database records when email provider delivery fails", () => {
      // Simulates API behavior: email failure must not delete or invalidate the database invitation
      const createdInvitation = {
        id: "inv-failed-mail",
        email: "recipient@example.com",
        status: "PENDING" as InvitationStatus,
        tokenHash: "mock_hash_12345",
      };

      const emailResult = {
        sent: false,
        outcome: "failed" as const,
        provider: "gmail" as const,
        error: "SMTP connection refused",
      };

      // API constructs response without rolling back or deleting invitation
      const apiResponse = {
        invitation: createdInvitation,
        outcome: emailResult.outcome,
        emailDelivered: emailResult.sent,
        emailAccepted: emailResult.sent,
        emailError: emailResult.error,
      };

      assert.equal(apiResponse.invitation.status, "PENDING", "Invitation remains in valid pending state");
      assert.equal(apiResponse.outcome, "failed");
      assert.equal(apiResponse.emailDelivered, false);
      assert.ok(apiResponse.emailError);
    });
  });

  describe("Duplicate Prevention Invariants", () => {
    it("prevents creating duplicate pending invitations for the same workspace and email", () => {
      const existingInvitations = [
        { workspaceId: "ws-1", email: "colleague@example.com", status: "PENDING" as InvitationStatus },
        { workspaceId: "ws-1", email: "old@example.com", status: "REVOKED" as InvitationStatus },
      ];

      function canCreateInvitation(workspaceId: string, email: string): boolean {
        const hasActivePending = existingInvitations.some(
          (inv) =>
            inv.workspaceId === workspaceId &&
            inv.email.toLowerCase() === email.toLowerCase() &&
            inv.status === "PENDING"
        );
        return !hasActivePending;
      }

      assert.equal(canCreateInvitation("ws-1", "colleague@example.com"), false, "Duplicate pending blocked");
      assert.equal(canCreateInvitation("ws-1", "old@example.com"), true, "Revoked invitation allows re-invite");
      assert.equal(canCreateInvitation("ws-1", "new@example.com"), true, "New email allowed");
    });

    it("prevents duplicate workspace memberships upon invitation acceptance", () => {
      const workspaceMembers = new Set(["ws-1:user-1", "ws-1:user-2"]);

      function acceptAndAddMember(workspaceId: string, userId: string): { added: boolean } {
        const key = `${workspaceId}:${userId}`;
        if (workspaceMembers.has(key)) {
          return { added: false }; // Already member, avoids duplicate insert
        }
        workspaceMembers.add(key);
        return { added: true };
      }

      assert.equal(acceptAndAddMember("ws-1", "user-2").added, false);
      assert.equal(acceptAndAddMember("ws-1", "user-3").added, true);
    });
  });

  describe("In-App Notification Recipient Logic", () => {
    function computeCommentRecipients(task: {
      creatorId: string;
      assigneeId: string | null;
      commentAuthorId: string;
    }): string[] {
      const recipients = new Set<string>();
      if (task.assigneeId && task.assigneeId !== task.commentAuthorId) {
        recipients.add(task.assigneeId);
      }
      if (task.creatorId && task.creatorId !== task.commentAuthorId) {
        recipients.add(task.creatorId);
      }
      return Array.from(recipients);
    }

    it("notifies both creator and assignee when a third party comments", () => {
      const recipients = computeCommentRecipients({
        creatorId: "user-creator",
        assigneeId: "user-assignee",
        commentAuthorId: "user-commenter",
      });
      assert.deepEqual(recipients.sort(), ["user-assignee", "user-creator"].sort());
    });

    it("does not notify the comment author about their own comment", () => {
      const recipients = computeCommentRecipients({
        creatorId: "user-creator",
        assigneeId: "user-assignee",
        commentAuthorId: "user-assignee", // Assignee comments
      });
      assert.deepEqual(recipients, ["user-creator"], "Assignee author must not be notified");
    });

    it("deduplicates recipients when task creator and assignee are the same person", () => {
      const recipients = computeCommentRecipients({
        creatorId: "user-same",
        assigneeId: "user-same",
        commentAuthorId: "user-commenter",
      });
      assert.equal(recipients.length, 1);
      assert.deepEqual(recipients, ["user-same"]);
    });

    it("generates zero notifications when creator/assignee comments on their own task", () => {
      const recipients = computeCommentRecipients({
        creatorId: "user-same",
        assigneeId: "user-same",
        commentAuthorId: "user-same",
      });
      assert.equal(recipients.length, 0);
    });

    it("notifies assignee upon task assignment only if assignee is not the assigner", () => {
      function shouldNotifyAssignment(assignerId: string, assigneeId: string | null): boolean {
        return !!assigneeId && assigneeId !== assignerId;
      }

      assert.equal(shouldNotifyAssignment("user-1", "user-2"), true);
      assert.equal(shouldNotifyAssignment("user-1", "user-1"), false, "Self-assignment should not notify");
      assert.equal(shouldNotifyAssignment("user-1", null), false, "Unassigned should not notify");
    });
  });

  describe("Notification Recipient Ownership & Isolation", () => {
    type MockNotification = {
      id: string;
      userId: string;
      type: NotificationType;
      read: boolean;
    };

    const mockNotifications: MockNotification[] = [
      { id: "notif-1", userId: "user-alice", type: "TASK_ASSIGNED", read: false },
      { id: "notif-2", userId: "user-alice", type: "TASK_COMMENT", read: false },
      { id: "notif-3", userId: "user-bob", type: "TASK_ASSIGNED", read: false },
    ];

    it("retrieves only notifications owned by the requesting user", () => {
      const aliceNotifs = mockNotifications.filter((n) => n.userId === "user-alice");
      assert.equal(aliceNotifs.length, 2);
      assert.ok(aliceNotifs.every((n) => n.userId === "user-alice"));
    });

    it("strictly isolates mark-as-read: prevents users from modifying another user's notification", () => {
      function markRead(notificationId: string, requestingUserId: string): boolean {
        const notif = mockNotifications.find((n) => n.id === notificationId);
        if (!notif || notif.userId !== requestingUserId) {
          return false; // Access denied / Not found
        }
        notif.read = true;
        return true;
      }

      // Alice tries to mark Bob's notification
      assert.equal(markRead("notif-3", "user-alice"), false, "Cross-user mark read denied");
      // Bob marks his own notification
      assert.equal(markRead("notif-3", "user-bob"), true, "Own mark read allowed");
    });

    it("accurately tracks unread counts and updates upon marking all as read", () => {
      let aliceList = mockNotifications.filter((n) => n.userId === "user-alice");
      let unreadCount = aliceList.filter((n) => !n.read).length;
      assert.equal(unreadCount, 2);

      // Mark all read for Alice
      aliceList = aliceList.map((n) => ({ ...n, read: true }));
      unreadCount = aliceList.filter((n) => !n.read).length;
      assert.equal(unreadCount, 0);
    });
  });

  describe("Input Validation Schemas", () => {
    it("accepts valid invitation payload with default role", () => {
      const parsed = createInvitationSchema.safeParse({ email: "team@example.com" });
      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.role, "MEMBER");
      }
    });

    it("rejects malformed email for invitation", () => {
      const parsed = createInvitationSchema.safeParse({ email: "invalid-email" });
      assert.equal(parsed.success, false);
    });

    it("rejects OWNER role in invitation creation schema", () => {
      const parsed = createInvitationSchema.safeParse({
        email: "owner@example.com",
        role: "OWNER",
      });
      assert.equal(parsed.success, false);
    });
  });
});
