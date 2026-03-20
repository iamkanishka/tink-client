/**
 * Tink Account Check API
 *
 * Verify bank account ownership by matching user information against
 * bank records. Supports two verification flows:
 *
 * **1. One-time verification (user-match)**
 * Creates a Tink Link session with user details. Tink matches the
 * name against bank records and returns a verification report.
 * Best for KYC, onboarding, and one-time verification.
 *
 * **2. Continuous access**
 * Creates a persistent user with ongoing access for repeated
 * verification and transaction monitoring.
 *
 * https://docs.tink.com/resources/account-check
 */
import type { HttpClient } from "../utils/http";
import type {
  AccountCheckSession,
  CreateSessionParams,
  AccountCheckReport,
  AccountCheckReportsResponse,
  AccountPartiesResponse,
  AccountsResponse,
  TransactionsResponse,
  TransactionsListOpts,
  TokenResponse,
  TinkUser,
  PaginationOpts,
  GrantUserAccessParams,
  ContinuousAccessLinkParams,
} from "../types";
import { buildUrl } from "../utils/helpers";

const LINK_BASE = "https://link.tink.com/1.0";

export class AccountCheck {
  constructor(private readonly http: HttpClient) {}

  // ── One-time verification ──────────────────────────────────────────────────

  /**
   * Creates a Tink Link session for one-time account verification.
   * The session contains a `sessionId` used to build the Tink Link URL.
   *
   * Required scope: `link-session:write`
   *
   * @example
   * ```ts
   * const session = await tink.accountCheck.createSession({
   *   user: { firstName: "Jane", lastName: "Smith" },
   *   market: "GB",
   * });
   * const url = tink.accountCheck.buildLinkUrl(session, { clientId, market: "GB" });
   * // Redirect user to url
   * ```
   */
  async createSession(params: CreateSessionParams): Promise<AccountCheckSession> {
    const body: Record<string, unknown> = {
      user: { firstName: params.user.firstName, lastName: params.user.lastName },
    };
    if (params.market) body["market"] = params.market;
    if (params.locale) body["locale"] = params.locale;
    if (params.redirectUri) body["redirectUri"] = params.redirectUri;
    return this.http.post<AccountCheckSession>("/link/v1/session", body);
  }

  /**
   * Builds the Tink Link URL for one-time account check.
   * Redirect the user to this URL to complete bank authentication.
   *
   * After completion, Tink redirects to your `redirectUri` with an
   * `account_verification_report_id` parameter.
   */
  buildLinkUrl(
    session: AccountCheckSession,
    opts: { clientId: string; market?: string; redirectUri?: string }
  ): string {
    const p = new URLSearchParams({
      client_id: opts.clientId,
      redirect_uri: opts.redirectUri ?? "https://console.tink.com/callback",
      market: opts.market ?? "GB",
      session_id: session.sessionId,
    });
    return `${LINK_BASE}/account-check?${p.toString()}`;
  }

  /**
   * Retrieves an account ownership verification report by ID.
   *
   * Report `verification.status` values:
   * - `MATCH` — name matched bank records
   * - `NO_MATCH` — name did not match
   * - `INDETERMINATE` — bank did not provide sufficient data
   *
   * Required scope: `account-verification-reports:read`
   */
  async getReport(reportId: string): Promise<AccountCheckReport> {
    return this.http.get<AccountCheckReport>(`/api/v1/account-verification-reports/${reportId}`);
  }

  /**
   * Downloads a verification report as a PDF binary.
   *
   * @param template - PDF template to use. Defaults to "standard-1.0"
   * Required scope: `account-verification-reports:read`
   */
  async getReportPdf(reportId: string, template = "standard-1.0"): Promise<ArrayBuffer> {
    return this.http.get<ArrayBuffer>(
      `/api/v1/account-verification-reports/${reportId}/pdf?template=${encodeURIComponent(template)}`
    );
  }

  /**
   * Lists all account verification reports.
   * Required scope: `account-verification-reports:read`
   */
  async listReports(opts: PaginationOpts = {}): Promise<AccountCheckReportsResponse> {
    return this.http.get<AccountCheckReportsResponse>(
      buildUrl("/api/v1/account-verification-reports", opts)
    );
  }

  // ── Continuous access flow ─────────────────────────────────────────────────

  /**
   * Creates a permanent user for continuous account access.
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
   * Delegates authorization to the user for Tink Link access.
   * Returns a code used to build the Tink Link URL.
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
   * Builds the Tink Link URL for the continuous access flow.
   * Redirect the user to this URL to connect their bank account.
   */
  buildContinuousAccessLink(grant: { code: string }, opts: ContinuousAccessLinkParams): string {
    const p = new URLSearchParams({
      client_id: opts.clientId,
      products: opts.products ?? "ACCOUNT_CHECK,TRANSACTIONS",
      redirect_uri: opts.redirectUri,
      authorization_code: grant.code,
      market: opts.market,
      locale: opts.locale,
    });
    return `${LINK_BASE}/products/connect-accounts?${p.toString()}`;
  }

  /**
   * Creates a data authorization grant for an existing user.
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

  /** Lists accounts for the connected user. Required scope: `accounts:read` */
  async listAccounts(opts: PaginationOpts = {}): Promise<AccountsResponse> {
    return this.http.get<AccountsResponse>(buildUrl("/data/v2/accounts", opts));
  }

  /**
   * Gets account parties (owners, co-owners) for a specific account.
   * Required scope: `accounts.parties:readonly`
   */
  async getAccountParties(accountId: string): Promise<AccountPartiesResponse> {
    return this.http.get<AccountPartiesResponse>(`/data/v2/accounts/${accountId}/parties`);
  }

  /**
   * Lists user identity records from connected bank accounts.
   * Returns name, address, and national ID data.
   * Required scope: `identities:readonly`
   */
  async listIdentities(): Promise<unknown> {
    return this.http.get("/data/v2/identities");
  }

  /**
   * Lists transactions for the connected user.
   * Required scope: `transactions:read`
   */
  async listTransactions(opts: TransactionsListOpts = {}): Promise<TransactionsResponse> {
    return this.http.get<TransactionsResponse>(buildUrl("/data/v2/transactions", opts));
  }

  /**
   * Permanently deletes a Tink user and all their data.
   * Required scope: `user:delete`
   */
  async deleteUser(userId: string): Promise<void> {
    await this.http.delete(`/api/v1/user/${userId}`);
  }
}
