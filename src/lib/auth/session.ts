import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { getEnv } from "@/lib/validation/env";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/types";

export const SESSION_COOKIE_NAME = "taskflow_session";
export const JWT_ISSUER = "taskflow";
export const JWT_AUDIENCE = "taskflow-api";

const SESSION_EXPIRATION = "7d";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

export type SessionPayload = {
  sub: string; // User ID
  email: string;
  name: string;
};

function getSecretKey(): Uint8Array {
  const env = getEnv();
  const secret = env.AUTH_SECRET;
  if (!secret) {
    if (env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET is not configured in production.");
    }
    return new TextEncoder().encode("taskflow-default-development-secret-key-32chars!");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const secret = getSecretKey();
  return new SignJWT({
    email: payload.email,
    name: payload.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(SESSION_EXPIRATION)
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const secret = getSecretKey();
    const { payload } = await jwtVerify(token, secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    if (!payload.sub || typeof payload.sub !== "string") {
      return null;
    }
    return {
      sub: payload.sub,
      email: (payload.email as string) || "",
      name: (payload.name as string) || "",
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  const env = getEnv();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function getSessionCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME);
  return cookie ? cookie.value : null;
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  const env = getEnv();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function extractAuthToken(): Promise<string | null> {
  // 1. Check Authorization: Bearer <token> header first
  try {
    const headerStore = await headers();
    const authHeader = headerStore.get("authorization");
    if (authHeader) {
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  } catch {
    // headers() might not be available in non-request contexts
  }

  // 2. Fall back to HttpOnly session cookie
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(SESSION_COOKIE_NAME);
    if (cookie && cookie.value) {
      return cookie.value;
    }
  } catch {
    // cookies() might not be available in non-request contexts
  }

  return null;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = await extractAuthToken();
  if (!token) {
    return null;
  }

  const payload = await verifySessionToken(token);
  if (!payload) {
    return null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
      },
    });
    return user;
  } catch {
    return null;
  }
}
