/**
 * Exponential back-off retry with full-jitter.
 */

import { TinkError } from "../domain/errors.js";
import type { RetryOptions } from "../domain/types.js";

const DEFAULTS = { maxAttempts: 3, baseDelayMs: 1_000, maxDelayMs: 30_000, jitterFactor: 0.1 };

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
  signal?: AbortSignal,
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? DEFAULTS.maxAttempts;
  const baseDelayMs = opts.baseDelayMs ?? DEFAULTS.baseDelayMs;
  const maxDelayMs = opts.maxDelayMs ?? DEFAULTS.maxDelayMs;
  const jitter = opts.jitterFactor ?? DEFAULTS.jitterFactor;
  const shouldRetry = opts.shouldRetry ?? defaultShouldRetry;

  let lastErr: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) throw new TinkError({ type: "timeout", message: "Request aborted" });

    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retryable =
        err instanceof TinkError
          ? shouldRetry({
              type: err.type,
              ...(err.status !== undefined ? { status: err.status } : {}),
            })
          : false;
      if (!retryable || attempt === maxAttempts - 1) throw err;
      const expo = baseDelayMs * Math.pow(2, attempt);
      const capped = Math.min(expo, maxDelayMs);
      const delay = capped * (1 + jitter * Math.random());
      await sleep(delay, signal);
    }
  }

  throw lastErr;
}

function defaultShouldRetry(err: { type: string; status?: number }): boolean {
  if (err.type === "network_error" || err.type === "timeout") return true;
  if (err.status === undefined) return false;
  return [408, 429, 500, 502, 503, 504].includes(err.status);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(id);
      reject(new TinkError({ type: "timeout", message: "Request aborted during retry delay" }));
    });
  });
}
