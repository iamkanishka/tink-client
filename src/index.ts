/**
 * tink-node — Tink Open Banking API client for Node.js
 *
 * A production-ready TypeScript SDK for the Tink API covering all endpoints:
 * accounts, transactions, providers, categories, statistics, users, investments,
 * loans, budgets, cash flow, financial calendar, account check, balance check,
 * income check, expense check, risk insights, risk categorisation, business
 * account check, connector, Tink Link URL builder, connectivity, and webhooks.
 *
 * @example
 * ```ts
 * import { TinkClient } from "tink-node";
 *
 * const tink = new TinkClient({
 *   clientId:     process.env.TINK_CLIENT_ID,
 *   clientSecret: process.env.TINK_CLIENT_SECRET,
 * });
 *
 * await tink.authenticate("accounts:read transactions:read");
 *
 * const { accounts } = await tink.accounts.listAccounts();
 * ```
 *
 * @packageDocumentation
 */

// ── Core ───────────────────────────────────────────────────────────────────
export { TinkClient } from "./client";
export { TinkError } from "./utils/error";

// ── Webhooks ───────────────────────────────────────────────────────────────
export { WebhookVerifier, WebhookVerificationError } from "./utils/webhook_verifier";
export { WebhookHandler } from "./utils/webhook_handler";

// ── Utilities ─────────────────────────────────────────────────────────────
export { withRetry, shouldRetry, calculateDelay } from "./utils/retry";
export {
  expired,
  expiresSoon,
  timeUntilExpiration,
  calculateExpiration,
  parseExpiration,
  bufferSeconds,
} from "./utils/auth_token";
export {
  buildUrl,
  buildQueryString,
  toCamelCase,
  parseMoney,
  validateRequired,
  encodeJson,
  decodeJson,
  redactSensitive,
  getInSafe,
  mergePaginationParams,
} from "./utils/helpers";
export {
  check as rateLimitCheck,
  remaining as rateLimitRemaining,
  reset as rateLimitReset,
  info as rateLimitInfo,
  setRateLimitingEnabled,
} from "./utils/rate_limiter";

// ── Resource classes ───────────────────────────────────────────────────────
export {
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

// ── Types ──────────────────────────────────────────────────────────────────
export type {
  TinkConfig,
  TinkErrorType,
  TokenResponse,
  AuthorizationUrlOpts,
  CreateAuthorizationParams,
  DelegateAuthorizationParams,
  Amount,
  ExactAmount,
  TargetAmount,
  PaginationOpts,
  AccountBalanceItem,
  AccountBalances,
  AccountIdentifiers,
  Account,
  AccountsResponse,
  AccountsListOpts,
  Transaction,
  TransactionsResponse,
  TransactionsListOpts,
  ContinuousAccessGrantParams,
  Provider,
  ProvidersResponse,
  ProvidersListOpts,
  Category,
  CategoriesResponse,
  StatisticsPeriod,
  StatisticsResponse,
  StatisticsOpts,
  CreateUserParams,
  TinkUser,
  Credential,
  CredentialsResponse,
  InvestmentAccount,
  InvestmentAccountsResponse,
  Holding,
  HoldingsResponse,
  LoanAccount,
  LoanAccountsResponse,
  BudgetType,
  BudgetFrequency,
  BudgetRecurrence,
  BudgetAllocationRule,
  BudgetAllocationRules,
  CreateBudgetParams,
  Budget,
  BudgetsResponse,
  BudgetHistoryResponse,
  BudgetsListOpts,
  CashFlowResolution,
  CashFlowPeriod,
  CashFlowResponse,
  CashFlowOpts,
  CalendarEventAmount,
  CalendarEvent,
  CalendarEventsResponse,
  CreateCalendarEventParams,
  CalendarSummariesOpts,
  AccountCheckSessionUser,
  CreateSessionParams,
  AccountCheckSession,
  AccountCheckReport,
  AccountCheckReportsResponse,
  AccountParty,
  AccountPartiesResponse,
  GrantUserAccessParams,
  ContinuousAccessLinkParams,
  BalanceRefreshResponse,
  BalanceRefreshStatus,
  BuildAccountCheckLinkParams,
  ConsentUpdateLinkParams,
  IncomeCheckReport,
  ExpenseCheckReport,
  RiskInsightsReport,
  RiskCategorisationReport,
  BusinessAccountCheckReport,
  ConnectorAccount,
  ConnectorTransaction,
  ConnectorTransactionAccount,
  IngestAccountsParams,
  IngestTransactionsParams,
  LinkProduct,
  LinkUrlParams,
  ProviderStatusResult,
  CredentialConnectivity,
  ConnectivitySummary,
  WebhookEvent,
  WebhookEventType,
  WebhookHandlerFn,
  RateLimitInfo,
  RetryOptions,
} from "./types";
