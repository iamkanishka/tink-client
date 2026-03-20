import {
  check,
  remaining,
  reset,
  info,
  setRateLimitingEnabled,
} from "../utils/rate_limiter";

describe("rate_limiter", () => {
  // Use unique key prefixes per test to avoid cross-test pollution
  let keyCounter = 0;
  const key = () => `test:rl:${++keyCounter}`;

  beforeEach(() => setRateLimitingEnabled(true));
  afterEach(() => setRateLimitingEnabled(true));

  // ── check ─────────────────────────────────────────────────────────────────

  describe("check()", () => {
    it("returns 'ok' for the first request", () => {
      expect(check(key())).toBe("ok");
    });

    it("returns 'ok' up to the limit", () => {
      const k = key();
      for (let i = 0; i < 5; i++) {
        expect(check(k, { limit: 5, periodMs: 60_000 })).toBe("ok");
      }
    });

    it("returns 'rate_limited' when limit is exceeded", () => {
      const k = key();
      for (let i = 0; i < 5; i++) check(k, { limit: 5, periodMs: 60_000 });
      expect(check(k, { limit: 5, periodMs: 60_000 })).toBe("rate_limited");
    });

    it("resets after the window expires", () => {
      jest.useFakeTimers();
      const k = key();
      // Exhaust the limit
      for (let i = 0; i < 3; i++) check(k, { limit: 3, periodMs: 1000 });
      expect(check(k, { limit: 3, periodMs: 1000 })).toBe("rate_limited");
      // Advance past window
      jest.advanceTimersByTime(1001);
      expect(check(k, { limit: 3, periodMs: 1000 })).toBe("ok");
      jest.useRealTimers();
    });

    it("returns 'ok' when rate limiting is disabled", () => {
      setRateLimitingEnabled(false);
      const k = key();
      // Simulate exhausted limit
      for (let i = 0; i < 100; i++) {
        expect(check(k, { limit: 1, periodMs: 60_000 })).toBe("ok");
      }
    });

    it("different keys have independent counters", () => {
      const k1 = key(), k2 = key();
      for (let i = 0; i < 3; i++) check(k1, { limit: 3, periodMs: 60_000 });
      expect(check(k1, { limit: 3, periodMs: 60_000 })).toBe("rate_limited");
      expect(check(k2, { limit: 3, periodMs: 60_000 })).toBe("ok");
    });
  });

  // ── remaining ─────────────────────────────────────────────────────────────

  describe("remaining()", () => {
    it("returns full limit at start", () => {
      expect(remaining(key(), { limit: 10, periodMs: 60_000 })).toBe(10);
    });

    it("decrements after each check()", () => {
      const k = key();
      check(k, { limit: 10, periodMs: 60_000 });
      check(k, { limit: 10, periodMs: 60_000 });
      expect(remaining(k, { limit: 10, periodMs: 60_000 })).toBe(8);
    });

    it("returns 0 when exhausted (not negative)", () => {
      const k = key();
      for (let i = 0; i < 5; i++) check(k, { limit: 5, periodMs: 60_000 });
      expect(remaining(k, { limit: 5, periodMs: 60_000 })).toBe(0);
    });

    it("returns 'infinity' when disabled", () => {
      setRateLimitingEnabled(false);
      expect(remaining(key())).toBe("infinity");
    });
  });

  // ── reset ─────────────────────────────────────────────────────────────────

  describe("reset()", () => {
    it("resets counter so requests are allowed again", () => {
      const k = key();
      for (let i = 0; i < 3; i++) check(k, { limit: 3, periodMs: 60_000 });
      expect(check(k, { limit: 3, periodMs: 60_000 })).toBe("rate_limited");
      reset(k);
      expect(check(k, { limit: 3, periodMs: 60_000 })).toBe("ok");
    });

    it("resetting a non-existent key is safe (no throw)", () => {
      expect(() => reset(key())).not.toThrow();
    });
  });

  // ── info ──────────────────────────────────────────────────────────────────

  describe("info()", () => {
    it("returns correct count and remaining", () => {
      const k = key();
      check(k, { limit: 10, periodMs: 60_000 });
      check(k, { limit: 10, periodMs: 60_000 });
      const result = info(k, { limit: 10, periodMs: 60_000 });
      expect(result.count).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.remaining).toBe(8);
    });

    it("resetsInMs is positive and within window", () => {
      const k = key();
      check(k, { limit: 10, periodMs: 60_000 });
      const result = info(k, { limit: 10, periodMs: 60_000 });
      expect(result.resetsInMs).toBeGreaterThan(0);
      expect(result.resetsInMs).toBeLessThanOrEqual(60_000);
    });

    it("returns infinity values when disabled", () => {
      setRateLimitingEnabled(false);
      const result = info(key());
      expect(result.count).toBe(0);
      expect(result.limit).toBe("infinity");
      expect(result.remaining).toBe("infinity");
    });
  });

  // ── setRateLimitingEnabled ────────────────────────────────────────────────

  describe("setRateLimitingEnabled()", () => {
    it("disabling allows unlimited requests", () => {
      setRateLimitingEnabled(false);
      const k = key();
      for (let i = 0; i < 1000; i++) {
        expect(check(k, { limit: 1, periodMs: 60_000 })).toBe("ok");
      }
    });

    it("re-enabling enforces limits again", () => {
      setRateLimitingEnabled(false);
      setRateLimitingEnabled(true);
      const k = key();
      for (let i = 0; i < 3; i++) check(k, { limit: 3, periodMs: 60_000 });
      expect(check(k, { limit: 3, periodMs: 60_000 })).toBe("rate_limited");
    });
  });
});
