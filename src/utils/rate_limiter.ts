/**
 * In-process token-bucket rate limiter.
 *
 * Implements a sliding window counter per key. Each window resets after
 * `periodMs` milliseconds. The default limit matches the Tink API's
 * documented rate limit of 100 requests per hour per client.
 *
 * For distributed deployments (multiple Node.js processes), replace the
 * in-memory Map with a Redis-backed store.
 *
 * @example
 * ```ts
 * import { check } from "tink-client";
 *
 * const result = check("user:u1");
 * if (result === "rate_limited") {
 *   throw new Error("Too many requests — please slow down.");
 * }
 * ```
 */
import type { RateLimitInfo } from "../types";

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

const DEFAULT_LIMIT = 100;
const DEFAULT_PERIOD = 60 * 60 * 1000; // 1 hour

let _enabled = true;

/**
 * Enable or disable rate limiting globally.
 * Useful in testing — disable to skip rate checks in unit tests.
 */
export function setRateLimitingEnabled(enabled: boolean): void {
  _enabled = enabled;
}

/**
 * Checks whether a request is within the rate limit for the given key.
 * Increments the counter on "ok".
 *
 * @returns "ok" — request is allowed
 * @returns "rate_limited" — limit exceeded
 */
export function check(
  key: string,
  opts: { limit?: number; periodMs?: number } = {}
): "ok" | "rate_limited" {
  if (!_enabled) return "ok";
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const period = opts.periodMs ?? DEFAULT_PERIOD;
  const bucket = getBucket(key, period);
  if (bucket.count >= limit) return "rate_limited";
  bucket.count++;
  return "ok";
}

/**
 * Returns the number of remaining requests in the current window.
 * Returns "infinity" when rate limiting is disabled.
 */
export function remaining(
  key: string,
  opts: { limit?: number; periodMs?: number } = {}
): number | "infinity" {
  if (!_enabled) return "infinity";
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const period = opts.periodMs ?? DEFAULT_PERIOD;
  return Math.max(0, limit - getBucket(key, period).count);
}

/**
 * Resets the rate limit counter for the given key.
 * Useful for testing or admin tooling.
 */
export function reset(key: string): void {
  buckets.delete(bucketKey(key));
}

/**
 * Returns detailed rate limit information for the given key.
 */
export function info(key: string, opts: { limit?: number; periodMs?: number } = {}): RateLimitInfo {
  if (!_enabled) {
    return { count: 0, limit: "infinity", remaining: "infinity", resetsInMs: 0 };
  }
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const period = opts.periodMs ?? DEFAULT_PERIOD;
  const bucket = getBucket(key, period);
  return {
    count: bucket.count,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    resetsInMs: Math.max(0, bucket.windowStart + period - Date.now()),
  };
}

// ── private ──────────────────────────────────────────────────────────────────

function bucketKey(key: string): string {
  return `tink_node:rate_limit:${key}`;
}

function getBucket(key: string, period: number): Bucket {
  const bk = bucketKey(key);
  const now = Date.now();
  let b = buckets.get(bk);
  if (!b || now - b.windowStart >= period) {
    b = { count: 0, windowStart: now };
    buckets.set(bk, b);
  }
  return b;
}
