import {
  buildUrl, buildQueryString, toCamelCase,
  parseMoney, validateRequired, encodeJson, decodeJson,
  redactSensitive, getInSafe, mergePaginationParams,
} from "../utils/helpers";

describe("helpers", () => {
  // ── toCamelCase ───────────────────────────────────────────────────────────

  describe("toCamelCase()", () => {
    it("converts snake_case to camelCase", () => {
      expect(toCamelCase("page_size")).toBe("pageSize");
    });
    it("converts multi-segment snake_case", () => {
      expect(toCamelCase("booked_date_gte")).toBe("bookedDateGte");
    });
    it("leaves already-camel strings unchanged", () => {
      expect(toCamelCase("pageSize")).toBe("pageSize");
    });
    it("handles single word", () => {
      expect(toCamelCase("market")).toBe("market");
    });
    it("handles empty string", () => {
      expect(toCamelCase("")).toBe("");
    });
  });

  // ── buildQueryString ──────────────────────────────────────────────────────

  describe("buildQueryString()", () => {
    it("encodes a simple key-value pair", () => {
      expect(buildQueryString({ page_size: 10 })).toBe("pageSize=10");
    });
    it("converts key to camelCase", () => {
      expect(buildQueryString({ booked_date_gte: "2024-01-01" })).toBe("bookedDateGte=2024-01-01");
    });
    it("omits null values", () => {
      expect(buildQueryString({ a: null, b: "ok" })).toBe("b=ok");
    });
    it("omits undefined values", () => {
      expect(buildQueryString({ a: undefined, b: "1" })).toBe("b=1");
    });
    it("handles array values as repeated params", () => {
      const qs = buildQueryString({ status_in: ["BOOKED", "PENDING"] });
      expect(qs).toContain("statusIn=BOOKED");
      expect(qs).toContain("statusIn=PENDING");
    });
    it("URL-encodes special characters", () => {
      const qs = buildQueryString({ scope: "accounts:read" });
      expect(qs).toBe("scope=accounts%3Aread");
    });
    it("joins multiple params with &", () => {
      const qs = buildQueryString({ page_size: 10, market: "GB" });
      expect(qs.split("&")).toHaveLength(2);
    });
    it("returns empty string for empty object", () => {
      expect(buildQueryString({})).toBe("");
    });
    it("accepts array of tuples", () => {
      const qs = buildQueryString([["page_size", 25]]);
      expect(qs).toBe("pageSize=25");
    });
  });

  // ── buildUrl ──────────────────────────────────────────────────────────────

  describe("buildUrl()", () => {
    it("appends query string to path", () => {
      expect(buildUrl("/data/v2/accounts", { page_size: 25 })).toBe("/data/v2/accounts?pageSize=25");
    });
    it("returns path unchanged when no params", () => {
      expect(buildUrl("/api/v1/providers")).toBe("/api/v1/providers");
    });
    it("returns path unchanged for empty params", () => {
      expect(buildUrl("/api/v1/providers", {})).toBe("/api/v1/providers");
    });
    it("returns path unchanged for null/undefined params", () => {
      expect(buildUrl("/api/v1/providers", null as never)).toBe("/api/v1/providers");
    });
    it("omits undefined param values", () => {
      const url = buildUrl("/data/v2/transactions", { page_size: 50, page_token: undefined });
      expect(url).toBe("/data/v2/transactions?pageSize=50");
      expect(url).not.toContain("pageToken");
    });
  });

  // ── parseMoney ────────────────────────────────────────────────────────────

  describe("parseMoney()", () => {
    it("parses value and currencyCode", () => {
      expect(parseMoney({ value: "123.45", currencyCode: "GBP" }))
        .toEqual({ amount: "123.45", currency: "GBP" });
    });
    it("converts numeric value to string", () => {
      expect(parseMoney({ value: 100, currencyCode: "USD" }))
        .toEqual({ amount: "100", currency: "USD" });
    });
    it("returns null for missing value", () => {
      expect(parseMoney({ currencyCode: "GBP" })).toBeNull();
    });
    it("returns null for missing currencyCode", () => {
      expect(parseMoney({ value: "10" })).toBeNull();
    });
    it("returns null for non-object", () => {
      expect(parseMoney("string")).toBeNull();
    });
    it("returns null for null", () => {
      expect(parseMoney(null)).toBeNull();
    });
    it("returns null for numeric currencyCode", () => {
      expect(parseMoney({ value: "10", currencyCode: 826 })).toBeNull();
    });
  });

  // ── validateRequired ──────────────────────────────────────────────────────

  describe("validateRequired()", () => {
    it("returns { ok: true } when all keys present", () => {
      expect(validateRequired({ userId: "u1", scope: "accounts:read" }, ["userId", "scope"]))
        .toEqual({ ok: true });
    });
    it("returns { ok: false } when a key is missing", () => {
      const result = validateRequired({ userId: "u1" }, ["userId", "scope"]);
      expect(result.ok).toBe(false);
    });
    it("error message names the missing key", () => {
      const result = validateRequired({ userId: "u1" }, ["userId", "scope"]);
      if (!result.ok) expect(result.error).toContain("scope");
    });
    it("returns { ok: false } for null value", () => {
      const result = validateRequired({ userId: null } as never, ["userId"]);
      expect(result.ok).toBe(false);
    });
    it("returns { ok: false } for undefined value", () => {
      const result = validateRequired({ userId: undefined } as never, ["userId"]);
      expect(result.ok).toBe(false);
    });
    it("returns { ok: true } for empty required list", () => {
      expect(validateRequired({ anything: "value" }, [])).toEqual({ ok: true });
    });
  });

  // ── encodeJson ────────────────────────────────────────────────────────────

  describe("encodeJson()", () => {
    it("serialises an object", () => {
      const r = encodeJson({ foo: "bar" });
      expect(r.ok).toBe(true);
      if (r.ok) expect(JSON.parse(r.value!)).toEqual({ foo: "bar" });
    });
    it("returns null for null input", () => {
      const r = encodeJson(null);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toBeNull();
    });
    it("returns null for undefined input", () => {
      const r = encodeJson(undefined);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toBeNull();
    });
    it("returns { ok: false } for non-serialisable value", () => {
      const circular: Record<string, unknown> = {};
      circular["self"] = circular;
      expect(encodeJson(circular).ok).toBe(false);
    });
  });

  // ── decodeJson ────────────────────────────────────────────────────────────

  describe("decodeJson()", () => {
    it("parses a valid JSON string", () => {
      const r = decodeJson('{"foo":"bar"}');
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toEqual({ foo: "bar" });
    });
    it("returns { ok: false } for invalid JSON", () => {
      expect(decodeJson("not json").ok).toBe(false);
    });
    it("parses JSON array", () => {
      const r = decodeJson("[1,2,3]");
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toEqual([1, 2, 3]);
    });
  });

  // ── redactSensitive ───────────────────────────────────────────────────────

  describe("redactSensitive()", () => {
    it("redacts access_token", () => {
      expect(redactSensitive({ access_token: "secret" }).access_token).toBe("[REDACTED]");
    });
    it("redacts accessToken", () => {
      expect(redactSensitive({ accessToken: "secret" }).accessToken).toBe("[REDACTED]");
    });
    it("redacts refresh_token", () => {
      expect(redactSensitive({ refresh_token: "tok" }).refresh_token).toBe("[REDACTED]");
    });
    it("redacts client_secret", () => {
      expect(redactSensitive({ client_secret: "secret" }).client_secret).toBe("[REDACTED]");
    });
    it("redacts password", () => {
      expect(redactSensitive({ password: "pw" }).password).toBe("[REDACTED]");
    });
    it("leaves non-sensitive keys unchanged", () => {
      expect(redactSensitive({ userId: "u1", name: "Alice" })).toEqual({ userId: "u1", name: "Alice" });
    });
    it("does not mutate the original object", () => {
      const original = { access_token: "secret", userId: "u1" };
      redactSensitive(original);
      expect(original.access_token).toBe("secret");
    });
  });

  // ── getInSafe ─────────────────────────────────────────────────────────────

  describe("getInSafe()", () => {
    it("retrieves a nested value", () => {
      expect(getInSafe({ user: { name: "John" } }, ["user", "name"])).toBe("John");
    });
    it("returns null for missing intermediate key", () => {
      expect(getInSafe({ user: {} }, ["user", "age"])).toBeNull();
    });
    it("returns null for null object", () => {
      expect(getInSafe(null, ["key"])).toBeNull();
    });
    it("returns null for non-object at intermediate level", () => {
      expect(getInSafe({ a: "string" }, ["a", "b"])).toBeNull();
    });
    it("returns the root value for empty key path", () => {
      expect(getInSafe({ x: 1 }, [])).toEqual({ x: 1 });
    });
  });

  // ── mergePaginationParams ─────────────────────────────────────────────────

  describe("mergePaginationParams()", () => {
    it("adds page_token to opts", () => {
      expect(mergePaginationParams({ pageSize: 10 }, "tok123"))
        .toEqual({ pageSize: 10, page_token: "tok123" });
    });
    it("returns original opts when pageToken is null", () => {
      const opts = { pageSize: 10 };
      expect(mergePaginationParams(opts, null)).toBe(opts);
    });
    it("returns original opts when pageToken is undefined", () => {
      const opts = { pageSize: 10 };
      expect(mergePaginationParams(opts, undefined)).toBe(opts);
    });
  });
});
