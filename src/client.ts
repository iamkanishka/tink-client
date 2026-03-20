/**
 * TinkClient — the main entry point for all Tink Open Banking API operations.
 *
 * Create a single instance per application and reuse it across requests.
 * It handles authentication, HTTP, caching, and retry automatically.
 *
 * @example
 * ```ts
 * import { TinkClient } from "tink-client";
 *
 * const tink = new TinkClient({
 *   clientId:     process.env.TINK_CLIENT_ID,
 *   clientSecret: process.env.TINK_CLIENT_SECRET,
 * });
 *
 * // Acquire a client credentials token (sets it automatically)
 * await tink.authenticate("accounts:read transactions:read");
 *
 * // Start making API calls
 * const { accounts } = await tink.accounts.listAccounts();
 * ```
 */
import { HttpClient } from "./utils/http";
import { TinkError } from "./utils/error";
import { WebhookVerifier } from "./utils/webhook_verifier";
import { WebhookHandler } from "./utils/webhook_handler";

import {
  Auth,
  Accounts,
  Transactions,
  TransactionsOneTimeAccess,
  TransactionsContinuousAccess,
  Providers,
  Categories,
  Statistics,
  Users,
  Investments,
  Loans,
  Budgets,
  CashFlow,
  FinancialCalendar,
  AccountCheck,
  BalanceCheck,
  IncomeCheck,
  ExpenseCheck,
  RiskInsights,
  RiskCategorisation,
  BusinessAccountCheck,
  Connector,
  Link,
  Connectivity,
} from "./resources";

import type { TinkConfig } from "./types";

const VERSION = "1.0.0";
const DEFAULT_BASE = "https://api.tink.com";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

export class TinkClient {
  // ── Authentication ─────────────────────────────────────────────────────────
  /** OAuth 2.0 flows — client credentials, auth code exchange, token refresh */
  readonly auth: Auth;

  // ── Account aggregation ────────────────────────────────────────────────────
  /** Bank account data and balances */
  readonly accounts: Accounts;
  /** Transaction listing (one-time and recurring) */
  readonly transactions: Transactions;
  /** One-time transaction access — single authorization, no persistent user */
  readonly transactionsOneTimeAccess: TransactionsOneTimeAccess;
  /** Continuous transaction access — persistent users with recurring sync */
  readonly transactionsContinuousAccess: TransactionsContinuousAccess;

  // ── Reference data ─────────────────────────────────────────────────────────
  /** Financial institutions supported by Tink (cached 1 hour) */
  readonly providers: Providers;
  /** Transaction categories (cached 24 hours) */
  readonly categories: Categories;
  /** Aggregated financial statistics (cached 1 hour) */
  readonly statistics: Statistics;

  // ── Users & credentials ────────────────────────────────────────────────────
  /** Tink user and credential management */
  readonly users: Users;

  // ── Investments & loans ────────────────────────────────────────────────────
  /** Investment accounts and holdings */
  readonly investments: Investments;
  /** Loan and mortgage accounts */
  readonly loans: Loans;

  // ── Finance management ─────────────────────────────────────────────────────
  /** Budget creation and progress tracking */
  readonly budgets: Budgets;
  /** Cash flow summaries by time resolution */
  readonly cashFlow: CashFlow;
  /** Financial calendar events with reconciliation */
  readonly financialCalendar: FinancialCalendar;

  // ── Verification ──────────────────────────────────────────────────────────
  /** Account ownership verification */
  readonly accountCheck: AccountCheck;
  /** Real-time balance verification and refresh */
  readonly balanceCheck: BalanceCheck;
  /** Business account verification */
  readonly businessAccountCheck: BusinessAccountCheck;

  // ── Risk & analytics ──────────────────────────────────────────────────────
  /** Income verification reports */
  readonly incomeCheck: IncomeCheck;
  /** Expense analysis reports */
  readonly expenseCheck: ExpenseCheck;
  /** Financial risk scoring reports */
  readonly riskInsights: RiskInsights;
  /** Transaction-level risk categorisation reports */
  readonly riskCategorisation: RiskCategorisation;

  // ── Infrastructure ─────────────────────────────────────────────────────────
  /** Ingest your own account and transaction data */
  readonly connector: Connector;
  /** Build Tink Link URLs for end-user bank connections */
  readonly link: Link;
  /** Monitor provider and credential connectivity */
  readonly connectivity: Connectivity;

  // ── Internal ───────────────────────────────────────────────────────────────
  private readonly http: HttpClient;
  private readonly _clientId: string | undefined;
  private readonly _clientSecret: string | undefined;
  private readonly _baseUrl: string;

  constructor(config: TinkConfig = {}) {
    this._clientId = config.clientId ?? process.env["TINK_CLIENT_ID"];
    this._clientSecret = config.clientSecret ?? process.env["TINK_CLIENT_SECRET"];
    const token = config.accessToken ?? process.env["TINK_ACCESS_TOKEN"];
    this._baseUrl = config.baseUrl ?? process.env["TINK_BASE_URL"] ?? DEFAULT_BASE;

    this.http = new HttpClient({
      baseUrl: this._baseUrl,
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT,
      maxRetries: config.maxRetries ?? DEFAULT_RETRIES,
      cache: config.cache ?? true,
      cacheMaxSize: config.cacheMaxSize ?? 512,
      accessToken: token,
      userId: config.userId,
      fetchFn: config.fetchFn,
      defaultHeaders: {
        "user-agent": `tink-client/${VERSION}`,
        ...config.defaultHeaders,
      },
    });

    this.auth = new Auth(this.http, this._baseUrl);

    this.accounts = new Accounts(this.http);
    this.transactions = new Transactions(this.http);
    this.transactionsOneTimeAccess = new TransactionsOneTimeAccess(this.http);
    this.transactionsContinuousAccess = new TransactionsContinuousAccess(this.http, this._clientId);

    this.providers = new Providers(this.http);
    this.categories = new Categories(this.http);
    this.statistics = new Statistics(this.http);

    this.users = new Users(this.http);

    this.investments = new Investments(this.http);
    this.loans = new Loans(this.http);

    this.budgets = new Budgets(this.http);
    this.cashFlow = new CashFlow(this.http);
    this.financialCalendar = new FinancialCalendar(this.http);

    this.accountCheck = new AccountCheck(this.http);
    this.balanceCheck = new BalanceCheck(this.http);
    this.businessAccountCheck = new BusinessAccountCheck(this.http);

    this.incomeCheck = new IncomeCheck(this.http);
    this.expenseCheck = new ExpenseCheck(this.http);
    this.riskInsights = new RiskInsights(this.http);
    this.riskCategorisation = new RiskCategorisation(this.http);

    this.connector = new Connector(this.http);
    this.link = new Link();
    this.connectivity = new Connectivity(this.http);
  }

  // ── Token management ───────────────────────────────────────────────────────

  /** The Tink client ID used for authentication */
  get clientId(): string | undefined {
    return this._clientId;
  }

  /** The Tink client secret used for authentication */
  get clientSecret(): string | undefined {
    return this._clientSecret;
  }

  /** The currently active bearer token */
  get accessToken(): string | undefined {
    return this.http.accessToken;
  }

  /**
   * Sets a bearer token for all subsequent API requests.
   * Returns `this` for method chaining.
   *
   * @example
   * ```ts
   * tink.setAccessToken(tokenResponse.access_token);
   * ```
   */
  setAccessToken(token: string): this {
    this.http.setAccessToken(token);
    return this;
  }

  /**
   * Acquires a client credentials token and sets it automatically.
   * This is the recommended way to authenticate for server-to-server calls.
   * Returns `this` for method chaining.
   *
   * @param scope - Space-separated OAuth scopes
   *
   * @example
   * ```ts
   * await tink.authenticate("accounts:read transactions:read");
   * const { accounts } = await tink.accounts.listAccounts();
   * ```
   */
  async authenticate(scope: string): Promise<this> {
    if (!this._clientId || !this._clientSecret) {
      throw TinkError.validation(
        "clientId and clientSecret are required. " +
          "Pass them in TinkConfig or set the TINK_CLIENT_ID and TINK_CLIENT_SECRET environment variables."
      );
    }
    const { access_token } = await this.auth.getAccessToken(
      this._clientId,
      this._clientSecret,
      scope
    );
    this.http.setAccessToken(access_token);
    return this;
  }

  // ── Cache management ───────────────────────────────────────────────────────

  /**
   * Clears all cached API responses.
   * Returns `this` for method chaining.
   */
  clearCache(): this {
    this.http.invalidateCache();
    return this;
  }

  /**
   * Invalidates cache entries whose URL path starts with the given prefix.
   * Useful for selectively refreshing specific resource types.
   * Returns `this` for method chaining.
   *
   * @example
   * ```ts
   * // Force-refresh all provider data on next request
   * tink.invalidateCache("/api/v1/providers");
   * ```
   */
  invalidateCache(prefix: string): this {
    this.http.invalidateCache(prefix);
    return this;
  }

  // ── Webhook factories ──────────────────────────────────────────────────────

  /**
   * Creates a WebhookHandler for receiving and dispatching Tink webhooks.
   *
   * The handler verifies HMAC-SHA256 signatures, parses event payloads,
   * and dispatches to your registered handler functions.
   *
   * @param secret - Your webhook signing secret from the Tink console
   *
   * @example
   * ```ts
   * const webhooks = tink.createWebhookHandler(process.env.TINK_WEBHOOK_SECRET!);
   *
   * webhooks
   *   .registerHandler("credentials.updated", async (event) => {
   *     await syncUserData(event.data.userId as string);
   *   })
   *   .registerHandler("credentials.refresh.failed", async (event) => {
   *     await notifyUser(event.data.userId as string);
   *   });
   *
   * // Express route handler:
   * app.post("/webhooks/tink", express.text({ type: "*\/*" }), async (req, res) => {
   *   const event = await webhooks.handleWebhook(
   *     req.body,
   *     req.headers["x-tink-signature"]
   *   );
   *   res.sendStatus(200);
   * });
   * ```
   */
  createWebhookHandler(secret: string): WebhookHandler {
    return new WebhookHandler(new WebhookVerifier(secret));
  }

  /**
   * Creates a standalone WebhookVerifier for manual HMAC-SHA256 signature checking.
   * Use when you want to verify signatures without the full handler machinery.
   *
   * @param secret - Your webhook signing secret from the Tink console
   */
  createWebhookVerifier(secret: string): WebhookVerifier {
    return new WebhookVerifier(secret);
  }

  // ── Meta ───────────────────────────────────────────────────────────────────

  /**
   * Returns client metadata: package version, configured base URL,
   * and whether a bearer token is currently set.
   */
  info(): { version: string; baseUrl: string; hasToken: boolean } {
    return {
      version: VERSION,
      baseUrl: this._baseUrl,
      hasToken: !!this.http.accessToken,
    };
  }
}
