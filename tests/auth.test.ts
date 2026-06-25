import { HttpClient } from "../src/infrastructure/http";
import { AuthService } from "../src/application/auth";

import { describe, expect, it } from "@jest/globals";

function mockHttp(body: unknown, status = 200): HttpClient {
  const fetchFn = jest.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(""),
  } as unknown as Response);
  return new HttpClient({ fetchFn, maxRetries: 1, cache: false });
}

describe("AuthService.clientCredentials", () => {
  it("posts form-encoded body to token endpoint", async () => {
    const http = mockHttp({
      access_token: "tok",
      token_type: "bearer",
      expires_in: 3600,
      scope: "accounts:read",
    });
    const svc = new AuthService(http, "client-id", "client-secret");
    const resp = await svc.clientCredentials("accounts:read");
    expect(resp.access_token).toBe("tok");
    const fetchFn = (http as unknown as { fetchFn: jest.Mock }).fetchFn;
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/oauth/token");
    expect(init.body as string).toContain("grant_type=client_credentials");
    expect(init.body as string).toContain("client_id=client-id");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
  });

  it("caches the token and skips refetch", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          access_token: "tok",
          token_type: "bearer",
          expires_in: 3600,
          scope: "s",
        }),
      text: () => Promise.resolve(""),
    } as unknown as Response);
    const http = new HttpClient({ fetchFn, maxRetries: 1, cache: false });
    const svc = new AuthService(http, "id", "secret");
    await svc.clientCredentials("s");
    await svc.clientCredentials("s");
    expect(fetchFn.mock.calls).toHaveLength(1);
  });

  it("clears cache after clearTokenCache()", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          access_token: "tok",
          token_type: "bearer",
          expires_in: 3600,
          scope: "s",
        }),
      text: () => Promise.resolve(""),
    } as unknown as Response);
    const http = new HttpClient({ fetchFn, maxRetries: 1, cache: false });
    const svc = new AuthService(http, "id", "secret");
    await svc.clientCredentials("s");
    svc.clearTokenCache();
    await svc.clientCredentials("s");
    expect(fetchFn.mock.calls).toHaveLength(2);
  });

  it("throws validation_error for missing scope", async () => {
    const svc = new AuthService(mockHttp({}), "id", "secret");
    await expect(svc.clientCredentials("")).rejects.toMatchObject({ type: "validation_error" });
  });
});

describe("AuthService.createAuthorizationGrant", () => {
  it("sends snake_case form-encoded keys", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ code: "grant-code" }),
      text: () => Promise.resolve(""),
    } as unknown as Response);
    const http = new HttpClient({ fetchFn, token: "app-tok", maxRetries: 1, cache: false });
    const svc = new AuthService(http, "cid", "csecret");
    const resp = await svc.createAuthorizationGrant("app-tok", {
      externalUserId: "ext-user-1",
      scope: "accounts:read",
      idHint: "Alice",
    });
    expect(resp.code).toBe("grant-code");
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/oauth/authorization-grant");
    expect(init.body as string).toContain("external_user_id=ext-user-1");
    expect(init.body as string).toContain("scope=accounts%3Aread");
    expect(init.body as string).toContain("id_hint=Alice");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
  });

  it("throws when neither userId nor externalUserId given", async () => {
    const svc = new AuthService(mockHttp({}), "id", "secret");
    await expect(
      svc.createAuthorizationGrant("tok", { scope: "accounts:read" }),
    ).rejects.toMatchObject({ type: "validation_error" });
  });

  it("throws when scope is missing", async () => {
    const svc = new AuthService(mockHttp({}), "id", "secret");
    await expect(
      svc.createAuthorizationGrant("tok", { userId: "u1", scope: "" }),
    ).rejects.toMatchObject({ type: "validation_error" });
  });
});

describe("AuthService.delegateAuthorizationGrant", () => {
  it("includes actor_client_id in form body", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ code: "delegate-code" }),
      text: () => Promise.resolve(""),
    } as unknown as Response);
    const http = new HttpClient({ fetchFn, maxRetries: 1, cache: false });
    const svc = new AuthService(http, "my-client-id", "secret");
    await svc.delegateAuthorizationGrant("app-tok", {
      externalUserId: "u1",
      scope: "consents",
      actorClientId: "partner-id",
    });
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/oauth/authorization-grant/delegate");
    expect(init.body as string).toContain("actor_client_id=partner-id");
    expect(init.body as string).toContain("external_user_id=u1");
  });

  it("defaults actor_client_id to own clientId when omitted", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ code: "c" }),
      text: () => Promise.resolve(""),
    } as unknown as Response);
    const http = new HttpClient({ fetchFn, maxRetries: 1, cache: false });
    const svc = new AuthService(http, "my-own-client-id", "secret");
    await svc.delegateAuthorizationGrant("tok", { userId: "u", scope: "s" });
    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(init.body as string).toContain("actor_client_id=my-own-client-id");
  });
});

describe("AuthService.buildAuthorizationUrl", () => {
  it("builds a valid OAuth URL", () => {
    const svc = new AuthService(mockHttp({}), "cid", "secret");
    const url = svc.buildAuthorizationUrl({
      clientId: "cid",
      redirectUri: "https://app.example.com/callback",
      scope: "accounts:read",
      state: "xyz",
    });
    expect(url).toContain("client_id=cid");
    expect(url).toContain("response_type=code");
    expect(url).toContain("state=xyz");
  });
});
