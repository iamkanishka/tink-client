/**
 * Auth application service — OAuth 2.0 flows and authorization grants.
 *
 * Endpoints:
 *   POST /api/v1/oauth/token                     (client credentials, code, refresh)
 *   POST /api/v1/oauth/authorization-grant        (snake_case form-encoded body)
 *   POST /api/v1/oauth/authorization-grant/delegate
 */

import { TinkError } from "../domain/errors.js";
import type {
  TokenResponse,
  CreateAuthorizationParams,
  DelegateAuthorizationParams,
  AuthorizationUrlOpts,
} from "../domain/types.js";
import type { HttpClient } from "../infrastructure/http.js";

const TOKEN_PATH = "/api/v1/oauth/token";
const GRANT_PATH = "/api/v1/oauth/authorization-grant";
const DELEGATE_PATH = "/api/v1/oauth/authorization-grant/delegate";
const LINK_BASE = "https://link.tink.com/1.0";

/** Safety margin subtracted from ExpiresIn to prevent 401 races (30 seconds). */
const TOKEN_EXPIRY_MARGIN_MS = 30_000;

interface CachedToken {
  token: string;
  expiresAt: number;
}

/** Auth application service. */
export class AuthService {
  private readonly http: HttpClient;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private cached: CachedToken | null = null;

  constructor(http: HttpClient, clientId: string, clientSecret: string) {
    this.http = http;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  // ── Token flows ─────────────────────────────────────────────────────────────

  /**
   * Exchanges client credentials for an app-level access token.
   *
   * The returned token is cached until `expires_in − 30s` to prevent 401 races.
   * Call `clearTokenCache()` to force a fresh fetch.
   */
  async clientCredentials(scope: string): Promise<TokenResponse> {
    if (!scope) throw TinkError.validation("scope is required for client credentials");

    // Return cached token if still valid.
    if (this.cached && Date.now() < this.cached.expiresAt) {
      return {
        access_token: this.cached.token,
        token_type: "bearer",
        expires_in: Math.floor((this.cached.expiresAt - Date.now()) / 1_000),
        scope,
      };
    }

    const resp = await this.http.postForm<TokenResponse>(TOKEN_PATH, {
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: "client_credentials",
      scope,
    });

    if (resp.expires_in > 0) {
      const ttl = resp.expires_in * 1_000 - TOKEN_EXPIRY_MARGIN_MS;
      if (ttl > 0) {
        this.cached = { token: resp.access_token, expiresAt: Date.now() + ttl };
      }
    }

    // Keep the HTTP client's bearer token in sync.
    this.http.setToken(resp.access_token);
    return resp;
  }

  /** Exchanges an authorization code for a user bearer token. */
  async exchangeCode(
    code: string,
    clientId?: string,
    clientSecret?: string,
  ): Promise<TokenResponse> {
    if (!code) throw TinkError.validation("authorization code is required");
    return this.http.postForm<TokenResponse>(TOKEN_PATH, {
      client_id: clientId ?? this.clientId,
      client_secret: clientSecret ?? this.clientSecret,
      grant_type: "authorization_code",
      code,
    });
  }

  /** Exchanges a refresh token for a new access token. */
  async refreshToken(
    refreshToken: string,
    clientId?: string,
    clientSecret?: string,
  ): Promise<TokenResponse> {
    if (!refreshToken) throw TinkError.validation("refresh_token is required");
    return this.http.postForm<TokenResponse>(TOKEN_PATH, {
      client_id: clientId ?? this.clientId,
      client_secret: clientSecret ?? this.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
  }

  // ── Authorization grants ────────────────────────────────────────────────────

  /**
   * Creates a short-lived authorization grant code for a permanent user.
   *
   * The Tink endpoint requires `application/x-www-form-urlencoded` with
   * snake_case keys (`user_id`, `external_user_id`, `scope`, `id_hint`).
   * The `appToken` must have the `authorization:grant` scope.
   */
  async createAuthorizationGrant(
    appToken: string,
    params: CreateAuthorizationParams,
  ): Promise<{ code: string }> {
    if (!appToken) throw TinkError.validation("app-level bearer token is required");
    if (!params.scope) throw TinkError.validation("scope is required");
    if (!params.userId && !params.externalUserId) {
      throw TinkError.validation("one of userId or externalUserId is required");
    }

    const saved = this.http["tokenProvider"]?.();
    this.http.setToken(appToken);
    try {
      return await this.http.postForm<{ code: string }>(GRANT_PATH, {
        user_id: params.userId,
        external_user_id: params.externalUserId,
        scope: params.scope,
        id_hint: params.idHint,
      });
    } finally {
      this.http.setToken(saved);
    }
  }

  /**
   * Creates a delegated authorization grant.
   *
   * `actorClientId` is the `client_id` of the partner application that will
   * receive the delegation (defaults to this SDK's own `clientId`).
   */
  async delegateAuthorizationGrant(
    appToken: string,
    params: DelegateAuthorizationParams,
  ): Promise<{ code: string }> {
    if (!appToken) throw TinkError.validation("app-level bearer token is required");
    if (!params.scope) throw TinkError.validation("scope is required");
    if (!params.userId && !params.externalUserId) {
      throw TinkError.validation("one of userId or externalUserId is required");
    }

    const saved = this.http["tokenProvider"]?.();
    this.http.setToken(appToken);
    try {
      return await this.http.postForm<{ code: string }>(DELEGATE_PATH, {
        user_id: params.userId,
        external_user_id: params.externalUserId,
        id_hint: params.idHint,
        scope: params.scope,
        actor_client_id: params.actorClientId ?? this.clientId,
      });
    } finally {
      this.http.setToken(saved);
    }
  }

  // ── URL builders ────────────────────────────────────────────────────────────

  /** Builds the standard OAuth 2.0 authorization URL. */
  buildAuthorizationUrl(opts: AuthorizationUrlOpts): string {
    const p = new URLSearchParams({
      client_id: opts.clientId,
      redirect_uri: opts.redirectUri,
      response_type: "code",
      scope: opts.scope,
    });
    if (opts.state) p.set("state", opts.state);
    if (opts.market) p.set("market", opts.market);
    if (opts.locale) p.set("locale", opts.locale);
    return `https://api.tink.com/oauth2/authorize?${p.toString()}`;
  }

  /** Builds a Tink Link URL for the bank account connection flow. */
  buildLinkUrl(authCode: string, redirectUri: string, market: string, locale = "en_US"): string {
    const p = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      market,
      locale,
      authorization_code: authCode,
    });
    return `${LINK_BASE}/transactions/connect-accounts?${p.toString()}`;
  }

  /** Clears the cached app-level token, forcing a fresh `clientCredentials` call. */
  clearTokenCache(): void {
    this.cached = null;
  }
}
