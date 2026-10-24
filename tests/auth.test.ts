import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";
import {
  createSessionToken,
  verifySessionToken,
  JWT_ISSUER,
  JWT_AUDIENCE,
} from "../src/lib/auth/session";
import { envSchema } from "../src/lib/validation/env";

describe("Stateless Authentication Logic", () => {
  describe("Password Hashing & Verification", () => {
    it("generates salted bcrypt hash that verifies successfully with correct password", async () => {
      const password = "Secr3tPassword!#99";
      const hash = await hashPassword(password);

      assert.ok(hash.startsWith("$2a$") || hash.startsWith("$2b$"));
      assert.notEqual(hash, password);

      const isValid = await verifyPassword(password, hash);
      assert.equal(isValid, true);
    });

    it("generates different salts and hashes for the same password across calls", async () => {
      const password = "identical_password";
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      assert.notEqual(hash1, hash2);
      assert.equal(await verifyPassword(password, hash1), true);
      assert.equal(await verifyPassword(password, hash2), true);
    });

    it("rejects invalid passwords against valid hash", async () => {
      const correctPassword = "correct_password";
      const hash = await hashPassword(correctPassword);

      const isWrongValid = await verifyPassword("wrong_password", hash);
      assert.equal(isWrongValid, false);

      const isEmptyValid = await verifyPassword("", hash);
      assert.equal(isEmptyValid, false);
    });
  });

  describe("Stateless JWT Token Lifecycle & Claims Validation", () => {
    const userPayload = {
      sub: "usr_123456789",
      email: "engineer@taskflow.dev",
      name: "Lead Engineer",
    };

    it("signs and verifies a valid JWT session token containing user payload, issuer, and audience", async () => {
      const token = await createSessionToken(userPayload);
      assert.equal(typeof token, "string");
      assert.ok(token.split(".").length === 3, "JWT should have header.payload.signature");

      const decoded = await verifySessionToken(token);
      assert.ok(decoded !== null);
      assert.equal(decoded.sub, userPayload.sub);
      assert.equal(decoded.email, userPayload.email);
      assert.equal(decoded.name, userPayload.name);
    });

    it("rejects token with mismatched issuer", async () => {
      const secret = new TextEncoder().encode("taskflow-default-development-secret-key-32chars!");
      const invalidIssuerToken = await new SignJWT({ email: userPayload.email, name: userPayload.name })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(userPayload.sub)
        .setIssuer("malicious-issuer")
        .setAudience(JWT_AUDIENCE)
        .setExpirationTime("1h")
        .sign(secret);

      const result = await verifySessionToken(invalidIssuerToken);
      assert.equal(result, null);
    });

    it("rejects token with mismatched audience", async () => {
      const secret = new TextEncoder().encode("taskflow-default-development-secret-key-32chars!");
      const invalidAudienceToken = await new SignJWT({ email: userPayload.email, name: userPayload.name })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(userPayload.sub)
        .setIssuer(JWT_ISSUER)
        .setAudience("wrong-audience-scope")
        .setExpirationTime("1h")
        .sign(secret);

      const result = await verifySessionToken(invalidAudienceToken);
      assert.equal(result, null);
    });

    it("rejects expired tokens safely", async () => {
      const secret = new TextEncoder().encode("taskflow-default-development-secret-key-32chars!");
      const expiredToken = await new SignJWT({ email: userPayload.email, name: userPayload.name })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(userPayload.sub)
        .setIssuer(JWT_ISSUER)
        .setAudience(JWT_AUDIENCE)
        .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 60) // Expired 1 minute ago
        .sign(secret);

      const result = await verifySessionToken(expiredToken);
      assert.equal(result, null);
    });

    it("rejects token signed with an untrusted or incorrect secret", async () => {
      const untrustedSecret = new TextEncoder().encode("attacker-forged-untrusted-secret-key-32chars!");
      const forgedToken = await new SignJWT({ email: userPayload.email, name: userPayload.name })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(userPayload.sub)
        .setIssuer(JWT_ISSUER)
        .setAudience(JWT_AUDIENCE)
        .setExpirationTime("1h")
        .sign(untrustedSecret);

      const result = await verifySessionToken(forgedToken);
      assert.equal(result, null);
    });

    it("rejects tampered tokens and returns null safely without throwing", async () => {
      const validToken = await createSessionToken(userPayload);
      const parts = validToken.split(".");
      const tamperedToken = `${parts[0]}.${parts[1]}.badsignature12345`;

      const result = await verifySessionToken(tamperedToken);
      assert.equal(result, null);
    });

    it("rejects malformed non-JWT strings safely", async () => {
      assert.equal(await verifySessionToken("not-a-jwt"), null);
      assert.equal(await verifySessionToken(""), null);
      assert.equal(await verifySessionToken("header.payload"), null);
    });

    it("stateless verification: token remains cryptographically valid until expiration regardless of client cookie state", async () => {
      const token = await createSessionToken(userPayload);
      // In stateless auth, server does not hold session state; token validation is idempotent and self-contained
      const verify1 = await verifySessionToken(token);
      const verify2 = await verifySessionToken(token);

      assert.deepEqual(verify1, verify2);
      assert.equal(verify1?.sub, userPayload.sub);
    });
  });

  describe("Production Environment Secret Validation", () => {
    it("fails validation in production if AUTH_SECRET is omitted", () => {
      const result = envSchema.safeParse({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://postgres:pass@localhost:5432/taskflow",
      });

      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(
          result.error.issues.some((i) => i.message.includes("AUTH_SECRET is mandatory in production")),
        );
      }
    });

    it("fails validation in production if AUTH_SECRET is shorter than 32 characters", () => {
      const result = envSchema.safeParse({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://postgres:pass@localhost:5432/taskflow",
        AUTH_SECRET: "short-secret-16c",
      });

      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(
          result.error.issues.some((i) => i.message.includes("at least 32 characters")),
        );
      }
    });

    it("succeeds in production when a secure 32+ character AUTH_SECRET is supplied", () => {
      const result = envSchema.safeParse({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://postgres:pass@localhost:5432/taskflow",
        AUTH_SECRET: "this-is-a-valid-production-secret-key-32-chars-long",
      });

      assert.equal(result.success, true);
    });

    it("safely provides development fallback when AUTH_SECRET is omitted in development mode", () => {
      const result = envSchema.safeParse({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://postgres:pass@localhost:5432/taskflow",
      });

      assert.equal(result.success, true);
      if (result.success) {
        assert.ok(result.data.AUTH_SECRET.length >= 32);
      }
    });
  });
});
