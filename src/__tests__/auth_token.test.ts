import {
  expired,
  expiresSoon,
  timeUntilExpiration,
  calculateExpiration,
  parseExpiration,
  bufferSeconds,
} from "../utils/auth_token";

describe("auth_token utilities", () => {
  // ── bufferSeconds ─────────────────────────────────────────────────────────

  describe("bufferSeconds()", () => {
    it("returns 300 (5 minutes)", () => {
      expect(bufferSeconds()).toBe(300);
    });
  });

  // ── expired ───────────────────────────────────────────────────────────────

  describe("expired()", () => {
    it("returns true for null", () => {
      expect(expired(null)).toBe(true);
    });

    it("returns true for undefined", () => {
      expect(expired(undefined)).toBe(true);
    });

    it("returns true for a past date", () => {
      expect(expired(new Date(Date.now() - 60_000))).toBe(true);
    });

    it("returns true for a date less than 5 minutes in the future (within buffer)", () => {
      expect(expired(new Date(Date.now() + 60_000))).toBe(true);
    });

    it("returns true exactly at the buffer boundary", () => {
      // Exactly 300s from now is considered expired (within buffer)
      expect(expired(new Date(Date.now() + 300_000))).toBe(true);
    });

    it("returns false for a date well beyond the buffer", () => {
      // 10 minutes from now
      expect(expired(new Date(Date.now() + 600_000))).toBe(false);
    });

    it("returns false for a date 1 hour in the future", () => {
      expect(expired(new Date(Date.now() + 3_600_000))).toBe(false);
    });
  });

  // ── expiresSoon ───────────────────────────────────────────────────────────

  describe("expiresSoon()", () => {
    it("behaves identically to expired()", () => {
      const future = new Date(Date.now() + 600_000);
      const past   = new Date(Date.now() - 1_000);
      expect(expiresSoon(null)).toBe(expired(null));
      expect(expiresSoon(undefined)).toBe(expired(undefined));
      expect(expiresSoon(future)).toBe(expired(future));
      expect(expiresSoon(past)).toBe(expired(past));
    });
  });

  // ── timeUntilExpiration ───────────────────────────────────────────────────

  describe("timeUntilExpiration()", () => {
    it("returns { ok: false, error: 'no_expiration' } for null", () => {
      expect(timeUntilExpiration(null)).toEqual({ ok: false, error: "no_expiration" });
    });

    it("returns { ok: false, error: 'no_expiration' } for undefined", () => {
      expect(timeUntilExpiration(undefined)).toEqual({ ok: false, error: "no_expiration" });
    });

    it("returns correct seconds for a future date", () => {
      const result = timeUntilExpiration(new Date(Date.now() + 3_600_000));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.seconds).toBeGreaterThanOrEqual(3598);
        expect(result.seconds).toBeLessThanOrEqual(3601);
      }
    });

    it("returns 0 for an expired date", () => {
      const result = timeUntilExpiration(new Date(Date.now() - 1_000));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.seconds).toBe(0);
    });

    it("returns integer seconds", () => {
      const result = timeUntilExpiration(new Date(Date.now() + 3_600_000));
      if (result.ok) expect(Number.isInteger(result.seconds)).toBe(true);
    });
  });

  // ── calculateExpiration ───────────────────────────────────────────────────

  describe("calculateExpiration()", () => {
    it("returns a Date approximately expiresIn seconds from now", () => {
      const before = Date.now();
      const exp    = calculateExpiration(3600);
      const after  = Date.now();
      expect(exp.getTime()).toBeGreaterThanOrEqual(before + 3600 * 1000);
      expect(exp.getTime()).toBeLessThanOrEqual(after  + 3600 * 1000);
    });

    it("returns a Date object", () => {
      expect(calculateExpiration(3600)).toBeInstanceOf(Date);
    });

    it("handles 0 seconds", () => {
      const exp = calculateExpiration(0);
      expect(Math.abs(exp.getTime() - Date.now())).toBeLessThan(100);
    });
  });

  // ── parseExpiration ───────────────────────────────────────────────────────

  describe("parseExpiration()", () => {
    it("parses expires_in as number", () => {
      const exp = parseExpiration({ expires_in: 3600, access_token: "tok" });
      expect(exp).toBeInstanceOf(Date);
      expect(exp!.getTime()).toBeGreaterThan(Date.now());
    });

    it("returns null when expires_in is absent", () => {
      expect(parseExpiration({ access_token: "tok" })).toBeNull();
    });

    it("returns null when expires_in is a string", () => {
      expect(parseExpiration({ expires_in: "3600" })).toBeNull();
    });

    it("returns null for empty object", () => {
      expect(parseExpiration({})).toBeNull();
    });

    it("returns a date roughly expires_in seconds in the future", () => {
      const exp = parseExpiration({ expires_in: 3600 });
      const diff = exp!.getTime() - Date.now();
      expect(diff).toBeGreaterThan(3590 * 1000);
      expect(diff).toBeLessThan(3610 * 1000);
    });
  });
});
