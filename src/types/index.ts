// =============================================================================
// tink-node — TypeScript type definitions
// Tink Open Banking API client for Node.js
// https://docs.tink.com/api
// =============================================================================

/** Configuration options for TinkClient */
export interface TinkConfig {
  /** Your Tink application client ID (or set TINK_CLIENT_ID env var) */
  clientId?: string;
  /** Your Tink application client secret (or set TINK_CLIENT_SECRET env var) */
  clientSecret?: string;
  /** Pre-existing bearer token — skips the client credentials flow */
  accessToken?: string;
  /** Tink user ID, used to scope cache invalidation */
  userId?: string;
  /** API base URL. Defaults to https://api.tink.com */
  baseUrl?: string;
  /** Request timeout in milliseconds. Defaults to 30000 */
  timeoutMs?: number;
  /** Maximum retry attempts on retryable errors. Defaults to 3 */
  maxRetries?: number;
  /** Enable in-memory LRU response cache. Defaults to true */
  cache?: boolean;
  /** Maximum LRU cache entries. Defaults to 512 */
  cacheMaxSize?: number;
  /** Override the global fetch implementation */
  fetchFn?: typeof fetch;
  /** Additional HTTP headers sent on every request */
  defaultHeaders?: Record<string, string>;
}

/** Discriminated error type for TinkError */
export type TinkErrorType =
  | "api_error"
  | "authentication_error"
  | "rate_limit_error"
  | "validation_error"
  | "network_error"
  | "timeout"
  | "decode_error"
  | "market_mismatch"
  | "unknown";

/** OAuth 2.0 token response */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
}

/** Options for building a Tink OAuth authorization URL */
export interface AuthorizationUrlOpts {
  clientId: string;
  redirectUri: string;
  scope: string;
  state?: string;
  market?: string;
  locale?: string;
}

/** Parameters for creating an authorization grant */
export interface CreateAuthorizationParams {
  userId: string;
  scope: string;
}

/** Parameters for delegating an authorization grant */
export interface DelegateAuthorizationParams {
  userId: string;
  idHint: string;
  scope: string;
  actorClientId?: string;
}

/** Monetary amount with ISO currency code */
export interface Amount {
  value: string;
  currencyCode: string;
}

/** Exact decimal — actual value is unscaledValue / 10^scale */
export interface ExactAmount {
  unscaledValue: number;
  scale: number;
}

/** Budget target amount (ExactAmount + currency) */
export interface TargetAmount {
  value: ExactAmount;
  currencyCode: string;
}

/** Common pagination params supported by list endpoints */
export interface PaginationOpts {
  pageSize?: number;
  pageToken?: string;
}

/** Single balance entry */
export interface AccountBalanceItem {
  amount: Amount;
}

/** All balance types for a bank account */
export interface AccountBalances {
  booked?: AccountBalanceItem;
  available?: AccountBalanceItem;
  reserved?: AccountBalanceItem;
  creditLimit?: AccountBalanceItem;
}

/** Account identifiers (IBAN, sort code, BAN, PAN) */
export interface AccountIdentifiers {
  iban?: { iban: string; bban?: string };
  sortCode?: { code: string; accountNumber: string };
  pan?: { masked: string };
  bban?: { bban: string };
}

/** A bank account from the Tink API */
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

/** Paginated accounts list */
export interface AccountsResponse {
  accounts: Account[];
  nextPageToken?: string;
}

/** Filter options for listing accounts */
export interface AccountsListOpts extends PaginationOpts {
  typeIn?: string[];
}

/** A financial transaction */
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

/** Paginated transactions list */
export interface TransactionsResponse {
  transactions: Transaction[];
  nextPageToken?: string;
}

/** Filter options for listing transactions */
export interface TransactionsListOpts extends PaginationOpts {
  accountIdIn?: string[];
  bookedDateGte?: string;
  bookedDateLte?: string;
  statusIn?: string[];
  categoryIdIn?: string[];
}

/** Parameters for continuous access user grant */
export interface ContinuousAccessGrantParams {
  userId: string;
  idHint: string;
  scope: string;
  actorClientId?: string;
}

/** A financial institution supported by Tink */
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

/** Providers list */
export interface ProvidersResponse {
  providers: Provider[];
}

/** Filter options for listing providers */
export interface ProvidersListOpts {
  market?: string;
  capabilities?: string[];
}

/** A transaction category */
export interface Category {
  id: string;
  code: string;
  description?: string;
  displayName?: string;
  typeName?: string;
}

/** Categories list */
export interface CategoriesResponse {
  categories: Category[];
}

/** Financial statistics for a single time period */
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

/** Statistics response */
export interface StatisticsResponse {
  periods: StatisticsPeriod[];
  summary?: {
    totalIncome?: Amount;
    totalExpenses?: Amount;
    netSavings?: Amount;
    savingsRate?: number;
  };
}

/** Options for requesting financial statistics */
export interface StatisticsOpts {
  periodGte: string;
  periodLte: string;
  resolution?: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  accountIdIn?: string[];
  categoryIdIn?: string[];
}

/** Parameters for creating a Tink user */
export interface CreateUserParams {
  externalUserId: string;
  locale: string;
  market: string;
}

/** A Tink user */
export interface TinkUser {
  userId?: string;
  user_id?: string;
  externalUserId?: string;
  created?: string;
}

/** A Tink credential (bank connection) */
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

/** Credentials list */
export interface CredentialsResponse {
  credentials: Credential[];
}

/** An investment account */
export interface InvestmentAccount {
  id: string;
  name: string;
  type: string;
  balance?: { amount: Amount };
  accountNumber?: string;
  financialInstitution?: { id?: string; name?: string };
}

/** Paginated investment accounts list */
export interface InvestmentAccountsResponse {
  accounts: InvestmentAccount[];
  nextPageToken?: string;
}

/** A holding (position) within an investment account */
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

/** Holdings response */
export interface HoldingsResponse {
  holdings: Holding[];
  totalValue?: { amount: Amount };
}

/** A loan or mortgage account */
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
  totalPaid?: { amount: Amount };
  principalPaid?: { amount: Amount };
  interestPaid?: { amount: Amount };
  lender?: { name?: string };
  financialInstitution?: { id?: string; name?: string };
}

/** Paginated loan accounts list */
export interface LoanAccountsResponse {
  accounts: LoanAccount[];
  nextPageToken?: string;
}

/** Budget type */
export type BudgetType = "INCOME" | "EXPENSE";

/** Budget recurrence frequency */
export type BudgetFrequency = "ONE_OFF" | "MONTHLY" | "QUARTERLY" | "YEARLY";

/** Rule allocating transactions to a budget */
export interface BudgetAllocationRule {
  categories?: { id: string }[];
  accounts?: { id: string }[];
  tags?: string[];
}

/** Budget allocation rules */
export interface BudgetAllocationRules {
  expenseAllocationRules?: BudgetAllocationRule[];
  incomeAllocationRules?: BudgetAllocationRule[];
}

/** Budget recurrence configuration */
export interface BudgetRecurrence {
  frequency: BudgetFrequency;
  start: string;
  end?: string;
}

/** Parameters for creating a budget */
export interface CreateBudgetParams {
  title: string;
  description?: string;
  type: BudgetType;
  targetAmount: TargetAmount;
  recurrence: BudgetRecurrence;
  allocationRules?: BudgetAllocationRules;
}

/** A budget */
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

/** Paginated budgets list */
export interface BudgetsResponse {
  budgets: Budget[];
  nextPageToken?: string;
}

/** Budget history across periods */
export interface BudgetHistoryResponse {
  history: Array<{ period: string; spent?: TargetAmount; remaining?: TargetAmount }>;
}

/** Filter options for listing budgets */
export interface BudgetsListOpts extends PaginationOpts {
  progressStatusIn?: string[];
}

/** Cash flow time resolution */
export type CashFlowResolution = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

/** Cash flow data for a single period */
export interface CashFlowPeriod {
  periodStart: string;
  periodEnd: string;
  income?: { amount: Amount; transactionCount?: number };
  expenses?: { amount: Amount; transactionCount?: number };
  netAmount?: { amount: Amount };
  savingsRate?: number;
}

/** Cash flow summaries response */
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

/** Options for requesting cash flow summaries */
export interface CashFlowOpts {
  resolution: CashFlowResolution;
  fromGte: string;
  toLte: string;
}

/** Amount used in financial calendar events */
export interface CalendarEventAmount {
  currencyCode: string;
  value: ExactAmount;
}

/** A financial calendar event */
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  eventAmount?: CalendarEventAmount;
  status?: string;
  recurringGroupId?: string;
}

/** Paginated calendar events list */
export interface CalendarEventsResponse {
  events: CalendarEvent[];
  nextPageToken?: string;
}

/** Parameters for creating a calendar event */
export interface CreateCalendarEventParams {
  title: string;
  description?: string;
  dueDate?: string;
  eventAmount?: CalendarEventAmount;
}

/** Options for requesting calendar summaries */
export interface CalendarSummariesOpts {
  resolution: string;
  periodGte: string;
  periodLte: string;
}

/** User identity for account check sessions */
export interface AccountCheckSessionUser {
  firstName: string;
  lastName: string;
}

/** Parameters for creating an account check session */
export interface CreateSessionParams {
  user: AccountCheckSessionUser;
  market?: string;
  locale?: string;
  redirectUri?: string;
}

/** An account check Tink Link session */
export interface AccountCheckSession {
  sessionId: string;
  user?: AccountCheckSessionUser;
  expiresAt?: string;
}

/** An account ownership verification report */
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
  userDataByProvider?: Array<{ accounts?: Array<Record<string, unknown>> }>;
}

/** Paginated account check reports list */
export interface AccountCheckReportsResponse {
  reports: AccountCheckReport[];
  nextPageToken?: string;
}

/** An account party (owner, co-owner, etc.) */
export interface AccountParty {
  name: string;
  type: string;
  dateOfBirth?: string;
  personalNumber?: string;
}

/** Account parties list */
export interface AccountPartiesResponse {
  parties: AccountParty[];
}

/** Parameters for granting user access */
export interface GrantUserAccessParams {
  userId: string;
  idHint: string;
  scope: string;
  actorClientId?: string;
}

/** Options for building a continuous access Tink Link URL */
export interface ContinuousAccessLinkParams {
  clientId: string;
  market: string;
  locale: string;
  redirectUri: string;
  products?: string;
}

/** Response from initiating a balance refresh */
export interface BalanceRefreshResponse {
  balanceRefreshId: string;
  status: string;
}

/** Balance refresh status (poll until COMPLETED) */
export interface BalanceRefreshStatus {
  balanceRefreshId: string;
  status: "INITIATED" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | string;
  updated?: string;
}

/** Options for building a balance check link */
export interface BuildAccountCheckLinkParams {
  clientId: string;
  market: string;
  redirectUri: string;
  test?: boolean;
  state?: string;
}

/** Options for building a consent update link */
export interface ConsentUpdateLinkParams {
  clientId: string;
  credentialsId: string;
  market: string;
  redirectUri: string;
}

/** An income verification report */
export interface IncomeCheckReport {
  id: string;
  income?: { totalMonthly?: string; streams?: Array<{ amount: Amount; frequency: string }> };
  created?: string;
}

/** An expense analysis report */
export interface ExpenseCheckReport {
  id: string;
  expenses?: { total?: string; byCategory?: Record<string, Amount> };
  created?: string;
}

/** A risk insights report */
export interface RiskInsightsReport {
  id: string;
  risk?: { score?: number; level?: string };
  created?: string;
}

/** A risk categorisation report */
export interface RiskCategorisationReport {
  id: string;
  categories?: Array<{ id: string; name: string; risk: string }>;
  created?: string;
}

/** A business account verification report */
export interface BusinessAccountCheckReport {
  id: string;
  status?: string;
  created?: string;
  data?: Record<string, unknown>;
}

/** An account to ingest via the Connector API */
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

/** A transaction to ingest via the Connector API */
export interface ConnectorTransaction {
  externalId: string;
  amount: number;
  date: number;
  description: string;
  type: string;
  pending?: boolean;
  payload?: Record<string, unknown>;
}

/** Groups transactions under one account for ingestion */
export interface ConnectorTransactionAccount {
  externalId: string;
  balance: number;
  transactions: ConnectorTransaction[];
  reservedAmount?: number;
}

/** Parameters for ingesting accounts */
export interface IngestAccountsParams {
  accounts: ConnectorAccount[];
}

/** Parameters for ingesting transactions */
export interface IngestTransactionsParams {
  type: "REAL_TIME" | "BATCH";
  transactionAccounts: ConnectorTransactionAccount[];
  autoBook?: boolean;
  overridePending?: boolean;
}

/** Supported Tink Link products */
export type LinkProduct =
  | "transactions"
  | "account_check"
  | "income_check"
  | "payment"
  | "expense_check"
  | "risk_insights";

/** Parameters for building a Tink Link URL */
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

/** Result of a provider status check */
export interface ProviderStatusResult {
  active: boolean;
  provider?: Provider;
}

/** Connectivity status for a credential */
export interface CredentialConnectivity {
  credentialId: string;
  providerName: string;
  status: string;
  healthy: boolean;
  lastRefreshed?: string;
  errorMessage?: string;
}

/** Aggregated connectivity summary */
export interface ConnectivitySummary {
  credentials: CredentialConnectivity[];
  healthy: number;
  unhealthy: number;
  total: number;
}

/** Known Tink webhook event types */
export type WebhookEventType =
  | "credentials.updated"
  | "credentials.refresh.succeeded"
  | "credentials.refresh.failed"
  | "provider_consents.created"
  | "provider_consents.revoked"
  | "test";

/** A parsed webhook event */
export interface WebhookEvent {
  type: WebhookEventType | string;
  data: Record<string, unknown>;
  timestamp?: string;
  raw: Record<string, unknown>;
}

/** A webhook event handler function */
export type WebhookHandlerFn = (event: WebhookEvent) => void | Promise<void>;

/** Rate limit status for a key */
export interface RateLimitInfo {
  count: number;
  limit: number | "infinity";
  remaining: number | "infinity";
  resetsInMs: number;
}

/** Options for the withRetry utility */
export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterFactor?: number;
  shouldRetry?: (err: { type: TinkErrorType; status?: number }) => boolean;
}
