import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import { getEnv, resetEnvCache } from "../src/lib/validation/env";
import {
  sendWorkspaceInvitationEmail,
  resolveEmailProvider,
  sendEmail,
} from "../src/lib/email/service";
import { getCapturedEmails, clearCapturedEmails } from "../src/lib/email/dev-inbox";

describe("Email Provider Layer & Multi-Provider Integration", () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  const originalCreateTransport = nodemailer.createTransport;

  beforeEach(() => {
    resetEnvCache();
    clearCapturedEmails();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    nodemailer.createTransport = originalCreateTransport;
    resetEnvCache();
    clearCapturedEmails();
  });

  const mockParams = {
    to: "engineer@example.com",
    inviterName: "Sarah Connor",
    workspaceName: "Engineering",
    role: "MEMBER",
    rawToken: "aabbccdd11223344556677889900aabbccdd11223344556677889900aabbccdd",
  };

  describe("Environment Configuration & Provider Precedence", () => {
    it("correctly parses EMAIL_PROVIDER, GMAIL_USER, and GMAIL_APP_PASSWORD", () => {
      process.env.EMAIL_PROVIDER = "gmail";
      process.env.GMAIL_USER = "user@gmail.com";
      process.env.GMAIL_APP_PASSWORD = "abcd efgh ijkl mnop";
      resetEnvCache();

      const env = getEnv();
      assert.equal(env.EMAIL_PROVIDER, "gmail");
      assert.equal(env.GMAIL_USER, "user@gmail.com");
      assert.equal(env.GMAIL_APP_PASSWORD, "abcd efgh ijkl mnop");
    });

    it("prioritizes explicit EMAIL_PROVIDER=gmail over Resend configuration", () => {
      process.env.EMAIL_PROVIDER = "gmail";
      process.env.GMAIL_USER = "user@gmail.com";
      process.env.GMAIL_APP_PASSWORD = "app-password-1234";
      process.env.RESEND_API_KEY = "re_resend_key";
      resetEnvCache();

      const resolution = resolveEmailProvider();
      assert.equal(resolution.success, true);
      if (resolution.success) {
        assert.equal(resolution.provider.name, "gmail");
      }
    });

    it("prioritizes explicit EMAIL_PROVIDER=resend over Gmail configuration", () => {
      process.env.EMAIL_PROVIDER = "resend";
      process.env.GMAIL_USER = "user@gmail.com";
      process.env.GMAIL_APP_PASSWORD = "app-password-1234";
      process.env.RESEND_API_KEY = "re_resend_key";
      resetEnvCache();

      const resolution = resolveEmailProvider();
      assert.equal(resolution.success, true);
      if (resolution.success) {
        assert.equal(resolution.provider.name, "resend");
      }
    });

    it("falls back to gmail when EMAIL_PROVIDER is omitted but Gmail credentials are set", () => {
      delete process.env.EMAIL_PROVIDER;
      delete process.env.EMAIL_DEV_MODE;
      process.env.GMAIL_USER = "user@gmail.com";
      process.env.GMAIL_APP_PASSWORD = "app-password-1234";
      delete process.env.RESEND_API_KEY;
      resetEnvCache();

      const resolution = resolveEmailProvider();
      assert.equal(resolution.success, true);
      if (resolution.success) {
        assert.equal(resolution.provider.name, "gmail");
      }
    });

    it("falls back to resend when EMAIL_PROVIDER is omitted and only RESEND_API_KEY is set", () => {
      delete process.env.EMAIL_PROVIDER;
      delete process.env.EMAIL_DEV_MODE;
      delete process.env.GMAIL_USER;
      delete process.env.GMAIL_APP_PASSWORD;
      process.env.RESEND_API_KEY = "re_test_key";
      resetEnvCache();

      const resolution = resolveEmailProvider();
      assert.equal(resolution.success, true);
      if (resolution.success) {
        assert.equal(resolution.provider.name, "resend");
      }
    });

    it("selects preview provider when EMAIL_DEV_MODE=preview is set", () => {
      delete process.env.EMAIL_PROVIDER;
      process.env.EMAIL_DEV_MODE = "preview";
      process.env.GMAIL_USER = "user@gmail.com";
      process.env.GMAIL_APP_PASSWORD = "password";
      resetEnvCache();

      const resolution = resolveEmailProvider();
      assert.equal(resolution.success, true);
      if (resolution.success) {
        assert.equal(resolution.provider.name, "preview");
      }
    });

    it("reports clear error when EMAIL_PROVIDER=gmail but credentials are missing", () => {
      process.env.EMAIL_PROVIDER = "gmail";
      delete process.env.GMAIL_USER;
      delete process.env.GMAIL_APP_PASSWORD;
      resetEnvCache();

      const resolution = resolveEmailProvider();
      assert.equal(resolution.success, false);
      if (!resolution.success) {
        assert.equal(resolution.reason, "PROVIDER_NOT_CONFIGURED");
        assert.match(resolution.error, /GMAIL_USER or GMAIL_APP_PASSWORD is not set/i);
      }
    });

    it("reports clear error when EMAIL_PROVIDER=resend but RESEND_API_KEY is missing", () => {
      process.env.EMAIL_PROVIDER = "resend";
      delete process.env.RESEND_API_KEY;
      resetEnvCache();

      const resolution = resolveEmailProvider();
      assert.equal(resolution.success, false);
      if (!resolution.success) {
        assert.equal(resolution.reason, "PROVIDER_NOT_CONFIGURED");
        assert.match(resolution.error, /RESEND_API_KEY is not set/i);
      }
    });
  });

  describe("Gmail Provider (Nodemailer SMTP)", () => {
    type MockMailOptions = {
      to?: string;
      from?: string;
      subject?: string;
      html?: string;
      text?: string;
    };

    type MockTransportOptions = {
      host?: string;
      port?: number;
      secure?: boolean;
      auth?: { user?: string; pass?: string };
      connectionTimeout?: number;
      greetingTimeout?: number;
      socketTimeout?: number;
    };

    it("successfully accepts email message via Gmail SMTP and passes correct recipient, subject, HTML, and text", async () => {
      process.env.EMAIL_PROVIDER = "gmail";
      process.env.GMAIL_USER = "sender@gmail.com";
      process.env.GMAIL_APP_PASSWORD = "abcd efgh ijkl mnop";
      resetEnvCache();

      let capturedMailOptions: MockMailOptions = {};
      let capturedTransportOptions: MockTransportOptions = {};

      // Mock Nodemailer transport
      nodemailer.createTransport = ((options: unknown) => {
        capturedTransportOptions = options as MockTransportOptions;
        return {
          sendMail: async (mailOptions: unknown) => {
            capturedMailOptions = mailOptions as MockMailOptions;
            return { messageId: "<gmail-mock-msg-id-123@smtp.gmail.com>" };
          },
        } as unknown as ReturnType<typeof nodemailer.createTransport>;
      }) as unknown as typeof nodemailer.createTransport;

      const result = await sendWorkspaceInvitationEmail(mockParams);

      assert.equal(result.sent, true);
      assert.equal(result.outcome, "accepted");
      assert.equal(result.provider, "gmail");
      assert.equal(result.providerId, "<gmail-mock-msg-id-123@smtp.gmail.com>");

      // Verify SMTP transport configuration
      assert.equal(capturedTransportOptions.host, "smtp.gmail.com");
      assert.equal(capturedTransportOptions.port, 465);
      assert.equal(capturedTransportOptions.secure, true);
      assert.equal(capturedTransportOptions.auth?.user, "sender@gmail.com");
      assert.equal(capturedTransportOptions.auth?.pass, "abcdefghijklmnop", "App password spaces must be stripped");
      assert.equal(capturedTransportOptions.connectionTimeout, 10000);
      assert.equal(capturedTransportOptions.greetingTimeout, 10000);
      assert.equal(capturedTransportOptions.socketTimeout, 10000);

      // Verify invitation mail contents (Requirement 1 & 2)
      assert.equal(capturedMailOptions.to, "engineer@example.com");
      assert.equal(capturedMailOptions.from, "TaskFlow <sender@gmail.com>");
      assert.ok(capturedMailOptions.subject?.includes("Engineering"));
      assert.ok(capturedMailOptions.html?.includes(mockParams.rawToken));
      assert.ok(capturedMailOptions.html?.includes("Accept Invitation"));
      assert.ok(capturedMailOptions.text?.includes(mockParams.rawToken));
    });

    it("handles Gmail authentication rejection (535) and returns sanitized error without exposing credentials", async () => {
      process.env.EMAIL_PROVIDER = "gmail";
      process.env.GMAIL_USER = "sender@gmail.com";
      process.env.GMAIL_APP_PASSWORD = "secret_password_123";
      resetEnvCache();

      nodemailer.createTransport = (() => {
        return {
          sendMail: async () => {
            throw new Error("535-5.7.8 Username and Password not accepted with pass: secret_password_123");
          },
        } as unknown as ReturnType<typeof nodemailer.createTransport>;
      }) as unknown as typeof nodemailer.createTransport;

      const result = await sendWorkspaceInvitationEmail(mockParams);

      assert.equal(result.sent, false);
      assert.equal(result.outcome, "failed");
      assert.equal(result.provider, "gmail");
      assert.equal(result.reason, "PROVIDER_ERROR");
      assert.match(result.error || "", /Gmail SMTP authentication failed/i);
      // Ensure password is never exposed in the error message
      assert.doesNotMatch(result.error || "", /secret_password_123/);
    });

    it("handles Gmail connection timeout gracefully with TIMEOUT reason", async () => {
      process.env.EMAIL_PROVIDER = "gmail";
      process.env.GMAIL_USER = "sender@gmail.com";
      process.env.GMAIL_APP_PASSWORD = "password";
      resetEnvCache();

      nodemailer.createTransport = (() => {
        return {
          sendMail: async () => {
            throw new Error("Connection timed out: ETIMEDOUT");
          },
        } as unknown as ReturnType<typeof nodemailer.createTransport>;
      }) as unknown as typeof nodemailer.createTransport;

      const result = await sendWorkspaceInvitationEmail(mockParams);

      assert.equal(result.sent, false);
      assert.equal(result.outcome, "failed");
      assert.equal(result.reason, "TIMEOUT");
      assert.match(result.error || "", /timed out/i);
    });

    it("handles Gmail network drops (ECONNRESET)", async () => {
      process.env.EMAIL_PROVIDER = "gmail";
      process.env.GMAIL_USER = "sender@gmail.com";
      process.env.GMAIL_APP_PASSWORD = "password";
      resetEnvCache();

      nodemailer.createTransport = (() => {
        return {
          sendMail: async () => {
            throw new Error("read ECONNRESET");
          },
        } as unknown as ReturnType<typeof nodemailer.createTransport>;
      }) as unknown as typeof nodemailer.createTransport;

      const result = await sendWorkspaceInvitationEmail(mockParams);

      assert.equal(result.sent, false);
      assert.equal(result.outcome, "failed");
      assert.equal(result.reason, "PROVIDER_ERROR");
      assert.match(result.error || "", /ECONNRESET/i);
    });
  });

  describe("Resend Provider (REST API)", () => {
    it("handles Resend sandbox recipient restriction (403) and returns truthful failure outcome", async () => {
      process.env.EMAIL_PROVIDER = "resend";
      process.env.RESEND_API_KEY = "re_test_key";
      resetEnvCache();

      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            statusCode: 403,
            message: "You can only send testing emails to your own email address (owner@gmail.com).",
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      };

      const result = await sendWorkspaceInvitationEmail(mockParams);

      assert.equal(result.sent, false);
      assert.equal(result.outcome, "failed");
      assert.equal(result.provider, "resend");
      assert.equal(result.reason, "PROVIDER_ERROR");
      assert.match(result.error || "", /only send testing emails to your own email/i);
      assert.ok(result.devEmailPreview, "Dev preview should be generated for testing");
    });

    it("handles Resend timeout (AbortError)", async () => {
      process.env.EMAIL_PROVIDER = "resend";
      process.env.RESEND_API_KEY = "re_test_key";
      resetEnvCache();

      globalThis.fetch = async () => {
        const err = new Error("The operation was aborted");
        err.name = "AbortError";
        throw err;
      };

      const result = await sendWorkspaceInvitationEmail(mockParams);

      assert.equal(result.sent, false);
      assert.equal(result.outcome, "failed");
      assert.equal(result.reason, "TIMEOUT");
    });
  });

  describe("Preview Provider & Local Email Capture", () => {
    it("captures email locally without calling Nodemailer or fetch", async () => {
      process.env.EMAIL_PROVIDER = "preview";
      resetEnvCache();

      let nodemailerCalled = false;
      let fetchCalled = false;

      nodemailer.createTransport = (() => {
        nodemailerCalled = true;
        throw new Error("Nodemailer must not be invoked in preview mode");
      }) as unknown as typeof nodemailer.createTransport;

      globalThis.fetch = async () => {
        fetchCalled = true;
        throw new Error("Fetch must not be invoked in preview mode");
      };

      const result = await sendWorkspaceInvitationEmail(mockParams);

      assert.equal(nodemailerCalled, false);
      assert.equal(fetchCalled, false);
      assert.equal(result.sent, false, "Must never report preview as sent to a real inbox");
      assert.equal(result.outcome, "preview");
      assert.equal(result.provider, "preview");

      // Verify dev preview payload
      assert.ok(result.devEmailPreview);
      assert.equal(result.devEmailPreview?.to, mockParams.to);
      assert.ok(result.devEmailPreview?.subject.includes(mockParams.workspaceName));
      assert.ok(result.devEmailPreview?.html.includes(mockParams.rawToken));
      assert.ok(result.devEmailPreview?.text.includes(mockParams.rawToken));

      // Verify in-memory dev inbox capture
      const captured = getCapturedEmails();
      assert.equal(captured.length, 1);
      assert.equal(captured[0].to, mockParams.to);
    });

    it("clears captured emails buffer cleanly via clearCapturedEmails()", () => {
      assert.equal(getCapturedEmails().length, 0);
    });
  });

  describe("Production Isolation Guards", () => {
    it("never returns devInviteUrl or devEmailPreview when NODE_ENV=production", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      process.env.DATABASE_URL = "postgres://mock:mock@localhost:5432/taskflow";
      process.env.APP_URL = "https://taskflow.example.com";
      process.env.AUTH_SECRET = "production-secret-must-be-at-least-32-chars-long";
      process.env.EMAIL_PROVIDER = "gmail";
      process.env.GMAIL_USER = "prod@gmail.com";
      process.env.GMAIL_APP_PASSWORD = "password";
      resetEnvCache();

      nodemailer.createTransport = (() => {
        return {
          sendMail: async () => ({ messageId: "<prod-msg-123@gmail.com>" }),
        } as unknown as ReturnType<typeof nodemailer.createTransport>;
      }) as unknown as typeof nodemailer.createTransport;

      const result = await sendWorkspaceInvitationEmail(mockParams);

      assert.equal(result.sent, true);
      assert.equal(result.outcome, "accepted");
      assert.equal(result.devInviteUrl, undefined, "devInviteUrl must not leak in production");
      assert.equal(result.devEmailPreview, undefined, "devEmailPreview must not leak in production");

      // Restore test environment
      (process.env as Record<string, string | undefined>).NODE_ENV = "test";
      resetEnvCache();
    });
  });

  describe("Common sendEmail({ to, subject, html, text }) Interface", () => {
    it("successfully routes through the common interface", async () => {
      process.env.EMAIL_PROVIDER = "preview";
      resetEnvCache();

      const result = await sendEmail({
        to: "recipient@example.com",
        subject: "Direct Test Subject",
        html: "<p>Hello</p>",
        text: "Hello",
      });

      assert.equal(result.outcome, "preview");
      assert.equal(result.provider, "preview");
    });
  });

  // Optional real-email integration test (strictly skipped unless RUN_REAL_EMAIL_TEST=1 is enabled)
  describe("Optional Real-Email Integration Test", () => {
    it("sends a live email via Gmail SMTP only when explicitly enabled", async (t) => {
      if (process.env.RUN_REAL_EMAIL_TEST !== "1") {
        t.skip("Skipped: RUN_REAL_EMAIL_TEST is not set to 1. This prevents real emails during automated test runs.");
        return;
      }

      const user = process.env.GMAIL_USER;
      const pass = process.env.GMAIL_APP_PASSWORD;
      const recipient = process.env.REAL_EMAIL_TEST_RECIPIENT;

      if (!user || !pass || !recipient) {
        throw new Error(
          "RUN_REAL_EMAIL_TEST=1 requires GMAIL_USER, GMAIL_APP_PASSWORD, and REAL_EMAIL_TEST_RECIPIENT."
        );
      }

      // Restore real nodemailer to send a real email
      nodemailer.createTransport = originalCreateTransport;

      const result = await sendEmail({
        to: recipient,
        subject: `TaskFlow Real Email Test — ${new Date().toISOString()}`,
        html: "<p>This is a real TaskFlow Gmail SMTP integration verification.</p>",
        text: "This is a real TaskFlow Gmail SMTP integration verification.",
      });

      assert.equal(result.outcome, "accepted");
      assert.equal(result.provider, "gmail");
      assert.ok(result.messageId);
    });
  });
});
