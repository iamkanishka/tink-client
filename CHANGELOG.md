# Changelog

All notable changes to tink-client are documented here.

## [1.0.0] — 2025-03-20

### Added

**Core**

- `TinkClient` — single entry point with 24 namespaces covering all Tink API products
- `TinkError` — structured error class with typed `type` discriminant, `retryable` getter, and `format()`
- `WebhookVerifier` — HMAC-SHA256 constant-time signature verification
- `WebhookHandler` — typed event dispatch with handler registry, wildcard support, and test webhook handling

**Authentication**

- `Auth.getAccessToken()` — client credentials grant
- `Auth.exchangeCode()` — authorization code exchange
- `Auth.refreshAccessToken()` — token refresh
- `Auth.buildAuthorizationUrl()` — OAuth redirect URL builder
- `Auth.createAuthorization()` — authorization grant creation
- `Auth.delegateAuthorization()` — grant delegation for Tink Link
- `Auth.validateToken()` — token health probe

**Account Aggregation**

- `Accounts` — listAccounts, getAccount, getBalances
- `Transactions` — listAccounts, listTransactions
- `TransactionsOneTimeAccess` — listAccounts, listTransactions
- `TransactionsContinuousAccess` — createUser, grantUserAccess, buildTinkLink, createAuthorization, getUserAccessToken, listAccounts, listTransactions

**Reference Data**

- `Providers` — listProviders, getProvider (1-hour cache)
- `Categories` — listCategories, getCategory (24-hour cache, locale-aware)
- `Statistics` — getStatistics, getCategoryStatistics, getAccountStatistics (1-hour cache)

**Users & Credentials**

- `Users` — createUser, deleteUser, listCredentials, getCredential, deleteCredential, refreshCredential, createAuthorization, getUserAccessToken

**Investments & Loans**

- `Investments` — listAccounts, getAccount, getHoldings
- `Loans` — listAccounts, getAccount

**Finance Management**

- `Budgets` — createBudget, getBudget, getBudgetHistory, listBudgets, updateBudget, deleteBudget
- `CashFlow` — getSummaries (DAILY/WEEKLY/MONTHLY/YEARLY)
- `FinancialCalendar` — createEvent, getEvent, updateEvent, listEvents, deleteEvent (with recurring options), getSummaries, addAttachment, deleteAttachment, createRecurringGroup, createReconciliation, getReconciliationDetails, getReconciliationSuggestions, deleteReconciliation

**Verification**

- `AccountCheck` — createSession, buildLinkUrl, getReport, getReportPdf, listReports (one-time); createUser, grantUserAccess, buildContinuousAccessLink, createAuthorization, getUserAccessToken, listAccounts, getAccountParties, listIdentities, listTransactions, deleteUser (continuous)
- `BalanceCheck` — createUser, grantUserAccess, buildAccountCheckLink, getAccountCheckReport, createAuthorization, getUserAccessToken, refreshBalance, getRefreshStatus, getAccountBalance, grantConsentUpdate, buildConsentUpdateLink
- `BusinessAccountCheck` — getReport

**Risk & Analytics**

- `IncomeCheck` — getReport, getReportPdf
- `ExpenseCheck` — getReport
- `RiskInsights` — getReport
- `RiskCategorisation` — getReport

**Infrastructure**

- `Connector` — createUser, ingestAccounts, ingestTransactions
- `Link` — buildUrl (all 6 products), transactionsUrl, accountCheckUrl, paymentUrl
- `Connectivity` — listProvidersByMarket, listProvidersByMarketAuthenticated, checkProviderStatus, providerOperational, checkCredentialConnectivity, getCredentialConnectivity, checkApiHealth

**Utilities**

- `withRetry` — exponential back-off with jitter
- `calculateDelay`, `shouldRetry`
- `expired`, `expiresSoon`, `timeUntilExpiration`, `calculateExpiration`, `parseExpiration`, `bufferSeconds`
- `buildUrl`, `buildQueryString`, `toCamelCase`, `parseMoney`, `validateRequired`, `encodeJson`, `decodeJson`, `redactSensitive`, `getInSafe`, `mergePaginationParams`
- `rateLimitCheck`, `rateLimitRemaining`, `rateLimitReset`, `rateLimitInfo`, `setRateLimitingEnabled`

**Build**

- Dual CJS + ESM output with full TypeScript declarations and source maps
- Zero runtime dependencies (uses native Node.js `fetch`, `crypto`)
- Requires Node.js ≥ 18
