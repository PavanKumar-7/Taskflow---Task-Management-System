import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit, resetRateLimits, getClientIp, isValidIp } from "@/lib/security/rate-limit";
import { escapeHtml, sendWorkspaceInvitationEmail } from "@/lib/email/service";
import { formatInternalErrorMessage } from "@/lib/api/http";
import { sanitizeNotificationLink } from "@/lib/notifications/service";
import { envSchema, resetEnvCache } from "@/lib/validation/env";
import nextConfig from "../next.config";

describe("Security Hardening & Regression Suite", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  describe("Rate Limiting Engine & Anti-Spoofing Client IP Resolution", () => {
    it("permits requests within configured window limits", () => {
      const config = { windowMs: 1000, max: 3 };
      const res1 = checkRateLimit("ip:127.0.0.1", config);
      const res2 = checkRateLimit("ip:127.0.0.1", config);
      const res3 = checkRateLimit("ip:127.0.0.1", config);

      assert.equal(res1.success, true);
      assert.equal(res1.remaining, 2);
      assert.equal(res2.success, true);
      assert.equal(res2.remaining, 1);
      assert.equal(res3.success, true);
      assert.equal(res3.remaining, 0);
    });

    it("strictly blocks requests exceeding threshold", () => {
      const config = { windowMs: 1000, max: 2 };
      checkRateLimit("ip:10.0.0.1", config);
      checkRateLimit("ip:10.0.0.1", config);

      const blocked = checkRateLimit("ip:10.0.0.1", config);
      assert.equal(blocked.success, false);
      assert.equal(blocked.remaining, 0);
      assert.ok(blocked.resetMs > 0);
    });

    it("isolates rate limit counters across distinct IP addresses", () => {
      const config = { windowMs: 1000, max: 1 };
      const clientA = checkRateLimit("ip:192.168.1.1", config);
      assert.equal(clientA.success, true);

      const clientABlocked = checkRateLimit("ip:192.168.1.1", config);
      assert.equal(clientABlocked.success, false);

      const clientB = checkRateLimit("ip:192.168.1.2", config);
      assert.equal(clientB.success, true);
    });

    it("validates IP addresses accurately and rejects invalid strings", () => {
      assert.equal(isValidIp("192.168.1.1"), true);
      assert.equal(isValidIp("10.0.0.254"), true);
      assert.equal(isValidIp("2001:db8::1"), true);
      assert.equal(isValidIp("::1"), true);

      assert.equal(isValidIp("999.999.999.999"), false);
      assert.equal(isValidIp("not-an-ip"), false);
      assert.equal(isValidIp("<script>"), false);
      assert.equal(isValidIp(""), false);
    });

    it("prioritizes cf-connecting-ip from Cloudflare edge proxy", () => {
      const req = new Request("http://localhost:3000", {
        headers: {
          "cf-connecting-ip": "198.51.100.5",
          "x-real-ip": "203.0.113.1",
          "x-forwarded-for": "1.2.3.4, 203.0.113.1",
        },
      });
      assert.equal(getClientIp(req), "198.51.100.5");
    });

    it("prioritizes x-real-ip when cf-connecting-ip is absent", () => {
      const req = new Request("http://localhost:3000", {
        headers: {
          "x-real-ip": "203.0.113.20",
          "x-forwarded-for": "1.1.1.1, 203.0.113.20",
        },
      });
      assert.equal(getClientIp(req), "203.0.113.20");
    });

    it("prevents X-Forwarded-For spoofing by taking the connecting ingress proxy IP", () => {
      // Attacker prepends '1.1.1.1', but proxy appends the real connecting IP '198.51.100.99'
      const req = new Request("http://localhost:3000", {
        headers: {
          "x-forwarded-for": "1.1.1.1, 198.51.100.99",
        },
      });
      assert.equal(getClientIp(req), "198.51.100.99");
    });

    it("falls back to 127.0.0.1 when no valid proxy headers are present", () => {
      const req = new Request("http://localhost:3000");
      assert.equal(getClientIp(req), "127.0.0.1");
    });
  });

  describe("HTML Escaping in Invitation Emails (Anti-XSS & Anti-Phishing)", () => {
    it("escapes malicious HTML tags and quotes from inviter and workspace names", () => {
      const maliciousName = `<script>alert("XSS")</script>`;
      const maliciousWorkspace = `Test & Co <a href="https://evil.com">Click Here</a>`;

      const safeName = escapeHtml(maliciousName);
      const safeWorkspace = escapeHtml(maliciousWorkspace);

      assert.equal(safeName, "&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;");
      assert.equal(
        safeWorkspace,
        "Test &amp; Co &lt;a href=&quot;https://evil.com&quot;&gt;Click Here&lt;/a&gt;"
      );
      assert.ok(!safeName.includes("<script>"));
      assert.ok(!safeWorkspace.includes("<a href="));
    });

    it("neutralizes single quotes, double quotes, and ampersands", () => {
      assert.equal(escapeHtml("Tom's & Jerry's \"Workspace\""), "Tom&#039;s &amp; Jerry&#039;s &quot;Workspace&quot;");
    });
  });

  describe("Internal Server Error Sanitization (Anti-Information-Disclosure)", () => {
    const originalEnv = process.env.NODE_ENV;

    it("masks internal database / Prisma connection errors in production", () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      const internalDbError = new Error(
        'Can\'t reach database server at "db.cluster-1234.us-east-1.rds.amazonaws.com":5432. Error: password authentication failed for user "postgres"'
      );

      const sanitized = formatInternalErrorMessage(internalDbError, "Failed to sign in.");
      assert.equal(sanitized, "Failed to sign in.");
      assert.ok(!sanitized.includes("amazonaws.com"));
      assert.ok(!sanitized.includes("postgres"));

      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    });

    it("retains descriptive error messages in non-production environments for developer diagnostics", () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "development";

      const devError = new Error("Unique constraint failed on field: email");
      const message = formatInternalErrorMessage(devError, "Default fallback");

      assert.equal(message, "Unique constraint failed on field: email");

      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    });
  });

  describe("Notification Link Validation (Anti-Open-Redirect & Script Injection)", () => {
    it("allows valid relative application routes", () => {
      assert.equal(sanitizeNotificationLink("/workspaces"), "/workspaces");
      assert.equal(sanitizeNotificationLink("/projects/proj_123"), "/projects/proj_123");
      assert.equal(sanitizeNotificationLink("/invite/abcdef"), "/invite/abcdef");
    });

    it("rejects malicious javascript: links", () => {
      assert.equal(sanitizeNotificationLink("javascript:alert(1)"), null);
    });

    it("rejects protocol-relative and external domain URLs", () => {
      assert.equal(sanitizeNotificationLink("//evil.com/phish"), null);
      assert.equal(sanitizeNotificationLink("https://evil.com/phish"), null);
      assert.equal(sanitizeNotificationLink("http://evil.com"), null);
    });

    it("rejects null, undefined, or empty inputs", () => {
      assert.equal(sanitizeNotificationLink(null), null);
      assert.equal(sanitizeNotificationLink(undefined), null);
      assert.equal(sanitizeNotificationLink("   "), null);
    });
  });

  describe("Production Environment Validation Guardrails", () => {
    it("rejects production configuration when AUTH_SECRET is missing or under 32 characters", () => {
      const resMissing = envSchema.safeParse({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://user:pass@localhost:5432/taskflow",
        APP_URL: "https://taskflow.example.com",
      });
      assert.equal(resMissing.success, false);

      const resShort = envSchema.safeParse({
        NODE_ENV: "production",
        AUTH_SECRET: "too-short",
        DATABASE_URL: "postgres://user:pass@localhost:5432/taskflow",
        APP_URL: "https://taskflow.example.com",
      });
      assert.equal(resShort.success, false);
    });

    it("rejects production configuration when DATABASE_URL is missing", () => {
      const res = envSchema.safeParse({
        NODE_ENV: "production",
        AUTH_SECRET: "a-secure-production-secret-with-at-least-32-chars!",
        APP_URL: "https://taskflow.example.com",
      });
      assert.equal(res.success, false);
      const errors = res.error?.issues.map((i) => i.path.join("."));
      assert.ok(errors?.includes("DATABASE_URL"));
    });

    it("rejects production configuration when APP_URL is non-HTTPS", () => {
      const resHttp = envSchema.safeParse({
        NODE_ENV: "production",
        AUTH_SECRET: "a-secure-production-secret-with-at-least-32-chars!",
        DATABASE_URL: "postgres://user:pass@localhost:5432/taskflow",
        APP_URL: "http://taskflow.example.com",
      });
      assert.equal(resHttp.success, false);
      assert.ok(resHttp.error?.issues.some((i) => i.message.includes("HTTPS")));
    });

    it("refuses to generate and dispatch invitations in production when APP_URL is missing", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      process.env.AUTH_SECRET = "production-secret-must-be-at-least-32-chars-long";
      process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/taskflow";
      delete process.env.APP_URL;
      resetEnvCache();

      const result = await sendWorkspaceInvitationEmail({
        to: "user@example.com",
        inviterName: "Alice",
        workspaceName: "Engineering",
        role: "MEMBER",
        rawToken: "token123",
      });

      assert.equal(result.sent, false);
      assert.equal(result.outcome, "failed");
      assert.match(result.error || "", /APP_URL must be configured/i);

      (process.env as Record<string, string | undefined>).NODE_ENV = "test";
      resetEnvCache();
    });

    it("rejects EMAIL_PROVIDER='preview' in production", () => {
      const res = envSchema.safeParse({
        NODE_ENV: "production",
        AUTH_SECRET: "a-secure-production-secret-with-at-least-32-chars!",
        DATABASE_URL: "postgres://user:pass@localhost:5432/taskflow",
        APP_URL: "https://taskflow.example.com",
        EMAIL_PROVIDER: "preview",
      });
      assert.equal(res.success, false);
      assert.ok(res.error?.issues.some((i) => i.path.includes("EMAIL_PROVIDER")));
    });

    it("accepts valid secure production configuration", () => {
      const res = envSchema.safeParse({
        NODE_ENV: "production",
        AUTH_SECRET: "a-secure-production-secret-with-at-least-32-chars!",
        DATABASE_URL: "postgres://user:pass@localhost:5432/taskflow",
        APP_URL: "https://taskflow.example.com",
        EMAIL_PROVIDER: "gmail",
        GMAIL_USER: "user@gmail.com",
        GMAIL_APP_PASSWORD: "app-password-16char",
      });
      assert.equal(res.success, true);
    });
  });

  describe("Security Headers Configuration in next.config.ts", () => {
    it("configures standard HSTS without misleading preload directive", async () => {
      const headers = await nextConfig.headers!();
      const globalHeaders = headers.find((h) => h.source === "/:path*");
      assert.ok(globalHeaders, "Global security headers must be configured");

      const hstsHeader = globalHeaders.headers.find((h) => h.key === "Strict-Transport-Security");
      assert.ok(hstsHeader, "Strict-Transport-Security must be set");
      assert.ok(hstsHeader.value.includes("max-age=31536000"));
      assert.ok(hstsHeader.value.includes("includeSubDomains"));
      assert.ok(!hstsHeader.value.includes("preload"), "preload directive must not be enabled prematurely");
    });
  });
});
