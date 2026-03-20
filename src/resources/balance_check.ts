/**
 * Tink Balance Check API
 *
 * Real-time balance verification with continuous access.
 * Supports on-demand balance refresh, refresh status polling,
 * and consent lifecycle management.
 *
 * Flow:
 * 1. `createUser()` + `grantUserAccess()` — set up the user (once)
 * 2. `buildAccountCheckLink()` — redirect user to connect their bank
 * 3. `getAccountCheckReport()` — retrieve the initial account check report
 * 4. `createAuthorization()` + `getUserAccessToken()` — get user token
 * 5. `refreshBalance()` — trigger on-demand balance fetch
 * 6. `getRefreshStatus()` — poll until status is "COMPLETED"
 * 7. `getAccountBalance()` — read the updated balance
 *
 * https://docs.tink.com/resources/account-check
 */
import type { HttpClient } from "../utils/http";
import type {
  TinkUser,
  TokenResponse,
  BalanceRefreshResponse,
  BalanceRefreshStatus,
  AccountCheckReport,
  GrantUserAccessParams,
  BuildAccountCheckLinkParams,
  ConsentUpdateLinkParams,
} from "../types";

const LINK_BASE = "https://link.tink.com/1.0";

export class BalanceCheck {
  constructor(private readonly http: HttpClient) {}

  // ── User setup ─────────────────────────────────────────────────────────────

  /**
   * Creates a permanent Tink user for balance checking.
   * Required scope: `user:create`
   */
  async createUser(params: {
    externalUserId: string;
    market: string;
    locale: string;
  }): Promise<TinkUser> {
    return this.http.post<TinkUser>("/api/v1/user/create", {
      external_user_id: params.externalUserId,
      market: params.market,
      locale: params.locale,
    });
  }

  /**
   * Grants a user Tink Link access for initial bank connection.
   * Returns an authorization code for building the Tink Link URL.
   *
   * Required scope: `authorization:grant`
   */
  async grantUserAccess(
    params: GrantUserAccessParams,
    defaultClientId: string
  ): Promise<{ code: string }> {
    return this.http.post<{ code: string }>(
      "/api/v1/oauth/authorization-grant/delegate",
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
   * Builds the Tink Link URL for Account Check with balance verification.
   * Redirect the user to this URL. After authentication, Tink redirects
   * to your `redirectUri` with an `account_verification_report_id`.
   *
   * @example
   * ```ts
   * const url = tink.balanceCheck.buildAccountCheckLink(grant, {
   *   clientId, market: "SE", redirectUri: "https://yourapp.com/callback",
   * });
   * // Redirect user to url
   * ```
   */
  buildAccountCheckLink(grant: { code: string }, opts: BuildAccountCheckLinkParams): string {
    const p = new URLSearchParams({
      client_id: opts.clientId,
      state: opts.state ?? "OPTIONAL",
      redirect_uri: opts.redirectUri,
      authorization_code: grant.code,
      market: opts.market,
      test: String(opts.test ?? false),
    });
    return `${LINK_BASE}/account-check/connect?${p.toString()}`;
  }

  // ── Report retrieval ───────────────────────────────────────────────────────

  /**
   * Retrieves an Account Check report containing account and balance data.
   * Required scope: `account-verification-reports:read`
   */
  async getAccountCheckReport(reportId: string): Promise<AccountCheckReport> {
    return this.http.get<AccountCheckReport>(`/api/v1/account-verification-reports/${reportId}`);
  }

  // ── Balance operations ─────────────────────────────────────────────────────

  /**
   * Creates an authorization grant for balance operations.
   * Returns a code to exchange for a user access token.
   *
   * Recommended scope:
   * `accounts.balances:readonly,balance-refresh,accounts:read,provider-consents:read,balance-refresh:readonly`
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

  /**
   * Triggers an asynchronous real-time balance refresh from the bank.
   * Use `getRefreshStatus()` to poll until `status === "COMPLETED"`.
   *
   * Required scope: `balance-refresh`
   *
   * @example
   * ```ts
   * const { balanceRefreshId } = await tink.balanceCheck.refreshBalance(accountId);
   *
   * // Poll for completion
   * let status;
   * do {
   *   await new Promise(r => setTimeout(r, 1000));
   *   status = await tink.balanceCheck.getRefreshStatus(balanceRefreshId);
   * } while (status.status !== "COMPLETED" && status.status !== "FAILED");
   * ```
   */
  async refreshBalance(accountId: string): Promise<BalanceRefreshResponse> {
    return this.http.post<BalanceRefreshResponse>("/api/v1/balance-refresh", {
      accountId,
    });
  }

  /**
   * Gets the current status of a balance refresh operation.
   *
   * Status values:
   * - `INITIATED` — refresh started
   * - `IN_PROGRESS` — fetching from bank
   * - `COMPLETED` — balance data is updated
   * - `FAILED` — refresh could not complete
   *
   * Required scope: `balance-refresh:readonly`
   */
  async getRefreshStatus(refreshId: string): Promise<BalanceRefreshStatus> {
    return this.http.get<BalanceRefreshStatus>(`/api/v1/balance-refresh/${refreshId}`);
  }

  /**
   * Gets the current balance for a specific account.
   * Call this after a refresh completes.
   *
   * Required scope: `accounts.balances:readonly`
   */
  async getAccountBalance(accountId: string): Promise<unknown> {
    return this.http.get(`/data/v2/accounts/${accountId}/balances`);
  }

  // ── Consent management ─────────────────────────────────────────────────────

  /**
   * Generates an authorization code for updating user consent.
   * Use when consent expires and needs to be renewed.
   *
   * Required scopes: `credentials:write`, `authorization:grant`
   */
  async grantConsentUpdate(
    params: GrantUserAccessParams,
    defaultClientId: string
  ): Promise<{ code: string }> {
    return this.http.post<{ code: string }>(
      "/api/v1/oauth/authorization-grant/delegate",
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
   * Builds the Tink Link URL for consent renewal.
   * Redirect the user to this URL to re-authorise balance access.
   */
  buildConsentUpdateLink(grant: { code: string }, opts: ConsentUpdateLinkParams): string {
    const p = new URLSearchParams({
      client_id: opts.clientId,
      redirect_uri: opts.redirectUri,
      credentials_id: opts.credentialsId,
      authorization_code: grant.code,
      market: opts.market,
    });
    return `link.tink.com/1.0/account-check/update-consent?${p.toString()}`;
  }
}
