/**
 * OAuth 2.0 authentication for the Tink API.
 *
 * Supports all Tink OAuth flows:
 * - Client credentials (server-to-server)
 * - Authorization code exchange (after user redirect)
 * - Token refresh
 * - Authorization grant creation and delegation (for user-scoped access)
 */
import type { HttpClient } from "../utils/http";
import type {
  TokenResponse,
  AuthorizationUrlOpts,
  CreateAuthorizationParams,
  DelegateAuthorizationParams,
} from "../types";

const TOKEN_URL = "/api/v1/oauth/token";
const GRANT_URL = "/api/v1/oauth/authorization-grant";
const DELEGATE_URL = "/api/v1/oauth/authorization-grant/delegate";

export class Auth {
  constructor(
    private readonly http: HttpClient,
    private readonly baseUrl: string
  ) {}

  /**
   * Acquires a client credentials token for server-to-server API calls.
   *
   * Use `tink.authenticate(scope)` as a shortcut — it calls this and
   * automatically sets the token on the client.
   *
   * @param scope - Space-separated OAuth scopes (e.g. "accounts:read transactions:read")
   */
  async getAccessToken(
    clientId: string,
    clientSecret: string,
    scope: string
  ): Promise<TokenResponse> {
    return this.http.post<TokenResponse>(
      TOKEN_URL,
      { client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials", scope },
      { contentType: "application/x-www-form-urlencoded" }
    );
  }

  /**
   * Builds a Tink OAuth authorization URL to redirect end users to.
   * After the user grants access, Tink redirects to your `redirectUri`
   * with a `code` parameter that can be exchanged via `exchangeCode()`.
   */
  buildAuthorizationUrl(opts: AuthorizationUrlOpts): string {
    const p = new URLSearchParams({
      client_id: opts.clientId,
      redirect_uri: opts.redirectUri,
      scope: opts.scope,
    });
    if (opts.state) p.set("state", opts.state);
    if (opts.market) p.set("market", opts.market);
    if (opts.locale) p.set("locale", opts.locale);
    return `${this.baseUrl}${GRANT_URL}?${p.toString()}`;
  }

  /**
   * Exchanges an authorization code for a user access token.
   * Call this after receiving the `code` from a user redirect.
   */
  async exchangeCode(clientId: string, clientSecret: string, code: string): Promise<TokenResponse> {
    return this.http.post<TokenResponse>(
      TOKEN_URL,
      { client_id: clientId, client_secret: clientSecret, grant_type: "authorization_code", code },
      { contentType: "application/x-www-form-urlencoded" }
    );
  }

  /**
   * Refreshes an expired access token using a refresh token.
   * The response will contain a new `access_token` and `refresh_token`.
   */
  async refreshAccessToken(
    clientId: string,
    clientSecret: string,
    refreshToken: string
  ): Promise<TokenResponse> {
    return this.http.post<TokenResponse>(
      TOKEN_URL,
      {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      },
      { contentType: "application/x-www-form-urlencoded" }
    );
  }

  /**
   * Creates an authorization grant for a specific user and scope.
   * Returns a short-lived `code` that can be exchanged for a user access token.
   *
   * Requires `authorization:grant` scope on the client credentials token.
   */
  async createAuthorization(params: CreateAuthorizationParams): Promise<{ code: string }> {
    return this.http.post<{ code: string }>(
      GRANT_URL,
      { user_id: params.userId, scope: params.scope },
      { contentType: "application/x-www-form-urlencoded" }
    );
  }

  /**
   * Delegates an authorization grant to an actor client (for Tink Link flows).
   * The returned `code` is used to build Tink Link URLs.
   *
   * Requires `authorization:grant` scope on the client credentials token.
   */
  async delegateAuthorization(
    params: DelegateAuthorizationParams,
    defaultClientId: string
  ): Promise<{ code: string }> {
    return this.http.post<{ code: string }>(
      DELEGATE_URL,
      {
        user_id: params.userId,
        id_hint: params.idHint,
        scope: params.scope,
        actor_client_id: params.actorClientId ?? defaultClientId,
      },
      { contentType: "application/x-www-form-urlencoded" }
    );
  }

  /**
   * Validates the current access token by probing the user endpoint.
   * Returns true if the token is valid, false if it has expired or is invalid.
   */
  async validateToken(): Promise<boolean> {
    try {
      await this.http.get("/api/v1/user");
      return true;
    } catch {
      return false;
    }
  }
}
