# tink-client

[![npm](https://img.shields.io/npm/v/tink-client)](https://www.npmjs.com/package/tink-client)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

**Production-ready TypeScript SDK for the [Tink Open Banking API](https://docs.tink.com).**

Zero runtime dependencies · Dual CJS/ESM · Full TypeScript types · Node.js ≥ 18

---

## Installation

```bash
npm install tink-client
```

---

## Complete API coverage — 24 namespaces

| Namespace                           | Description                                                          |
| ----------------------------------- | -------------------------------------------------------------------- |
| `tink.auth`                         | OAuth 2.0 — client credentials, auth code, token refresh, delegation |
| `tink.accounts`                     | Bank account data and balances                                       |
| `tink.transactions`                 | Transaction listing with filtering and pagination                    |
| `tink.transactionsOneTimeAccess`    | One-time authorization flow                                          |
| `tink.transactionsContinuousAccess` | Persistent user with recurring sync                                  |
| `tink.providers`                    | Financial institutions (cached 1 hour)                               |
| `tink.categories`                   | Transaction categories (cached 24 hours)                             |
| `tink.statistics`                   | Aggregated financial stats (cached 1 hour)                           |
| `tink.users`                        | User and credential management                                       |
| `tink.investments`                  | Investment accounts and holdings                                     |
| `tink.loans`                        | Loan and mortgage accounts                                           |
| `tink.budgets`                      | Budget creation, tracking, and history                               |
| `tink.cashFlow`                     | Income vs expense summaries by resolution                            |
| `tink.financialCalendar`            | Calendar events, attachments, reconciliation                         |
| `tink.accountCheck`                 | Account ownership verification (one-time + continuous)               |
| `tink.balanceCheck`                 | Real-time balance refresh and consent management                     |
| `tink.businessAccountCheck`         | Business account verification                                        |
| `tink.incomeCheck`                  | Income verification reports                                          |
| `tink.expenseCheck`                 | Expense analysis reports                                             |
| `tink.riskInsights`                 | Financial risk scoring reports                                       |
| `tink.riskCategorisation`           | Transaction-level risk categorisation                                |
| `tink.connector`                    | Ingest your own account and transaction data                         |
| `tink.link`                         | Build Tink Link URLs for all 6 products                              |
| `tink.connectivity`                 | Monitor provider and credential health                               |

---

## Quick start

```ts
import { TinkClient } from "tink-client";

const tink = new TinkClient({
  clientId: process.env.TINK_CLIENT_ID,
  clientSecret: process.env.TINK_CLIENT_SECRET,
});

// Acquire a client credentials token (sets it automatically)
await tink.authenticate("accounts:read transactions:read");

const { accounts } = await tink.accounts.listAccounts();
console.log(accounts);
```

---

## Configuration

```ts
const tink = new TinkClient({
  clientId: "...", // or set TINK_CLIENT_ID env var
  clientSecret: "...", // or set TINK_CLIENT_SECRET env var
  accessToken: "...", // skip client credentials entirely
  baseUrl: "https://api.tink.com", // default
  timeoutMs: 30_000, // request timeout, default: 30s
  maxRetries: 3, // retries on network/5xx errors, default: 3
  cache: true, // in-memory LRU cache, default: true
  cacheMaxSize: 512, // max LRU entries, default: 512
  fetchFn: myCustomFetch, // override global fetch (e.g. for testing)
  defaultHeaders: { "x-request-id": uuid() },
});
```

---

## Authentication

```ts
// Client credentials (server-to-server)
await tink.authenticate("accounts:read transactions:read");

// Authorization code exchange (after user redirect)
const token = await tink.auth.exchangeCode(clientId, clientSecret, code);
tink.setAccessToken(token.access_token);

// Token refresh
const refreshed = await tink.auth.refreshAccessToken(clientId, clientSecret, token.refresh_token!);

// Build authorization URL for user redirect
const authUrl = tink.auth.buildAuthorizationUrl({
  clientId,
  redirectUri: "https://yourapp.com/callback",
  scope: "accounts:read",
  market: "GB",
});

// Create authorization grant for a user
const grant = await tink.auth.createAuthorization({ userId, scope });

// Delegate authorization grant (for Tink Link flows)
const delegated = await tink.auth.delegateAuthorization({ userId, idHint, scope }, clientId);

// Validate current token
const isValid = await tink.auth.validateToken(); // boolean
```

---

## Accounts and Transactions

```ts
// List accounts
const { accounts } = await tink.accounts.listAccounts({ typeIn: ["CHECKING", "SAVINGS"] });
const account = await tink.accounts.getAccount("acc_id");
const balances = await tink.accounts.getBalances("acc_id");

// List transactions with date filter
const { transactions } = await tink.transactions.listTransactions({
  bookedDateGte: "2024-01-01",
  bookedDateLte: "2024-03-31",
  statusIn: ["BOOKED"],
  pageSize: 100,
});

// One-time access flow (no persistent user)
tink.setAccessToken(userToken);
const data = await tink.transactionsOneTimeAccess.listTransactions();

// Continuous access flow
const user = await tink.transactionsContinuousAccess.createUser({
  externalUserId: "your_user_id",
  market: "GB",
  locale: "en_US",
});
const accessGrant = await tink.transactionsContinuousAccess.grantUserAccess({
  userId: user.user_id!,
  idHint: "user@example.com",
  scope:
    "authorization:read,credentials:read,credentials:write,credentials:refresh,providers:read,user:read",
});
const linkUrl = tink.transactionsContinuousAccess.buildTinkLink(accessGrant.code, {
  clientId,
  redirectUri: "https://yourapp.com/callback",
  market: "GB",
  locale: "en_US",
});
// → Redirect user to linkUrl to connect their bank
```

---

## Reference Data

```ts
// Providers (cached 1 hour)
const { providers } = await tink.providers.listProviders({ market: "GB" });
const barclays = await tink.providers.getProvider("uk-ob-barclays");

// Categories (cached 24 hours)
const { categories } = await tink.categories.listCategories({ locale: "en_US" });

// Statistics
const stats = await tink.statistics.getStatistics({
  periodGte: "2024-01-01",
  periodLte: "2024-12-31",
  resolution: "MONTHLY",
});
const groceryStats = await tink.statistics.getCategoryStatistics("expenses:food.groceries", {
  periodGte: "2024-01-01",
  periodLte: "2024-12-31",
});
```

---

## Account Check

```ts
// ── One-time verification ──────────────────────────────────────────────────
const session = await tink.accountCheck.createSession({
  user: { firstName: "Jane", lastName: "Smith" },
  market: "GB",
});
const url = tink.accountCheck.buildLinkUrl(session, { clientId, market: "GB" });
// → Redirect user to url; receive account_verification_report_id in callback

const report = await tink.accountCheck.getReport(reportId);
// report.verification.status: "MATCH" | "NO_MATCH" | "INDETERMINATE"
const pdf = await tink.accountCheck.getReportPdf(reportId);

// ── Continuous access ──────────────────────────────────────────────────────
const user = await tink.accountCheck.createUser({ externalUserId, market: "GB", locale: "en_US" });
const grant = await tink.accountCheck.grantUserAccess({ userId, idHint, scope }, clientId);
const link = tink.accountCheck.buildContinuousAccessLink(grant, {
  clientId,
  market: "GB",
  locale: "en_US",
  redirectUri,
  products: "ACCOUNT_CHECK,TRANSACTIONS",
});
const parties = await tink.accountCheck.getAccountParties("acc_id");
const identities = await tink.accountCheck.listIdentities();
```

---

## Balance Check

```ts
// Build link for initial bank connection
const link = tink.balanceCheck.buildAccountCheckLink(grant, {
  clientId,
  market: "SE",
  redirectUri,
  test: false,
});

// Trigger async balance refresh
const { balanceRefreshId } = await tink.balanceCheck.refreshBalance("acc_id");

// Poll until COMPLETED
let status;
do {
  await new Promise((r) => setTimeout(r, 1000));
  status = await tink.balanceCheck.getRefreshStatus(balanceRefreshId);
} while (status.status !== "COMPLETED" && status.status !== "FAILED");

const balance = await tink.balanceCheck.getAccountBalance("acc_id");

// Build consent renewal link
const consentLink = tink.balanceCheck.buildConsentUpdateLink(grant, {
  clientId,
  credentialsId: "cred_id",
  market: "SE",
  redirectUri,
});
```

---

## Finance Management

```ts
// Budgets
const budget = await tink.budgets.createBudget({
  title: "Office Supplies",
  type: "EXPENSE",
  targetAmount: { value: { unscaledValue: 50000, scale: 2 }, currencyCode: "GBP" },
  recurrence: { frequency: "MONTHLY", start: "2024-01-01" },
});
const history = await tink.budgets.getBudgetHistory(budget.id);
await tink.budgets.updateBudget(budget.id, { title: "Updated Title" });
await tink.budgets.deleteBudget(budget.id);

// Cash flow
const { periods } = await tink.cashFlow.getSummaries({
  resolution: "MONTHLY",
  fromGte: "2024-01-01",
  toLte: "2024-12-31",
});

// Financial calendar
const event = await tink.financialCalendar.createEvent({
  title: "Electricity Bill",
  dueDate: "2024-02-15",
  eventAmount: { currencyCode: "GBP", value: { unscaledValue: 12500, scale: 2 } },
});
await tink.financialCalendar.addAttachment(event.id, {
  title: "Invoice Feb 2024",
  url: "https://...",
});
await tink.financialCalendar.createRecurringGroup(event.id, {
  rrulePattern: "FREQ=MONTHLY;COUNT=12",
});
await tink.financialCalendar.deleteEvent(event.id, { recurring: "ALL" });
```

---

## Risk and Verification Reports

```ts
const incomeReport = await tink.incomeCheck.getReport(reportId);
const incomePdf = await tink.incomeCheck.getReportPdf(reportId);
const expenseReport = await tink.expenseCheck.getReport(reportId);
const riskReport = await tink.riskInsights.getReport(reportId);
const riskCatReport = await tink.riskCategorisation.getReport(reportId);
const bizAcctReport = await tink.businessAccountCheck.getReport(reportId);
```

---

## Connector (Data Ingestion)

```ts
const user = await tink.connector.createUser({
  externalUserId: "user_123",
  market: "GB",
  locale: "en_US",
});

await tink.connector.ingestAccounts(user.user_id!, {
  accounts: [{ externalId: "acc_1", name: "Checking", type: "CHECKING", balance: 1500.0 }],
});

await tink.connector.ingestTransactions(user.user_id!, {
  type: "REAL_TIME",
  transactionAccounts: [
    {
      externalId: "acc_1",
      balance: 1485.0,
      transactions: [
        {
          externalId: "txn_1",
          amount: -15.0,
          date: Date.now(),
          description: "Coffee",
          type: "DEFAULT",
        },
      ],
    },
  ],
});
```

---

## Tink Link URL Builder

```ts
// All 6 products
tink.link.buildUrl("transactions", {
  clientId,
  redirectUri,
  market: "GB",
  locale: "en_US",
  authorizationCode: code,
});
tink.link.buildUrl("account_check", {
  clientId,
  redirectUri,
  market: "GB",
  locale: "en_US",
  authorizationCode: code,
});
tink.link.buildUrl("income_check", {
  clientId,
  redirectUri,
  market: "GB",
  locale: "en_US",
  authorizationCode: code,
});
tink.link.buildUrl("payment", {
  clientId,
  redirectUri,
  market: "SE",
  locale: "sv_SE",
  paymentRequestId: payId,
});
tink.link.buildUrl("expense_check", {
  clientId,
  redirectUri,
  market: "GB",
  locale: "en_US",
  authorizationCode: code,
});
tink.link.buildUrl("risk_insights", {
  clientId,
  redirectUri,
  market: "GB",
  locale: "en_US",
  authorizationCode: code,
});

// Convenience wrappers
tink.link.transactionsUrl(code, { clientId, redirectUri, market: "GB", locale: "en_US" });
tink.link.accountCheckUrl(code, { clientId, redirectUri, market: "GB", locale: "en_US" });
tink.link.paymentUrl(paymentId, { clientId, redirectUri, market: "SE", locale: "sv_SE" });

// Sandbox test mode with pre-selected provider
tink.link.buildUrl("transactions", {
  clientId,
  redirectUri,
  market: "GB",
  locale: "en_US",
  authorizationCode: code,
  test: true,
  inputProvider: "uk-ob-barclays",
});
```

---

## Webhooks

```ts
const webhooks = tink.createWebhookHandler(process.env.TINK_WEBHOOK_SECRET!);

webhooks
  .registerHandler("credentials.updated", async (event) => {
    await syncUserCredentials(event.data.userId as string);
  })
  .registerHandler("credentials.refresh.failed", async (event) => {
    await notifyUserToReconnect(event.data.userId as string);
  })
  .registerHandler("credentials.refresh.succeeded", async (event) => {
    await updateLastSyncTimestamp(event.data.userId as string);
  })
  .registerHandler("provider_consents.revoked", async (event) => {
    await handleConsentRevoked(event.data.userId as string);
  })
  .registerHandler("*", (event) => {
    console.log("Webhook received:", event.type); // wildcard — all events
  });

// Express:
app.post("/webhooks/tink", express.text({ type: "*/*" }), async (req, res) => {
  const event = await webhooks.handleWebhook(req.body, req.headers["x-tink-signature"]);
  // event === null for test webhooks (auto-acknowledged)
  res.sendStatus(200);
});
```

---

## Error Handling

```ts
import { TinkClient, TinkError } from "tink-client";

try {
  await tink.accounts.listAccounts();
} catch (err) {
  if (err instanceof TinkError) {
    switch (err.type) {
      case "authentication_error":
        // Token expired — re-authenticate
        await tink.authenticate("accounts:read");
        break;
      case "rate_limit_error":
        // Too many requests — back off
        await sleep(err.retryAfterMs ?? 60_000);
        break;
      case "network_error":
      case "timeout":
        // Transient — safe to retry
        console.log("Retryable:", err.retryable); // true
        break;
    }
    console.log(err.status); // 401 | 429 | 500 | undefined
    console.log(err.errorCode); // "TOKEN_INVALID" etc.
    console.log(err.format()); // "[401] Unauthorized (TOKEN_INVALID)"
  }
}
```

---

## Token Expiry Utilities

```ts
import { parseExpiration, expired, timeUntilExpiration } from "tink-client";

const token = await tink.auth.getAccessToken(clientId, clientSecret, scope);
const expiresAt = parseExpiration(token as Record<string, unknown>);

// Check before each API call
if (expired(expiresAt)) {
  await tink.authenticate(scope);
}

const ttl = timeUntilExpiration(expiresAt);
if (ttl.ok) console.log(`Token expires in ${ttl.seconds}s`);
```

---

## Retry Utility

```ts
import { withRetry } from "tink-client";

const result = await withRetry(() => tink.accounts.listAccounts(), {
  maxAttempts: 5,
  baseDelayMs: 500,
  maxDelayMs: 10_000,
  jitterFactor: 0.1,
});
```

---

## Cache Management

```ts
tink.clearCache(); // clear everything
tink.invalidateCache("/api/v1/providers"); // clear by path prefix
```

---

## Connectivity Monitoring

```ts
// Check all user bank connections
const summary = await tink.connectivity.checkCredentialConnectivity();
console.log(`${summary.healthy}/${summary.total} connections healthy`);

// Check a specific provider
const { active } = await tink.connectivity.checkProviderStatus("uk-ob-barclays", "GB");

// API health check
const health = await tink.connectivity.checkApiHealth();
if (!health.ok) alertOpsTeam(health.error);
```

---

## License

MIT © Kanishka Naik
