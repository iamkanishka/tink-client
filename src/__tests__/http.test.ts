import { HttpClient } from "../utils/http";
import { TinkError }  from "../utils/error";

// ── fetch mock helpers ────────────────────────────────────────────────────

function mockFetch(
  status: number,
  body: unknown,
  contentType = "application/json"
): jest.Mock {
  return jest.fn().mockResolvedValue({
    ok:      status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => k === "content-type" ? contentType : null },
    json:        () => Promise.resolve(body),
    text:        () => Promise.resolve(String(body ?? "")),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
  } as unknown as Response);
}

function networkErrorFetch(): jest.Mock {
  return jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));
}

function abortFetch(): jest.Mock {
  const e = new Error("aborted");
  e.name = "AbortError";
  return jest.fn().mockRejectedValue(e);
}

function makeClient(fetchFn: jest.Mock, overrides: Partial<ConstructorParameters<typeof HttpClient>[0]> = {}) {
  return new HttpClient({
    baseUrl:      "https://api.tink.com",
    timeoutMs:    5000,
    maxRetries:   1,
    cache:        false,
    accessToken:  "test-token",
    fetchFn,
    ...overrides,
  });
}

// ── helpers ───────────────────────────────────────────────────────────────

const getUrl     = (f: jest.Mock, i = 0) => (f.mock.calls[i] as [string])[0];
const getMethod  = (f: jest.Mock, i = 0) => ((f.mock.calls[i] as [string, RequestInit])[1]?.method ?? "GET");
const getHeaders = (f: jest.Mock, i = 0) => (f.mock.calls[i] as [string, RequestInit])[1]?.headers as Record<string, string>;
const getBody    = (f: jest.Mock, i = 0) => {
  const b = (f.mock.calls[i] as [string, RequestInit])[1]?.body;
  if (typeof b === "string") { try { return JSON.parse(b); } catch { return b; } }
  return b;
};

// ═════════════════════════════════════════════════════════════════════════════

describe("HttpClient", () => {
  // ── GET ───────────────────────────────────────────────────────────────────

  describe("get()", () => {
    it("makes a GET request and returns parsed JSON", async () => {
      const f = mockFetch(200, { accounts: [] });
      expect(await makeClient(f).get("/data/v2/accounts")).toEqual({ accounts: [] });
    });

    it("sets Authorization header with Bearer token", async () => {
      const f = mockFetch(200, {});
      await makeClient(f).get("/api/v1/user");
      expect(getHeaders(f)["authorization"]).toBe("Bearer test-token");
    });

    it("omits Authorization header when no token", async () => {
      const f = mockFetch(200, {});
      await makeClient(f, { accessToken: undefined }).get("/api/v1/providers");
      expect(getHeaders(f)["authorization"]).toBeUndefined();
    });

    it("converts snake_case query params to camelCase", async () => {
      const f = mockFetch(200, {});
      await makeClient(f).get("/data/v2/transactions", { booked_date_gte: "2024-01-01" });
      expect(getUrl(f)).toContain("bookedDateGte=2024-01-01");
    });

    it("expands array query params as repeated params", async () => {
      const f = mockFetch(200, {});
      await makeClient(f).get("/data/v2/accounts", { type_in: ["CHECKING", "SAVINGS"] });
      const url = getUrl(f);
      expect(url).toContain("typeIn=CHECKING");
      expect(url).toContain("typeIn=SAVINGS");
    });

    it("omits undefined query params", async () => {
      const f = mockFetch(200, {});
      await makeClient(f).get("/data/v2/accounts", { page_size: 50, page_token: undefined });
      expect(getUrl(f)).not.toContain("pageToken");
    });

    it("returns ArrayBuffer for PDF content-type", async () => {
      const f = mockFetch(200, null, "application/pdf");
      const result = await makeClient(f).get("/api/v1/reports/r1/pdf");
      expect(result).toBeInstanceOf(ArrayBuffer);
    });
  });

  // ── POST ──────────────────────────────────────────────────────────────────

  describe("post()", () => {
    it("sends POST with JSON body by default", async () => {
      const f = mockFetch(200, { userId: "u1" });
      await makeClient(f).post("/api/v1/user/create", { external_user_id: "ext1" });
      expect(getMethod(f)).toBe("POST");
      expect(getHeaders(f)["content-type"]).toBe("application/json");
      expect(getBody(f)).toEqual({ external_user_id: "ext1" });
    });

    it("sends POST with form-urlencoded when contentType specified", async () => {
      const f = mockFetch(200, { access_token: "tok" });
      await makeClient(f).post(
        "/api/v1/oauth/token",
        { grant_type: "client_credentials", scope: "accounts:read" },
        { contentType: "application/x-www-form-urlencoded" }
      );
      expect(getHeaders(f)["content-type"]).toBe("application/x-www-form-urlencoded");
      const body = String((f.mock.calls[0] as [string, RequestInit])[1]?.body);
      expect(body).toContain("grant_type=client_credentials");
      expect(body).toContain("scope=accounts%3Aread");
    });

    it("makes request even with no body", async () => {
      const f = mockFetch(200, {});
      await makeClient(f).post("/api/v1/credentials/c1/refresh");
      expect(getMethod(f)).toBe("POST");
    });
  });

  // ── PATCH ─────────────────────────────────────────────────────────────────

  describe("patch()", () => {
    it("sends PATCH with JSON body", async () => {
      const f = mockFetch(200, { id: "b1" });
      await makeClient(f).patch("/finance-management/v1/business-budgets/b1", { title: "New" });
      expect(getMethod(f)).toBe("PATCH");
      expect(getHeaders(f)["content-type"]).toBe("application/json");
    });
  });

  // ── PUT ───────────────────────────────────────────────────────────────────

  describe("put()", () => {
    it("sends PUT request", async () => {
      const f = mockFetch(200, {});
      await makeClient(f).put("/some/resource/1", { data: "x" });
      expect(getMethod(f)).toBe("PUT");
    });
  });

  // ── DELETE ────────────────────────────────────────────────────────────────

  describe("delete()", () => {
    it("sends DELETE request", async () => {
      const f = mockFetch(204, null, "text/plain");
      await makeClient(f).delete("/api/v1/credentials/c1");
      expect(getMethod(f)).toBe("DELETE");
      expect(getUrl(f)).toContain("/api/v1/credentials/c1");
    });
  });

  // ── Error handling ────────────────────────────────────────────────────────

  describe("error handling", () => {
    it("throws authentication_error on 401", async () => {
      const f = mockFetch(401, { errorMessage: "Unauthorized" });
      await expect(makeClient(f).get("/api/v1/user"))
        .rejects.toMatchObject({ type: "authentication_error", status: 401 });
    });

    it("throws rate_limit_error on 429", async () => {
      const f = mockFetch(429, { errorMessage: "Too many requests" });
      await expect(makeClient(f).get("/api/v1/user"))
        .rejects.toMatchObject({ type: "rate_limit_error", status: 429 });
    });

    it("throws validation_error on 400", async () => {
      const f = mockFetch(400, { errorMessage: "Bad request" });
      await expect(makeClient(f).get("/api/v1/user"))
        .rejects.toMatchObject({ type: "validation_error", status: 400 });
    });

    it("throws api_error on 500", async () => {
      const f = mockFetch(500, {});
      await expect(makeClient(f).get("/api/v1/user"))
        .rejects.toMatchObject({ type: "api_error", status: 500 });
    });

    it("throws network_error when fetch rejects", async () => {
      await expect(makeClient(networkErrorFetch()).get("/api/v1/user"))
        .rejects.toMatchObject({ type: "network_error" });
    });

    it("throws timeout on AbortError", async () => {
      await expect(makeClient(abortFetch()).get("/api/v1/user"))
        .rejects.toMatchObject({ type: "timeout" });
    });

    it("thrown errors are instanceof TinkError", async () => {
      const f = mockFetch(500, {});
      await expect(makeClient(f).get("/x")).rejects.toBeInstanceOf(TinkError);
    });
  });

  // ── Caching ───────────────────────────────────────────────────────────────

  describe("caching", () => {
    it("caches GET responses for cacheable paths", async () => {
      const f = mockFetch(200, { providers: [] });
      const c = makeClient(f, { cache: true });
      await c.get("/api/v1/providers");
      await c.get("/api/v1/providers");
      expect(f).toHaveBeenCalledTimes(1);
    });

    it("does NOT cache POST requests", async () => {
      const f = mockFetch(200, {});
      const c = makeClient(f, { cache: true });
      await c.post("/api/v1/user/create", {});
      await c.post("/api/v1/user/create", {});
      expect(f).toHaveBeenCalledTimes(2);
    });

    it("does NOT cache OAuth endpoints", async () => {
      const f = mockFetch(200, { access_token: "tok" });
      const c = makeClient(f, { cache: true });
      await c.post("/api/v1/oauth/token", {});
      await c.post("/api/v1/oauth/token", {});
      expect(f).toHaveBeenCalledTimes(2);
    });

    it("invalidateCache() clears cached entries", async () => {
      const f = mockFetch(200, { providers: [] });
      const c = makeClient(f, { cache: true });
      await c.get("/api/v1/providers");
      c.invalidateCache();
      await c.get("/api/v1/providers");
      expect(f).toHaveBeenCalledTimes(2);
    });

    it("different query params produce separate cache entries", async () => {
      const f = mockFetch(200, { providers: [] });
      const c = makeClient(f, { cache: true });
      await c.get("/api/v1/providers", { market: "GB" });
      await c.get("/api/v1/providers", { market: "SE" });
      expect(f).toHaveBeenCalledTimes(2);
    });
  });

  // ── Token management ──────────────────────────────────────────────────────

  describe("setAccessToken()", () => {
    it("updates the token for subsequent requests", async () => {
      const f = mockFetch(200, {});
      const c = makeClient(f, { accessToken: "old" });
      c.setAccessToken("new-token");
      await c.get("/api/v1/user");
      expect(getHeaders(f)["authorization"]).toBe("Bearer new-token");
    });

    it("exposes the token via accessToken getter", () => {
      const c = makeClient(mockFetch(200, {}));
      c.setAccessToken("my-token");
      expect(c.accessToken).toBe("my-token");
    });
  });

  // ── Default headers ───────────────────────────────────────────────────────

  describe("defaultHeaders", () => {
    it("includes user-agent when set", async () => {
      const f = mockFetch(200, {});
      const c = makeClient(f, { defaultHeaders: { "user-agent": "tink-node/1.0.0" } });
      await c.get("/api/v1/user");
      expect(getHeaders(f)["user-agent"]).toBe("tink-node/1.0.0");
    });
  });

  // ── Constructor validation ────────────────────────────────────────────────

  describe("constructor", () => {
    it("throws TinkError when no global fetch and no fetchFn", () => {
      // Temporarily remove globalThis.fetch
      const orig = (globalThis as { fetch?: unknown }).fetch;
      delete (globalThis as { fetch?: unknown }).fetch;
      expect(() => new HttpClient({
        baseUrl: "https://api.tink.com", timeoutMs: 5000,
        maxRetries: 1, cache: false,
      })).toThrow(TinkError);
      (globalThis as { fetch?: unknown }).fetch = orig;
    });
  });
});
