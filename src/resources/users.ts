/**
 * Tink Users and Credentials API
 *
 * Manage Tink users and their bank credentials (connections).
 * Mutations (create, delete, refresh) automatically invalidate the
 * response cache for the affected user.
 *
 * https://docs.tink.com/api#users
 */
import type { HttpClient } from "../utils/http";
import type {
  CreateUserParams,
  TinkUser,
  Credential,
  CredentialsResponse,
  TokenResponse,
} from "../types";

export class Users {
  constructor(private readonly http: HttpClient) {}

  /**
   * Creates a new Tink user with an external user ID.
   * Store the returned `userId` in your database — you'll need it
   * to generate tokens and manage credentials.
   *
   * Required scope: `user:create`
   *
   * @example
   * ```ts
   * const user = await tink.users.createUser({
   *   externalUserId: "your_internal_user_id",
   *   locale: "en_US",
   *   market: "GB",
   * });
   * ```
   */
  async createUser(params: CreateUserParams): Promise<TinkUser> {
    return this.http.post<TinkUser>("/api/v1/user/create", {
      external_user_id: params.externalUserId,
      locale: params.locale,
      market: params.market,
    });
  }

  /**
   * Permanently deletes a user and all their connected bank data.
   * This action is irreversible. Cache is invalidated automatically.
   *
   * Required scope: `user:delete`
   */
  async deleteUser(userId: string): Promise<void> {
    await this.http.post("/api/v1/user/delete", { user_id: userId });
    this.http.invalidateUser(userId);
  }

  /**
   * Lists all bank credentials (connections) for the authenticated user.
   * Results are cached for 30 seconds (credentials change during auth flows).
   *
   * Required scope: `credentials:read`
   */
  async listCredentials(): Promise<CredentialsResponse> {
    return this.http.get<CredentialsResponse>("/api/v1/credentials/list");
  }

  /**
   * Gets a single credential by ID.
   * Cached for 30 seconds.
   *
   * Required scope: `credentials:read`
   */
  async getCredential(credentialId: string): Promise<Credential> {
    return this.http.get<Credential>(`/api/v1/credentials/${credentialId}`);
  }

  /**
   * Deletes a credential (bank connection) permanently.
   *
   * Required scope: `credentials:write`
   */
  async deleteCredential(credentialId: string): Promise<void> {
    await this.http.delete(`/api/v1/credentials/${credentialId}`);
  }

  /**
   * Triggers a data refresh for a credential (re-fetches data from the bank).
   * Cache is invalidated after refresh since account and transaction data changes.
   *
   * Required scope: `credentials:refresh`
   */
  async refreshCredential(credentialId: string): Promise<Credential> {
    const result = await this.http.post<Credential>(
      `/api/v1/credentials/${credentialId}/refresh`,
      {}
    );
    // Explicitly invalidate all cached user data since the bank data was refreshed
    this.http.invalidateUser();
    return result;
  }

  /**
   * Creates an authorization grant for a user, returning a short-lived code.
   * Exchange the code for a user access token via `getUserAccessToken()`.
   *
   * Required scope: `authorization:grant`
   */
  async createAuthorization(params: { userId: string; scope: string }): Promise<{ code: string }> {
    return this.http.post<{ code: string }>(
      "/api/v1/oauth/authorization-grant",
      { user_id: params.userId, scope: params.scope },
      { contentType: "application/x-www-form-urlencoded" }
    );
  }

  /**
   * Exchanges an authorization code for a user access token.
   * The returned `access_token` can be set on the client to make user-scoped calls.
   */
  async getUserAccessToken(
    clientId: string,
    clientSecret: string,
    code: string
  ): Promise<TokenResponse> {
    return this.http.post<TokenResponse>(
      "/api/v1/oauth/token",
      { client_id: clientId, client_secret: clientSecret, grant_type: "authorization_code", code },
      { contentType: "application/x-www-form-urlencoded" }
    );
  }
}
