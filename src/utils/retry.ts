import { TinkError } from "./error";
import type { RetryOptions } from "../types";

/**
 * Retries an async function with exponential back-off and optional jitter.
 *
 * Only retries if the thrown error is a TinkError whose `retryable`
 * getter returns true (network errors, timeouts, 5xx responses).
 *
 * @param fn - Async function to execute and retry on failure
 * @param opts - Retry configuration
 * @returns The resolved value of `fn`
 * @throws The last TinkError if all attempts are exhausted
 *
 * @example
 * ```ts
 * const data = await withRetry(
 *   () => tink.accounts.listAccounts(),
 *   { maxAttempts: 5, baseDelayMs: 500 }
 * );
 * ```
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 1_000;
  const maxDelayMs = opts.maxDelayMs ?? 30_000;
  const jitterFactor = opts.jitterFactor ?? 0.1;
  const custom = opts.shouldRetry;

  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!(err instanceof TinkError)) throw err;
      const retryable =
        err.retryable || (custom ? custom({ type: err.type, status: err.status }) : false);
      if (!retryable || attempt >= maxAttempts) throw err;
      await sleep(calculateDelay(attempt, baseDelayMs, maxDelayMs, jitterFactor));
    }
  }
}

/**
 * Returns true if the given TinkError is safe to retry.
 */
export function shouldRetry(error: TinkError): boolean {
  return error.retryable;
}

/**
 * Computes the delay (ms) for a retry attempt using exponential back-off
 * with random jitter to avoid thundering herd.
 *
 * Formula: min(baseDelayMs * 2^(attempt-1), maxDelayMs) ± jitter
 */
export function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  jitterFactor: number
): number {
  const exp = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
  const jitter = exp * jitterFactor * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(exp + jitter));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
