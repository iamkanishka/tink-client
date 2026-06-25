import { withRetry } from "../src/infrastructure/retry";
import { TinkError } from "../src/domain/errors";

import { describe, expect, it } from "@jest/globals";

describe("withRetry", () => {
  it("returns immediately on success", async () => {
    let calls = 0;
    const result = await withRetry(() => {
      calls++;
      return Promise.resolve("ok");
    });
    expect(result).toBe("ok");
    expect(calls).toBe(1);
  });

  it("retries on retryable error and succeeds", async () => {
    let calls = 0;
    const result = await withRetry(
      () => {
        calls++;
        if (calls < 3) throw TinkError.fromResponse(503, {});
        return Promise.resolve("done");
      },
      { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 5 },
    );
    expect(result).toBe("done");
    expect(calls).toBe(3);
  });

  it("does NOT retry non-retryable errors", async () => {
    let calls = 0;
    await expect(
      withRetry(
        () => {
          calls++;
          return Promise.reject(TinkError.fromResponse(401, {}));
        },
        { maxAttempts: 3, baseDelayMs: 1 },
      ),
    ).rejects.toMatchObject({ type: "authentication_error" });
    expect(calls).toBe(1);
  });

  it("exhausts all attempts and throws last error", async () => {
    let calls = 0;
    await expect(
      withRetry(
        () => {
          calls++;
          return Promise.reject(TinkError.fromResponse(500, { errorMessage: "server exploded" }));
        },
        { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2 },
      ),
    ).rejects.toMatchObject({ type: "api_error" });
    expect(calls).toBe(3);
  });

  it("respects custom shouldRetry predicate", async () => {
    let calls = 0;
    await expect(
      withRetry(
        () => {
          calls++;
          return Promise.reject(new TinkError({ type: "api_error", message: "custom" }));
        },
        {
          maxAttempts: 3,
          baseDelayMs: 1,
          shouldRetry: (e) => e.type === "api_error",
        },
      ),
    ).rejects.toBeDefined();
    expect(calls).toBe(3);
  });

  it("throws immediately when signal is already aborted", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(
      withRetry(() => Promise.resolve("ok"), { maxAttempts: 3 }, ctrl.signal),
    ).rejects.toMatchObject({ type: "timeout" });
  });
});
