import crypto from "node:crypto";

/**
 * Generate a cryptographically secure random invitation token
 * and its corresponding SHA-256 hash.
 *
 * Only the SHA-256 hash is ever stored in the database.
 * The raw token is sent only to the recipient via email/link.
 */
export function generateInvitationToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashInvitationToken(rawToken);
  return { rawToken, tokenHash };
}

/**
 * Hash an incoming invitation token using SHA-256.
 */
export function hashInvitationToken(rawToken: string): string {
  if (!rawToken || typeof rawToken !== "string") {
    throw new Error("Invalid token format for hashing.");
  }
  return crypto.createHash("sha256").update(rawToken.trim()).digest("hex");
}

/**
 * Check if an invitation has passed its expiration time.
 */
export function isInvitationExpired(expiresAt: Date | string): boolean {
  const expiryTime = new Date(expiresAt).getTime();
  return Number.isNaN(expiryTime) || expiryTime <= Date.now();
}

/**
 * Default expiration date (7 days from now).
 */
export function getInvitationExpiryDate(days = 7): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
