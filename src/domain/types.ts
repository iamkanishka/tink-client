/**
 * tink-client — Pure domain type definitions.
 *
 * All types in this file are pure value objects with no dependencies.
 * They mirror the domain aggregates in the Go and Elixir SDKs exactly,
 * with snake_case wire names matching the real Tink API.
 */

// ── SDK Configuration ─────────────────────────────────────────────────────────

/** Configuration options for TinkClient. */
export interface TinkConfig {
  /** Tink application client_id (or set TINK_CLIENT_ID env var). */
  clientId?: string;
  /** Tink application client_secret (or set TINK_CLIENT_SECRET env var). */
  clientSecret?: string;
  /** HMAC-SHA256 webhook signing secret (or set TINK_WEBHOOK_SECRET env var). */
  webhookSecret?: string;
  /** Pre-existing bearer token — bypasses the client credentials flow. */
  accessToken?: string;
  /** Tink user ID — used to scope LRU cache invalidation per user. */
  userId?: string;
  /** API base URL. Defaults to https://api.tink.com. */
  baseUrl?: string;
  /** Per-request timeout in milliseconds. Defaults to 30 000. */
  timeoutMs?: number;
  /** Maximum retry attempts on retryable errors. Defaults to 3. */
  maxRetries?: number;
  /** Enable in-memory LRU response caching. Defaults to true. */
  cache?: boolean;
  /** Maximum number of LRU cache entries. Defaults to 512. */
  cacheMaxSize?: number;
  /** Override the global `fetch` implementation (e.g. for testing). */
  fetchFn?: typeof fetch;
  /** Additional HTTP headers sent on every request. */
  defaultHeaders?: Record<string, string>;
}

// ── Retry ─────────────────────────────────────────────────────────────────────

/** Options controlling the exponential back-off retry strategy. */
export interface RetryOptions {
  /** Total maximum attempts (including the first). Defaults to 3. */
  maxAttempts?: number;
  /** Base delay in milliseconds before the first retry. Defaults to 1 000. */
  baseDelayMs?: number;
  /** Upper bound on per-attempt delay. Defaults to 30 000. */
  maxDelayMs?: number;
  /** Jitter factor applied to the computed delay. Defaults to 0.1. */
  jitterFactor?: number;
  /** Custom predicate: return true to retry on a specific error. */
  shouldRetry?: (err: { type: string; status?: number }) => boolean;
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

/** Current rate-limit state for a key. */
export interface RateLimitInfo {
  count: number;
  limit: number | "infinity";
  remaining: number | "infinity";
  resetsInMs: number;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

/** OAuth 2.0 token response returned by the Tink token endpoint. */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
}

/** Options for building a Tink OAuth authorisation URL. */
export interface AuthorizationUrlOpts {
  clientId: string;
  redirectUri: string;
  scope: string;
  state?: string;
  market?: string;
  locale?: string;
}

/**
 * Parameters for creating an authorization grant.
 *
 * The Tink endpoint accepts `application/x-www-form-urlencoded` with
 * snake_case keys (`user_id`, `external_user_id`, `scope`, `id_hint`).
 * Either `userId` or `externalUserId` must be provided; `scope` is required.
 */
export interface CreateAuthorizationParams {
  /** Tink-assigned user ID. Mutually exclusive with `externalUserId`. */
  userId?: string;
  /** Your system's identifier for the user. */
  externalUserId?: string;
  /** Space- or comma-separated scopes. */
  scope: string;
  /** Optional display hint shown in the Tink UI. */
  idHint?: string;
}

/**
 * Parameters for delegating an authorization grant.
 *
 * `actorClientId` is the `client_id` of the partner application that will
 * receive the delegated access. Required per the Tink API.
 */
export interface DelegateAuthorizationParams {
  /** Tink-assigned user ID. Mutually exclusive with `externalUserId`. */
  userId?: string;
  /** Your system's identifier for the user. */
  externalUserId?: string;
  /** Display hint for the user. */
  idHint?: string;
  /** Scopes to delegate. */
  scope: string;
  /**
   * The `client_id` of the application receiving the delegation.
   * Defaults to the SDK's own `clientId` when omitted.
   */
  actorClientId?: string;
}

// ── Money ─────────────────────────────────────────────────────────────────────

/** Monetary amount with an ISO 4217 currency code. */
export interface Amount {
  value: string;
  currencyCode: string;
}

/**
 * Exact decimal value encoded as `unscaledValue / 10^scale`.
 * Example: `{ unscaledValue: 12345, scale: 2 }` → 123.45.
 */
export interface ExactAmount {
  unscaledValue: number;
  scale: number;
}

/** Budget target amount (ExactAmount + currency code). */
export interface TargetAmount {
  value: ExactAmount;
  currencyCode: string;
}

// ── Pagination ────────────────────────────────────────────────────────────────

/** Common pagination parameters supported by all list endpoints. */
export interface PaginationOpts {
  pageSize?: number;
  pageToken?: string;
}

// ── Account ───────────────────────────────────────────────────────────────────

/** A single balance entry (booked, available, reserved, or credit limit). */
export interface AccountBalanceItem {
  amount: Amount;
}

/** All balance types for a bank account. */
export interface AccountBalances {
  booked?: AccountBalanceItem;
  available?: AccountBalanceItem;
  reserved?: AccountBalanceItem;
  creditLimit?: AccountBalanceItem;
}

/** Account identifiers (IBAN, sort code, PAN). */
export interface AccountIdentifiers {
  iban?: { iban: string; bban?: string };
  sortCode?: { code: string; accountNumber: string };
  pan?: { masked: string };
  bban?: { bban: string };
}

/** A bank account from the Tink aggregation API. */
export interface Account {
  id: string;
  name: string;
  type: string;
  subtype?: string;
  currency?: string;
  balances?: AccountBalances;
  identifiers?: AccountIdentifiers;
  providerName?: string;
  ownership?: string;
  flags?: string[];
  dates?: { opened?: string; lastRefreshed?: string };
  financialInstitution?: { id?: string; name?: string };
  credentialsId?: string;
}

/** Paginated accounts response. */
export interface AccountsResponse {
  accounts: Account[];
  nextPageToken?: string;
}

/** Filter options for listing accounts. */
export interface AccountsListOpts extends PaginationOpts {
  typeIn?: string[];
}

// ── Credentials ───────────────────────────────────────────────────────────────

/** A Tink credential (bank connection). */
export interface Credential {
  id: string;
  providerName: string;
  type?: string;
  status?: string;
  statusUpdated?: string;
  statusPayload?: string;
  updated?: string;
  fields?: Record<string, string>;
}

/** Credentials list response. */
export interface CredentialsResponse {
  credentials: Credential[];
}

// ── User ──────────────────────────────────────────────────────────────────────

/** Parameters for creating a Tink user. */
export interface CreateUserParams {
  externalUserId: string;
  locale: string;
  market: string;
}

/** A Tink platform user. */
export interface TinkUser {
  user_id?: string;
  userId?: string;
  externalUserId?: string;
  created?: string;
}

// ── Identity ──────────────────────────────────────────────────────────────────

/** Verified identity information for the authenticated user. */
export interface IdentityResponse {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  nationalId?: string;
}

// ── Transaction ───────────────────────────────────────────────────────────────

/** A financial transaction. */
export interface Transaction {
  id: string;
  accountId?: string;
  amount: Amount;
  descriptions?: { original?: string; display?: string; user?: string };
  dates?: { booked?: string; value?: string };
  identifiers?: { providerTransactionId?: string };
  merchantInformation?: { merchantName?: string; merchantCategoryCode?: string };
  categories?: { pfm?: { id: string; name: string } };
  status: string;
  types?: { type?: string; financialInstitutionTypeCode?: string };
  reference?: string;
}

/** Paginated transactions response. */
export interface TransactionsResponse {
  transactions: Transaction[];
  nextPageToken?: string;
}

/** Filter options for listing transactions. */
export interface TransactionsListOpts extends PaginationOpts {
  accountIdIn?: string[];
  bookedDateGte?: string;
  bookedDateLte?: string;
  statusIn?: string[];
  categoryIdIn?: string[];
}

/** Filter options for listing enriched transactions (max 100/page, default 10). */
export interface EnrichedTransactionsOpts extends PaginationOpts {
  accountIdIn?: string[];
  dateGte?: string;
  dateLte?: string;
}

// ── Provider ──────────────────────────────────────────────────────────────────

/** A financial institution supported by Tink. */
export interface Provider {
  name: string;
  displayName: string;
  type?: string;
  status?: string;
  market: string;
  capabilities?: string[];
  financialInstitutionId?: string;
  financialInstitutionName?: string;
  images?: { icon?: string; banner?: string };
}

/** Providers list response. */
export interface ProvidersResponse {
  providers: Provider[];
}

/** Filter options for listing providers. */
export interface ProvidersListOpts {
  market?: string;
  capabilities?: string[];
}

/** Result of a provider status check. */
export interface ProviderStatusResult {
  active: boolean;
  provider?: Provider;
}

// ── Category ──────────────────────────────────────────────────────────────────

/** A transaction category from Tink's taxonomy. */
export interface Category {
  id: string;
  code: string;
  description?: string;
  displayName?: string;
  typeName?: string;
}

/** Categories list response. */
export interface CategoriesResponse {
  categories: Category[];
}

// ── Statistics ────────────────────────────────────────────────────────────────

/** Financial statistics for a single time period. */
export interface StatisticsPeriod {
  period: string;
  income?: { amount: Amount; transactionCount?: number };
  expenses?: { amount: Amount; transactionCount?: number };
  byCategory?: Array<{
    categoryId: string;
    categoryName: string;
    amount: Amount;
    transactionCount: number;
  }>;
}

/** Statistics response. */
export interface StatisticsResponse {
  periods: StatisticsPeriod[];
  summary?: {
    totalIncome?: Amount;
    totalExpenses?: Amount;
    netSavings?: Amount;
    savingsRate?: number;
  };
}

/** Options for requesting financial statistics. */
export interface StatisticsOpts {
  periodGte: string;
  periodLte: string;
  resolution?: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  accountIdIn?: string[];
  categoryIdIn?: string[];
}

// ── Investments ───────────────────────────────────────────────────────────────

/** An investment account (brokerage, ISA, pension, etc.). */
export interface InvestmentAccount {
  id: string;
  name: string;
  type: string;
  balance?: { amount: Amount };
  accountNumber?: string;
  financialInstitution?: { id?: string; name?: string };
}

/** Paginated investment accounts response. */
export interface InvestmentAccountsResponse {
  accounts: InvestmentAccount[];
  nextPageToken?: string;
}

/** A holding (position) within an investment account. */
export interface Holding {
  id: string;
  instrument?: { type: string; symbol?: string; isin?: string; name?: string; mic?: string };
  quantity?: number;
  averagePurchasePrice?: { amount: Amount };
  currentPrice?: { amount: Amount };
  marketValue?: { amount: Amount };
  costBasis?: { amount: Amount };
  unrealizedGainLoss?: { amount: Amount };
  unrealizedGainLossPercent?: number;
  lastUpdated?: string;
}

/** Holdings response. */
export interface HoldingsResponse {
  holdings: Holding[];
  totalValue?: { amount: Amount };
}

// ── Loans ─────────────────────────────────────────────────────────────────────

/** A loan or mortgage account. */
export interface LoanAccount {
  id: string;
  name: string;
  type: string;
  balance?: { amount: Amount };
  originalAmount?: { amount: Amount };
  interestRate?: number;
  interestRateType?: string;
  monthlyPayment?: { amount: Amount };
  startDate?: string;
  maturityDate?: string;
  nextPaymentDate?: string;
  remainingPayments?: number;
  accountNumber?: string;
  lender?: { name?: string };
  financialInstitution?: { id?: string; name?: string };
}

/** Paginated loan accounts response. */
export interface LoanAccountsResponse {
  accounts: LoanAccount[];
  nextPageToken?: string;
}

// ── Finance management ────────────────────────────────────────────────────────

/** Budget type. */
export type BudgetType = "INCOME" | "EXPENSE";

/** Budget recurrence frequency. */
export type BudgetFrequency = "ONE_OFF" | "MONTHLY" | "QUARTERLY" | "YEARLY";

/** Budget recurrence configuration. */
export interface BudgetRecurrence {
  frequency: BudgetFrequency;
  start: string;
  end?: string;
}

/** Rule allocating transactions to a budget. */
export interface BudgetAllocationRule {
  categories?: Array<{ id: string }>;
  accounts?: Array<{ id: string }>;
  tags?: string[];
}

/** Budget allocation rules. */
export interface BudgetAllocationRules {
  expenseAllocationRules?: BudgetAllocationRule[];
  incomeAllocationRules?: BudgetAllocationRule[];
}

/** Parameters for creating a budget. */
export interface CreateBudgetParams {
  title: string;
  description?: string;
  type: BudgetType;
  targetAmount: TargetAmount;
  recurrence: BudgetRecurrence;
  allocationRules?: BudgetAllocationRules;
}

/** A budget. */
export interface Budget {
  id: string;
  title: string;
  description?: string;
  type: BudgetType;
  targetAmount?: TargetAmount;
  recurrence?: BudgetRecurrence;
  allocationRules?: BudgetAllocationRules;
  progressStatus?: string;
}

/** Paginated budgets response. */
export interface BudgetsResponse {
  budgets: Budget[];
  nextPageToken?: string;
}

/** Budget spending history response. */
export interface BudgetHistoryResponse {
  history: Array<{ period: string; spent?: TargetAmount; remaining?: TargetAmount }>;
}

/** Filter options for listing budgets. */
export interface BudgetsListOpts extends PaginationOpts {
  progressStatusIn?: string[];
}

// ── Cash flow ─────────────────────────────────────────────────────────────────

/** Cash flow time resolution. */
export type CashFlowResolution = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

/** Cash flow data for a single period. */
export interface CashFlowPeriod {
  periodStart: string;
  periodEnd: string;
  income?: { amount: Amount; transactionCount?: number };
  expenses?: { amount: Amount; transactionCount?: number };
  netAmount?: { amount: Amount };
  savingsRate?: number;
}

/** Cash flow summaries response. */
export interface CashFlowResponse {
  resolution?: string;
  periods: CashFlowPeriod[];
  summary?: {
    totalIncome?: Amount;
    totalExpenses?: Amount;
    netTotal?: Amount;
    averageMonthlySavings?: Amount;
  };
}

/** Options for requesting cash flow summaries. */
export interface CashFlowOpts {
  resolution: CashFlowResolution;
  fromGte: string;
  toLte: string;
}

// ── Financial calendar ────────────────────────────────────────────────────────

/** Amount used in financial calendar events. */
export interface CalendarEventAmount {
  currencyCode: string;
  value: ExactAmount;
}

/** A financial calendar event. */
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  eventAmount?: CalendarEventAmount;
  status?: string;
  recurringGroupId?: string;
}

/** Paginated calendar events response. */
export interface CalendarEventsResponse {
  events: CalendarEvent[];
  nextPageToken?: string;
}

/** Parameters for creating a calendar event. */
export interface CreateCalendarEventParams {
  title: string;
  description?: string;
  dueDate?: string;
  eventAmount?: CalendarEventAmount;
}

/** Options for requesting calendar summaries. */
export interface CalendarSummariesOpts {
  resolution: string;
  periodGte: string;
  periodLte: string;
}

// ── Verification ──────────────────────────────────────────────────────────────

/** User identity for account check sessions. */
export interface AccountCheckSessionUser {
  firstName: string;
  lastName: string;
}

/** Parameters for creating an account check session. */
export interface CreateSessionParams {
  user: AccountCheckSessionUser;
  market?: string;
  locale?: string;
  redirectUri?: string;
}

/** An account check Tink Link session. */
export interface AccountCheckSession {
  sessionId: string;
  user?: AccountCheckSessionUser;
  expiresAt?: string;
}

/** An account ownership verification report. */
export interface AccountCheckReport {
  id: string;
  verification?: { status: string; nameMatched?: boolean; matchConfidence?: string };
  accountDetails?: {
    iban?: string;
    accountNumber?: string;
    sortCode?: string;
    accountHolderName?: string;
  };
  timestamp?: string;
}

/** Paginated account check reports response. */
export interface AccountCheckReportsResponse {
  reports: AccountCheckReport[];
  nextPageToken?: string;
}

/** An account party (owner, co-owner, etc.). */
export interface AccountParty {
  name: string;
  type: string;
  dateOfBirth?: string;
}

/** Account parties response. */
export interface AccountPartiesResponse {
  parties: AccountParty[];
}

/** Parameters for granting user access in account/balance check flows. */
export interface GrantUserAccessParams {
  userId: string;
  idHint: string;
  scope: string;
  actorClientId?: string;
}

/** Parameters for building a continuous-access Tink Link URL. */
export interface ContinuousAccessLinkParams {
  clientId: string;
  market: string;
  locale: string;
  redirectUri: string;
  products?: string;
}

/** Response from initiating a balance refresh. */
export interface BalanceRefreshResponse {
  balanceRefreshId: string;
  status: string;
}

/** Balance refresh lifecycle status. */
export interface BalanceRefreshStatus {
  balanceRefreshId: string;
  status: "INITIATED" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | (string & NonNullable<unknown>);
  updated?: string;
}

/** Parameters for building a balance check Tink Link URL. */
export interface BuildAccountCheckLinkParams {
  clientId: string;
  market: string;
  redirectUri: string;
  test?: boolean;
  state?: string;
}

/** Parameters for building a consent update Tink Link URL. */
export interface ConsentUpdateLinkParams {
  clientId: string;
  credentialsId: string;
  market: string;
  redirectUri: string;
}

// ── Risk & reports ────────────────────────────────────────────────────────────

/** An income verification report. */
export interface IncomeCheckReport {
  id: string;
  income?: { totalMonthly?: string; streams?: Array<{ amount: Amount; frequency: string }> };
  created?: string;
}

/** An expense analysis report. */
export interface ExpenseCheckReport {
  id: string;
  expenses?: { total?: string; byCategory?: Record<string, Amount> };
  created?: string;
}

/** A financial risk insights report. */
export interface RiskInsightsReport {
  id: string;
  risk?: { score?: number; level?: string };
  created?: string;
}

/** A risk categorisation report. */
export interface RiskCategorisationReport {
  id: string;
  categories?: Array<{ id: string; name: string; risk: string }>;
  created?: string;
}

/** A business account verification report. */
export interface BusinessAccountCheckReport {
  id: string;
  status?: string;
  created?: string;
  data?: Record<string, unknown>;
}

// ── Connector ─────────────────────────────────────────────────────────────────

/** Parameters for creating a Tink user via the Connector product. */
export interface ConnectorCreateUserParams {
  externalUserId: string;
  market: string;
  locale: string;
}

/** An account record to ingest via the Connector API. */
export interface ConnectorAccount {
  externalId: string;
  name: string;
  type: string;
  balance: number;
  number?: string;
  availableCredit?: number;
  reservedAmount?: number;
  closed?: boolean;
  flags?: string[];
  payload?: Record<string, unknown>;
}

/** A transaction record to ingest via the Connector API. */
export interface ConnectorTransaction {
  externalId: string;
  amount: number;
  /** Unix timestamp in milliseconds. */
  date: number;
  description: string;
  type: string;
  pending?: boolean;
  payload?: Record<string, unknown>;
}

/** Groups transactions under one account for batch ingestion. */
export interface ConnectorTransactionAccount {
  externalId: string;
  balance: number;
  transactions: ConnectorTransaction[];
  reservedAmount?: number;
}

/** Parameters for ingesting accounts via the Connector API. */
export interface IngestAccountsParams {
  accounts: ConnectorAccount[];
}

/** Parameters for ingesting transactions via the Connector API. */
export interface IngestTransactionsParams {
  type: "REAL_TIME" | "BATCH";
  transactionAccounts: ConnectorTransactionAccount[];
  autoBook?: boolean;
  overridePending?: boolean;
}

// ── Tink Link ─────────────────────────────────────────────────────────────────

/** Supported Tink Link product identifiers. */
export type LinkProduct =
  | "transactions"
  | "account_check"
  | "income_check"
  | "payment"
  | "expense_check"
  | "risk_insights";

/** Parameters for building a Tink Link URL. */
export interface LinkUrlParams {
  clientId: string;
  redirectUri: string;
  market: string;
  locale: string;
  authorizationCode?: string;
  paymentRequestId?: string;
  state?: string;
  test?: boolean;
  inputProvider?: string;
  inputUsername?: string;
  iframe?: boolean;
}

// ── Connectivity ──────────────────────────────────────────────────────────────

/** Connectivity status for a single credential. */
export interface CredentialConnectivity {
  credentialId: string;
  providerName: string;
  status: string;
  healthy: boolean;
  lastRefreshed?: string;
  errorMessage?: string;
}

/** Aggregated connectivity health summary. */
export interface ConnectivitySummary {
  credentials: CredentialConnectivity[];
  healthy: number;
  unhealthy: number;
  total: number;
}

// ── Webhooks ──────────────────────────────────────────────────────────────────

/** Known Tink webhook event type strings. */
export type WebhookEventType =
  | "credentials.updated"
  | "credentials.refresh.succeeded"
  | "credentials.refresh.failed"
  | "provider_consents.created"
  | "provider_consents.revoked"
  | "test";

/** A parsed, validated webhook event. */
export interface WebhookEvent {
  type: WebhookEventType | (string & NonNullable<unknown>);
  data: Record<string, unknown>;
  timestamp?: string;
  raw: Record<string, unknown>;
}

/** A webhook event handler function. */
export type WebhookHandlerFn = (event: WebhookEvent) => void | Promise<void>;
