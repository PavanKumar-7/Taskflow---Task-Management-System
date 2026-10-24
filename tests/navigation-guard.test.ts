import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { createSessionToken, verifySessionToken } from "../src/lib/auth/session";
import { middleware } from "../src/middleware";

describe("Dashboard Authentication Guards & Logo Navigation", () => {
  const validPayload = {
    sub: "usr_1234567890",
    email: "user@example.com",
    name: "Test User",
  };

  describe("Logged Out Behavior", () => {
    it("returns null for non-existent or empty session token", async () => {
      const verified = await verifySessionToken("");
      assert.equal(verified, null);
    });

    it("returns null for tampered session token", async () => {
      const validToken = await createSessionToken(validPayload);
      const tampered = validToken.slice(0, -5) + "aaaaa";
      const verified = await verifySessionToken(tampered);
      assert.equal(verified, null);
    });

    it("server middleware redirects unauthenticated requests to /dashboard to /login", async () => {
      const req = new NextRequest("http://localhost:3000/dashboard");
      const res = await middleware(req);

      assert.equal(res.status, 307);
      const location = res.headers.get("location");
      assert.ok(location?.endsWith("/login"), `Expected redirect to /login, got ${location}`);
    });

    it("server middleware redirects unauthenticated requests to /workspaces to /login", async () => {
      const req = new NextRequest("http://localhost:3000/workspaces");
      const res = await middleware(req);

      assert.equal(res.status, 307);
      const location = res.headers.get("location");
      assert.ok(location?.endsWith("/login"));
    });

    it("server middleware redirects unauthenticated requests to /projects to /login", async () => {
      const req = new NextRequest("http://localhost:3000/projects");
      const res = await middleware(req);

      assert.equal(res.status, 307);
      const location = res.headers.get("location");
      assert.ok(location?.endsWith("/login"));
    });

    it("server middleware redirects unauthenticated requests to root (/) to /login", async () => {
      const req = new NextRequest("http://localhost:3000/");
      const res = await middleware(req);

      assert.equal(res.status, 307);
      const location = res.headers.get("location");
      assert.ok(location?.endsWith("/login"));
    });

    it("server middleware redirects requests with invalid/tampered token to /login", async () => {
      const req = new NextRequest("http://localhost:3000/dashboard", {
        headers: {
          cookie: "taskflow_session=invalid.tampered.token",
        },
      });
      const res = await middleware(req);

      assert.equal(res.status, 307);
      const location = res.headers.get("location");
      assert.ok(location?.endsWith("/login"));
    });

    it("verifies auth layout logo is non-navigable and does not link to /dashboard", () => {
      const authLayoutPath = path.resolve(__dirname, "../src/app/(auth)/layout.tsx");
      const content = fs.readFileSync(authLayoutPath, "utf-8");

      assert.equal(content.includes('href="/dashboard"'), false);
      assert.equal(content.includes("<Link"), false);
      assert.ok(content.includes('<div className="flex items-center gap-2 select-none">'));
      assert.ok(content.includes("TaskFlow"));
    });

    it("verifies login form does not contain guest bypass links to /dashboard", () => {
      const loginFormPath = path.resolve(__dirname, "../src/components/auth/login-form.tsx");
      const content = fs.readFileSync(loginFormPath, "utf-8");

      assert.equal(content.includes('href="/dashboard"'), false);
      assert.equal(content.includes("Continue as guest"), false);
    });

    it("verifies register form does not contain guest bypass links to /dashboard", () => {
      const registerFormPath = path.resolve(__dirname, "../src/components/auth/register-form.tsx");
      const content = fs.readFileSync(registerFormPath, "utf-8");

      assert.equal(content.includes('href="/dashboard"'), false);
      assert.equal(content.includes("Back to app"), false);
    });
  });

  describe("Logged In Behavior", () => {
    it("successfully validates authentic session tokens", async () => {
      const token = await createSessionToken(validPayload);
      const verified = await verifySessionToken(token);

      assert.ok(verified);
      assert.equal(verified?.sub, validPayload.sub);
      assert.equal(verified?.email, validPayload.email);
    });

    it("server middleware allows authenticated access to /dashboard via session cookie", async () => {
      const token = await createSessionToken(validPayload);
      const req = new NextRequest("http://localhost:3000/dashboard", {
        headers: {
          cookie: `taskflow_session=${token}`,
        },
      });

      const res = await middleware(req);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("location"), null);
    });

    it("server middleware allows authenticated access to /dashboard via Bearer token", async () => {
      const token = await createSessionToken(validPayload);
      const req = new NextRequest("http://localhost:3000/dashboard", {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const res = await middleware(req);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("location"), null);
    });

    it("server middleware redirects authenticated user from root (/) to /dashboard", async () => {
      const token = await createSessionToken(validPayload);
      const req = new NextRequest("http://localhost:3000/", {
        headers: {
          cookie: `taskflow_session=${token}`,
        },
      });

      const res = await middleware(req);
      assert.equal(res.status, 307);
      const location = res.headers.get("location");
      assert.ok(location?.endsWith("/dashboard"));
    });

    it("authenticated sidebar preserves navigation link to /dashboard", () => {
      const sidebarPath = path.resolve(__dirname, "../src/components/layout/sidebar.tsx");
      const content = fs.readFileSync(sidebarPath, "utf-8");

      assert.ok(content.includes('href="/dashboard"'));
      assert.ok(content.includes("TaskFlow"));
    });
  });
});
