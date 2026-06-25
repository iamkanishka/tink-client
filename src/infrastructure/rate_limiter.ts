/**
 * Token-bucket rate limiter — instance-based (no module-level mutable state).
 *
 * Mirrors the Go `infrastructure/ratelimit` package.
 * Tokens refill at `rate` per second, capped at `burst`.
 */

export interface RateLimiterOptions {
  /** Tokens refilled per second. Set to 0 or Infinity to disable. */
  rate: number;
  /** Maximum token capacity (burst size). */
  burst: number;
}

/** A token-bucket rate limiter. */
export class RateLimiter {
  private tokens: number;
  private last: number;
  private readonly rate: number;
  private readonly burst: number;
  private readonly disabled: boolean;

  constructor(opts: RateLimiterOptions) {
    this.rate = opts.rate;
    this.burst = opts.burst;
    this.tokens = opts.burst;
    this.last = Date.now();
    this.disabled = opts.rate <= 0 || !isFinite(opts.rate);
  }

  /** A rate limiter that never blocks — use when rate limiting is disabled. */
  static unlimited(): RateLimiter {
    return new RateLimiter({ rate: Infinity, burst: Infinity });
  }

  /**
   * Attempts to consume one token without blocking.
   * Returns `true` if a token was available, `false` if the bucket is empty.
   */
  tryConsume(): boolean {
    if (this.disabled) return true;
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  /**
   * Waits until a token is available, then consumes it.
   * Resolves immediately when the bucket is non-empty.
   */
  async consume(signal?: AbortSignal): Promise<void> {
    if (this.disabled) return;
    for (;;) {
      if (signal?.aborted) throw new Error("Aborted while waiting for rate limit token");
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const waitMs = ((1 - this.tokens) / this.rate) * 1_000;
      await new Promise<void>((resolve, reject) => {
        const id = setTimeout(resolve, waitMs);
        signal?.addEventListener("abort", () => {
          clearTimeout(id);
          reject(new Error("Aborted while waiting for rate limit token"));
        });
      });
    }
  }

  /** Current token count (read-only, for diagnostics). */
  get currentTokens(): number {
    this.refill();
    return this.tokens;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.last) / 1_000;
    this.tokens = Math.min(this.burst, this.tokens + elapsed * this.rate);
    this.last = now;
  }
}
