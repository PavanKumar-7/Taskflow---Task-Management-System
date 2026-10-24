import { z } from "zod";
import { jsonSuccess, jsonError, formatInternalErrorMessage } from "@/lib/api/http";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

const loginSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export async function POST(request: Request) {
  try {
    // Enforce rate limiting: 10 attempts per minute per IP
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`login:${clientIp}`, {
      windowMs: 60 * 1000,
      max: 10,
    });

    if (!rateLimit.success) {
      const retryAfterSeconds = Math.ceil(rateLimit.resetMs / 1000);
      return jsonError(
        "TOO_MANY_REQUESTS",
        "Too many login attempts. Please try again later.",
        {
          headers: {
            "Retry-After": retryAfterSeconds.toString(),
          },
        }
      );
    }

    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("BAD_REQUEST", parsed.error.issues[0]?.message || "Invalid input.");
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        memberships: {
          include: {
            workspace: true,
          },
        },
      },
    });

    if (!user) {
      return jsonError("UNAUTHENTICATED", "Invalid email or password.");
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return jsonError("UNAUTHENTICATED", "Invalid email or password.");
    }

    const token = await createSessionToken({
      sub: user.id,
      email: user.email,
      name: user.name,
    });
    await setSessionCookie(token);

    const workspaces = user.memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      ownerId: m.workspace.ownerId,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    }));

    return jsonSuccess({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      workspaces,
    });
  } catch (error) {
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to sign in.")
    );
  }
}
