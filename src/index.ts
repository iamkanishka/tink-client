/**
 * TinkClient — top-level SDK entrypoint.
 *
 * Wires all application services through a single shared HttpClient.
 * Every service is exposed as a named property so callers use:
 *
 *   const tink = new TinkClient({ clientId, clientSecret });
 *   const token = await tink.auth.clientCredentials("accounts:read");
 *   const accounts = await tink.accounts.listAll();
 *
 * @example
 * ```ts
 * const tink = new TinkClient({
 *   clientId: process.env.TINK_CLIENT_ID,
 *   clientSecret: process.env.TINK_CLIENT_SECRET,
 *   webhookSecret: process.env.TINK_WEBHOOK_SECRET,
 *   cache: true,
 * });
 * ```
 */

import { TinkError } from "./domain/errors.js";
import type { TinkConfig, TokenResponse } from "./domain/types.js";
import { HttpClient } from "./infrastructure/http.js";
import { RateLimiter } from "./infrastructure/rate_limiter.js";
import { WebhookService } from "./infrastructure/webhook.js";
import { AuthService } from "./application/auth.js";
import { AccountsService } from "./application/accounts.js";
import { TransactionsService } from "./application/transactions.js";
import { ProvidersService } from "./application/providers.js";
import {
  UsersService,
  InvestmentsService,
  LoansService,
} from "./application/users_investments_loans.js";
import { FinanceService } from "./application/finance.js";
import { VerificationService } from "./application/verification.js";
import { ConnectivityService } from "./application/connectivity.js";

export { TinkError } from "./domain/errors.js";
export type * from "./domain/types.js";

/** The Tink Open Banking SDK client. */
export class TinkClient {
  /** OAuth flows, authorization grants, token caching. */
  readonly auth: AuthService;

  /** Bank accounts, credentials, identity. */
  readonly accounts: AccountsService;

  /** Transactions, enriched transactions, categories, statistics. */
  readonly transactions: TransactionsService;

  /** Financial institution reference data. */
  readonly providers: ProvidersService;

  /** User management (create, delete, profile). */
  readonly users: UsersService;

  /** Investment accounts and holdings. */
  readonly investments: InvestmentsService;

  /** Loan accounts. */
  readonly loans: LoansService;

  /** Budgets, cash flow summaries, financial calendar. */
  readonly finance: FinanceService;

  /** Account check, balance check, income/expense/risk verification products. */
  readonly verification: VerificationService;

  /** Provider connectivity monitoring, Connector ingestion, Tink Link URL builders. */
  readonly connectivity: ConnectivityService;

  /** Webhook HMAC-SHA256 verification and typed event dispatch. */
  readonly webhooks: WebhookService;

  /** The underlying HTTP transport — use for advanced scenarios only. */
  readonly http: HttpClient;

  constructor(config: TinkConfig = {}) {
    const clientId = config.clientId ?? process.env["TINK_CLIENT_ID"] ?? "";
    const clientSecret = config.clientSecret ?? process.env["TINK_CLIENT_SECRET"] ?? "";
    const webhookSecret = config.webhookSecret ?? process.env["TINK_WEBHOOK_SECRET"] ?? "";

    if (!clientId) {
      throw TinkError.validation(
        "clientId is required. Pass it as config.clientId or set TINK_CLIENT_ID.",
      );
    }

    const rateLimiter = new RateLimiter({ rate: 10, burst: 30 }); // 10 req/s, burst 30

    this.http = new HttpClient({
      ...(config.baseUrl !== undefined ? { baseUrl: config.baseUrl } : {}),
      ...(config.accessToken !== undefined ? { token: config.accessToken } : {}),
      ...(config.userId !== undefined ? { userId: config.userId } : {}),
      ...(config.timeoutMs !== undefined ? { timeoutMs: config.timeoutMs } : {}),
      ...(config.maxRetries !== undefined ? { maxRetries: config.maxRetries } : {}),
      ...(config.cache !== undefined ? { cache: config.cache } : {}),
      ...(config.cacheMaxSize !== undefined ? { cacheMaxSize: config.cacheMaxSize } : {}),
      ...(config.fetchFn !== undefined ? { fetchFn: config.fetchFn } : {}),
      ...(config.defaultHeaders !== undefined ? { defaultHeaders: config.defaultHeaders } : {}),
      rateLimiter,
    });

    this.auth = new AuthService(this.http, clientId, clientSecret);
    this.accounts = new AccountsService(this.http);
    this.transactions = new TransactionsService(this.http);
    this.providers = new ProvidersService(this.http);
    this.users = new UsersService(this.http);
    this.investments = new InvestmentsService(this.http);
    this.loans = new LoansService(this.http);
    this.finance = new FinanceService(this.http);
    this.verification = new VerificationService(this.http, clientId);
    this.connectivity = new ConnectivityService(this.http, clientId);
    this.webhooks = new WebhookService(webhookSecret);
  }

  /**
   * Convenience: acquire an app-level token and update the HTTP client's
   * bearer token in one call. Returns the full token response.
   */
  async authenticate(scope: string): Promise<TokenResponse> {
    const token = await this.auth.clientCredentials(scope);
    this.http.setToken(token.access_token);
    return token;
  }

  /** Flush the entire response cache. */
  flushCache(): void {
    this.http.flushCache();
  }
}
