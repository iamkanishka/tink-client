import { withRetry, shouldRetry, calculateDelay } from "../utils/retry";
import { TinkError } from "../utils/error";

// ── calculateDelay ────────────────────────────────────────────────────────

describe("calculateDelay()", () => {
  it("returns baseDelayMs on first attempt with 0 jitter", () => {
    expect(calculateDelay(1, 1000, 30_000, 0)).toBe(1000);
  });

  it("doubles delay on second attempt (exponential back-off)", () => {
    expect(calculateDelay(2, 1000, 30_000, 0)).toBe(2000);
  });

  it("quadruples delay on third attempt", () => {
    expect(calculateDelay(3, 1000, 30_000, 0)).toBe(4000);
  });

  it("caps at maxDelayMs", () => {
    expect(calculateDelay(20, 1000, 5000, 0)).toBe(5000);
  });

  it("applies jitter within ±10% of base", () => {
    for (let i = 0; i < 100; i++) {
      const d = calculateDelay(1, 1000, 30_000, 0.1);
      expect(d).toBeGreaterThanOrEqual(900);
      expect(d).toBeLessThanOrEqual(1100);
    }
  });

  it("never returns negative value", () => {
    for (let i = 0; i < 50; i++) {
      expect(calculateDelay(1, 0, 0, 1)).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns integer (Math.round)", () => {
    expect(Number.isInteger(calculateDelay(1, 1000, 30_000, 0.1))).toBe(true);
  });
});

// ── shouldRetry ───────────────────────────────────────────────────────────

describe("shouldRetry()", () => {
  it("returns true for network_error", () => {
    expect(shouldRetry(new TinkError({ type: "network_error", message: "" }))).toBe(true);
  });
  it("returns true for timeout", () => {
    expect(shouldRetry(new TinkError({ type: "timeout", message: "" }))).toBe(true);
  });
  it("returns true for status 503", () => {
    expect(shouldRetry(new TinkError({ type: "api_error", message: "", status: 503 }))).toBe(true);
  });
  it("returns false for validation_error", () => {
    expect(shouldRetry(new TinkError({ type: "validation_error", message: "" }))).toBe(false);
  });
  it("returns false for authentication_error", () => {
    expect(shouldRetry(new TinkError({ type: "authentication_error", message: "", status: 401 }))).toBe(false);
  });
});

// ── withRetry ─────────────────────────────────────────────────────────────

describe("withRetry()", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const netErr  = () => new TinkError({ type: "network_error", message: "net" });
  const valErr  = () => new TinkError({ type: "validation_error", message: "val" });
  const srvErr  = () => new TinkError({ type: "api_error", message: "srv", status: 500 });

  async function run<T>(p: Promise<T>): Promise<T> {
    await jest.runAllTimersAsync();
    return p;
  }

  it("resolves immediately on first success without retrying", async () => {
    const fn = jest.fn().mockResolvedValue("ok");
    expect(await run(withRetry(fn, { maxAttempts: 3 }))).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on network_error and returns result on 2nd attempt", async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(netErr())
      .mockResolvedValue("success");
    expect(await run(withRetry(fn, { maxAttempts: 3, baseDelayMs: 0, jitterFactor: 0 }))).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on 500 server error", async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(srvErr())
      .mockResolvedValue("ok");
    expect(await run(withRetry(fn, { maxAttempts: 3, baseDelayMs: 0, jitterFactor: 0 }))).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry validation_error", async () => {
    const fn = jest.fn().mockRejectedValue(valErr());
    await expect(
      run(withRetry(fn, { maxAttempts: 3, baseDelayMs: 0, jitterFactor: 0 }))
    ).rejects.toMatchObject({ type: "validation_error" });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry authentication_error", async () => {
    const fn = jest.fn().mockRejectedValue(
      new TinkError({ type: "authentication_error", message: "", status: 401 })
    );
    await expect(
      run(withRetry(fn, { maxAttempts: 3, baseDelayMs: 0, jitterFactor: 0 }))
    ).rejects.toMatchObject({ type: "authentication_error" });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("exhausts maxAttempts and re-throws", async () => {
    const fn = jest.fn().mockRejectedValue(netErr());
    await expect(
      run(withRetry(fn, { maxAttempts: 3, baseDelayMs: 0, jitterFactor: 0 }))
    ).rejects.toMatchObject({ type: "network_error" });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("maxAttempts: 1 means no retries", async () => {
    const fn = jest.fn().mockRejectedValue(netErr());
    await expect(
      run(withRetry(fn, { maxAttempts: 1, baseDelayMs: 0, jitterFactor: 0 }))
    ).rejects.toBeDefined();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry non-TinkError (TypeError, etc.)", async () => {
    const fn = jest.fn().mockRejectedValue(new TypeError("undefined is not a function"));
    await expect(
      run(withRetry(fn, { maxAttempts: 3, baseDelayMs: 0, jitterFactor: 0 }))
    ).rejects.toBeInstanceOf(TypeError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("custom shouldRetry can force retrying non-retryable errors", async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(valErr())
      .mockResolvedValue("ok");
    const result = await run(
      withRetry(fn, {
        maxAttempts: 3,
        baseDelayMs: 0,
        jitterFactor: 0,
        shouldRetry: () => true,
      })
    );
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("custom shouldRetry can prevent retrying retryable errors", async () => {
    const fn = jest.fn().mockRejectedValue(netErr());
    await expect(
      run(withRetry(fn, { maxAttempts: 3, baseDelayMs: 0, jitterFactor: 0, shouldRetry: () => false }))
    ).rejects.toBeDefined();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("uses default maxAttempts of 3", async () => {
    const fn = jest.fn().mockRejectedValue(netErr());
    await expect(
      run(withRetry(fn, { baseDelayMs: 0, jitterFactor: 0 }))
    ).rejects.toBeDefined();
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
