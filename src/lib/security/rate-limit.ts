/**
 * Lightweight sliding-window in-memory rate limiter.
 * Protects authentication, registration, invitations, and public endpoints
 * against brute-force, credential stuffing, and DoS attacks.
 *
 * ARCHITECTURAL NOTICE FOR PRODUCTION DEPLOYMENTS:
 * ===============================================
 * This rate limiter maintains state in Node.js process memory.
 * - Single-instance / Container Deployments (e.g. VPS, single Docker container, Render, Railway):
 *   State is preserved across requests within the process, providing full protection.
 * - Multi-instance / Serverless Deployments (e.g. Vercel Serverless, AWS Lambda, auto-scaled ECS tasks):
 *   Each serverless instance or container replica maintains an isolated in-memory store.
 *   Rate limits are enforced per-instance rather than globally across all instances.
 *   For multi-instance horizontal scaling, back this module with a shared datastore such as
 *   Upstash Redis (free tier available) using standard Redis INCR/EXPIRE primitives without
 *   changing the caller API signatures.
 */

type RateLimitRecord = {
  timestamps: number[];
};

const store = new Map<string, RateLimitRecord>();

const MAX_STORE_ENTRIES = 10000;

export interface RateLimitConfig {
  windowMs: number;
  max: number;
}

/**
 * Checks whether an action identified by key is within allowed limits.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): {
  success: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
} {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  let record = store.get(key);
  if (!record) {
    record = { timestamps: [] };
    store.set(key, record);
  }

  // Remove timestamps outside the sliding window
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

  // Periodic pruning of idle keys if map grows large
  if (store.size > MAX_STORE_ENTRIES) {
    pruneStore(windowStart);
  }

  if (record.timestamps.length >= config.max) {
    const oldest = record.timestamps[0] || now;
    const resetMs = Math.max(0, oldest + config.windowMs - now);
    return {
      success: false,
      limit: config.max,
      remaining: 0,
      resetMs,
    };
  }

  record.timestamps.push(now);

  return {
    success: true,
    limit: config.max,
    remaining: config.max - record.timestamps.length,
    resetMs: config.windowMs,
  };
}

/**
 * Reset rate limit memory for testing purposes.
 */
export function resetRateLimits(): void {
  store.clear();
}

/**
 * Prunes expired records to prevent unbounded memory growth.
 */
function pruneStore(threshold: number): void {
  for (const [key, record] of store.entries()) {
    record.timestamps = record.timestamps.filter((ts) => ts > threshold);
    if (record.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

/**
 * Helper to validate basic IPv4 or IPv6 structure.
 */
export function isValidIp(ip: string): boolean {
  if (!ip || ip.length > 45) return false;
  // IPv4 check: 4 dot-separated octets, each 0-255
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (ipv4Match) {
    return ipv4Match.slice(1).every((octet) => {
      const num = Number(octet);
      return num >= 0 && num <= 255;
    });
  }
  // Basic IPv6 check: contains colons and valid hex chars
  if (/^[a-fA-F0-9:]+$/.test(ip) && ip.includes(":")) {
    return true;
  }
  return false;
}

/**
 * Extracts a dependable client identifier (IP address) from request headers.
 *
 * Order of Precedence:
 * 1. `cf-connecting-ip`: Injected and overwritten by Cloudflare edge proxy (cannot be spoofed by client).
 * 2. `x-real-ip`: Injected by reverse proxies (Nginx, Vercel, AWS ALB) representing the immediate connecting IP.
 * 3. `x-forwarded-for`: If multiple IPs exist, takes the rightmost valid proxy-added IP to prevent client-injected
 *    first-element spoofing, or the single IP if only one was appended.
 * 4. Fallback: "127.0.0.1" for direct local connections.
 */
export function getClientIp(request: Request): string {
  // 1. Cloudflare true connecting IP
  const cfConnectingIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfConnectingIp && isValidIp(cfConnectingIp)) {
    return cfConnectingIp;
  }

  // 2. Reverse proxy / Vercel immediate client IP
  const xRealIp = request.headers.get("x-real-ip")?.trim();
  if (xRealIp && isValidIp(xRealIp)) {
    return xRealIp;
  }

  // 3. X-Forwarded-For chain: client, proxy1, proxy2...
  // In reverse proxy deployments, untrusted client values are prepended,
  // and trusted proxies append the real connecting client IP.
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const ips = xForwardedFor
      .split(",")
      .map((ip) => ip.trim())
      .filter(isValidIp);
    if (ips.length > 0) {
      // Return the most reliable entry (rightmost valid entry added by trusted ingress)
      return ips[ips.length - 1];
    }
  }

  return "127.0.0.1";
}
