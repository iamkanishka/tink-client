/**
 * Tink Transactions API
 *
 * Access transaction history for connected bank accounts.
 * Supports both one-time access (single authorization) and
 * continuous access (persistent users with recurring data sync).
 *
 * Required scopes: `accounts:read`, `transactions:read`
 * https://docs.tink.com/api#transactions
 */
import type { HttpClient } from "../utils/http";
import type {
  AccountsResponse,
  TransactionsResponse,
  TransactionsListOpts,
  TokenResponse,
  PaginationOpts,
} from "../types";
import { buildUrl } from "../utils/helpers";

/**
 * One-time and recurring transaction access.
 * Use for standard transaction listing after any authorization flow.
 */
export class Transactions {
  constructor(private readonly http: HttpClient) {}

  /**
   * Lists all accounts for the authenticated user.
   * @see {@link Accounts.listAccounts} for full documentation
   */
  async listAccounts(opts: PaginationOpts = {}): Promise<AccountsResponse> {
    return this.http.get<AccountsResponse>(buildUrl("/data/v2/accounts", opts));
  }

  /**
   * Lists transactions with optional filtering and pagination.
   *
   * @example
   * ```ts
   * const { transactions } = await tink.transactions.listTransactions({
   *   bookedDateGte: "2024-01-01",
   *   bookedDateLte: "2024-01-31",
   *   statusIn: ["BOOKED"],
   *   pageSize: 100,
   * });
   * ```
   */
  async listTransactions(opts: TransactionsListOpts = {}): Promise<TransactionsResponse> {
    return this.http.get<TransactionsResponse>(buildUrl("/data/v2/transactions", opts));
  }
}

/**
 * One-time access to transactions — for single-authorization flows.
 * No persistent user is created; access expires with the token.
 *
 * Flow:
 * 1. User authorizes via Tink Link
 * 2. Exchange authorization code for user access token
 * 3. Call `listAccounts()` and `listTransactions()`
 */
export class TransactionsOneTimeAccess {
  constructor(private readonly http: HttpClient) {}

  /** Lists accounts for the one-time authorized user */
  async listAccounts(opts: PaginationOpts = {}): Promise<AccountsResponse> {
    return this.http.get<AccountsResponse>(buildUrl("/data/v2/accounts", opts));
  }

  /** Lists transactions for the one-time authorized user */
  async listTransactions(opts: TransactionsListOpts = {}): Promise<TransactionsResponse> {
    return this.http.get<TransactionsResponse>(buildUrl("/data/v2/transactions", opts));
  }
}

/**
 * Continuous access to transactions — for persistent user flows.
 * Creates a permanent Tink user that can be re-authorized repeatedly.
 *
 * Flow:
 * 1. `createUser()` — create a permanent user (once per customer)
 * 2. `grantUserAccess()` — delegate Tink Link access
 * 3. `buildTinkLink()` — redirect user to Tink Link to connect their bank
 * 4. `createAuthorization()` — create data access grant
 * 5. `getUserAccessToken()` — exchange code for user access token
 * 6. `listAccounts()` / `listTransactions()` — fetch data on demand
 */
export class TransactionsContinuousAccess {
  constructor(
    private readonly http: HttpClient,
    private readonly actorClientId?: string
  ) {}

  /**
   * Creates a permanent Tink user for continuous data access.
   * Store the returned `user_id` — you'll need it for all subsequent calls.
   *
   * @example
   * ```ts
   * const user = await tink.transactionsContinuousAccess.createUser({
   *   externalUserId: "your_internal_user_id",
   *   market: "GB",
   *   locale: "en_US",
   * });
   * await db.users.update({ tinkUserId: user.user_id });
   * ```
   */
  async createUser(params: {
    externalUserId: string;
    locale: string;
    market: string;
  }): Promise<{ user_id: string }> {
    return this.http.post<{ user_id: string }>("/api/v1/user/create", {
      external_user_id: params.externalUserId,
      locale: params.locale,
      market: params.market,
    });
  }

  /**
   * Generates an authorization code for building a Tink Link URL.
   * The user clicks this link to connect their bank account.
   */
  async grantUserAccess(params: {
    userId: string;
    idHint: string;
    scope: string;
    actorClientId?: string;
  }): Promise<{ code: string }> {
    return this.http.post<{ code: string }>(
      "/api/v1/oauth/authorization-grant/delegate",
      {
        user_id: params.userId,
        id_hint: params.idHint,
        actor_client_id: params.actorClientId ?? this.actorClientId ?? "",
        scope: params.scope,
      },
      { contentType: "application/x-www-form-urlencoded" }
    );
  }

  /**
   * Builds the Tink Link URL to redirect the user to for bank connection.
   * Returns a URL string — redirect your user to this URL.
   */
  buildTinkLink(
    authorizationCode: string,
    opts: { clientId: string; redirectUri: string; market: string; locale: string }
  ): string {
    const q = new URLSearchParams({
      client_id: opts.clientId,
      redirect_uri: opts.redirectUri,
      authorization_code: authorizationCode,
      market: opts.market,
      locale: opts.locale,
    });
    return `https://link.tink.com/1.0/transactions/connect-accounts?${q.toString()}`;
  }

  /**
   * Creates a data authorization grant for an existing user.
   * Returns a `code` to exchange for a user access token.
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
   * Call this after `createAuthorization()`.
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

  /** Lists accounts for the continuous access user */
  async listAccounts(opts: PaginationOpts = {}): Promise<AccountsResponse> {
    return this.http.get<AccountsResponse>(buildUrl("/data/v2/accounts", opts));
  }

  /** Lists transactions for the continuous access user */
  async listTransactions(opts: TransactionsListOpts = {}): Promise<TransactionsResponse> {
    return this.http.get<TransactionsResponse>(buildUrl("/data/v2/transactions", opts));
  }
}
