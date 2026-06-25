import { HttpClient } from "../src/infrastructure/http";
import { TinkError } from "../src/domain/errors";
import { describe, expect, it } from "@jest/globals";

function mockFetch(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): typeof fetch {
  return jest.fn().mockResolvedValue({
    ok: status < 400,
    status,
    headers: new Headers(headers),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
  } as unknown as Response);
}

function client(
  fetchFn: typeof fetch,
  extra: ConstructorParameters<typeof HttpClient>[0] = {},
): HttpClient {
  return new HttpClient({
    fetchFn,
    token: "test-token",
    maxRetries: 1,
    cache: false,
    ...extra,
  });
}

describe("HttpClient.get", () => {
  it("parses a 200 JSON response", async () => {
    const c = client(mockFetch(200, { accounts: [] }));
    const resp = await c.get("/data/v2/accounts");
    expect(resp).toEqual({ accounts: [] });
  });

  it("throws TinkError on 401", async () => {
    const c = client(mockFetch(401, { errorMessage: "bad token" }));
    await expect(c.get("/data/v2/accounts")).rejects.toMatchObject({
      type: "authentication_error",
      status: 401,
    });
  });

  it("throws TinkError on 500", async () => {
    const c = client(mockFetch(500, {}));
    await expect(c.get("/data/v2/accounts")).rejects.toMatchObject({
      type: "api_error",
      status: 500,
    });
  });

  it("sends Authorization header", async () => {
    const fetchFn = mockFetch(200, {});
    const c = client(fetchFn, { token: "my-token" });
    await c.get("/path");
    const call = (fetchFn as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect((call[1].headers as Record<string, string>)["Authorization"]).toBe("Bearer my-token");
  });

  it("sends User-Agent header", async () => {
    const fetchFn = mockFetch(200, {});
    const c = client(fetchFn);
    await c.get("/path");
    const call = (fetchFn as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect((call[1].headers as Record<string, string>)["User-Agent"]).toContain("tink-client");
  });

  it("returns cached response on second GET", async () => {
    const fetchFn = mockFetch(200, { data: "value" });
    const c = new HttpClient({ fetchFn, cache: true, token: "t", maxRetries: 1 });
    await c.get("/data/v2/accounts", { cacheTtlMs: 60_000 });
    await c.get("/data/v2/accounts", { cacheTtlMs: 60_000 });
    expect((fetchFn as jest.Mock).mock.calls).toHaveLength(1);
  });

  it("does not cache non-cacheable paths", async () => {
    const fetchFn = mockFetch(200, {});
    const c = new HttpClient({ fetchFn, cache: true, token: "t", maxRetries: 1 });
    await c.get("/api/v1/oauth/token", { cacheTtlMs: 60_000 });
    await c.get("/api/v1/oauth/token", { cacheTtlMs: 60_000 });
    expect((fetchFn as jest.Mock).mock.calls).toHaveLength(2);
  });
});

describe("HttpClient.post", () => {
  it("sends a JSON body", async () => {
    const fetchFn = mockFetch(200, { id: "new" });
    const c = client(fetchFn);
    await c.post("/api/v1/user/create", { externalUserId: "u1" });
    const [, init] = (fetchFn as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ externalUserId: "u1" }));
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });
});

describe("HttpClient.postForm", () => {
  it("sends form-encoded body", async () => {
    const fetchFn = mockFetch(200, { access_token: "tok" });
    const c = client(fetchFn);
    await c.postForm("/api/v1/oauth/token", {
      grant_type: "client_credentials",
      client_id: "id",
      scope: "accounts:read",
    });
    const [, init] = (fetchFn as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.body).toContain("grant_type=client_credentials");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
  });

  it("skips undefined and empty fields", async () => {
    const fetchFn = mockFetch(200, { code: "abc" });
    const c = client(fetchFn);
    await c.postForm("/path", { a: "1", b: undefined, c: "" });
    const [, init] = (fetchFn as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.body as string).toBe("a=1");
  });
});

describe("HttpClient.delete", () => {
  it("sends DELETE with no body", async () => {
    const fetchFn = mockFetch(204, null);
    const c = client(fetchFn);
    await c.delete("/api/v1/credentials/cred-1");
    const [, init] = (fetchFn as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
  });
});

describe("TinkError instanceof check", () => {
  it("thrown errors are TinkError instances", async () => {
    const c = client(mockFetch(429, {}));
    let caught: unknown;
    try {
      await c.get("/path");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(TinkError);
    expect((caught as TinkError).type).toBe("rate_limit_error");
  });
});
