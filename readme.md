# tink-client

[![npm version](https://img.shields.io/npm/v/tink-client.svg)](https://www.npmjs.com/package/tink-client)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![Zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Production-grade TypeScript SDK for the [Tink Open Banking API](https://docs.tink.com).
**Zero external dependencies.** Full coverage of all Tink products.

---

## Architecture

```
src/
├── domain/          ← Pure types & TinkError. Zero I/O, zero dependencies.
│   ├── errors.ts    TinkError with type discriminant, retryable getter
│   └── types.ts     80+ typed interfaces for every Tink API aggregate
│
├── application/     ← One service per bounded context
│   ├── auth.ts      OAuth flows, authorization grants, token caching
│   ├── accounts.ts  Accounts, credentials, identities
│   ├── transactions.ts  Transactions, enrichment, categories, statistics
│   ├── providers.ts Financial institution reference data
│   ├── users_investments_loans.ts  Users, investments, loans
│   ├── finance.ts   Budgets, cash flow, financial calendar
│   ├── verification.ts  Account check, balance check, all risk products
│   └── connectivity.ts  Monitoring, Connector ingestion, Link URL builders
│
├── infrastructure/  ← Transport adapters — no domain logic
│   ├── http.ts      fetch wrapper: bearer token, retry, cache, rate limit
│   ├── cache.ts     LRU cache with per-entry TTL
│   ├── retry.ts     Exponential backoff with full jitter
│   ├── rate_limiter.ts  Token-bucket rate limiter (instance-based)
│   └── webhook.ts   HMAC-SHA256 verification + typed event dispatch
│
└── index.ts         TinkClient — wires all services, re-exports everything
```

---

## Installation

```bash
npm install tink-client
```

Requires **Node.js ≥ 18** (Web Crypto API, `fetch`, `URLSearchParams`).

---

## Quick start

```ts
import { TinkClient } from "tink-client";

const tink = new TinkClient({
  clientId: process.env.TINK_CLIENT_ID,
  clientSecret: process.env.TINK_CLIENT_SECRET,
  webhookSecret: process.env.TINK_WEBHOOK_SECRET,
  cache: true,
});

// 1. Get an app-level token
const token = await tink.auth.clientCredentials("accounts:read,transactions:read");

// 2. Create an authorization grant for an end user
const grant = await tink.auth.createAuthorizationGrant(token.access_token, {
  externalUserId: "your-user-id",
  scope: "accounts:read,transactions:read",
  idHint: "Alice",
});

// 3. Build the Tink Link URL and redirect the user
const linkUrl = tink.connectivity.buildTransactionsLink(grant.code, {
  clientId: process.env.TINK_CLIENT_ID!,
  redirectUri: "https://yourapp.com/tink/callback",
  market: "GB",
  locale: "en_US",
});

// 4. After callback, exchange code for user token
const userToken = await tink.auth.exchangeCode(callbackCode);

// 5. Fetch all accounts
const accounts = await tink.accounts.listAll();

// 6. Fetch all transactions
const txns = await tink.transactions.listAll({ bookedDateGte: "2026-01-01" });

// 7. Enriched transactions (Tink Enrichment API)
const enriched = await tink.transactions.listAllEnriched({ accountIdIn: ["acc-id"] });
```

---

## Error handling

Every method throws `TinkError` on failure:

```ts
import { TinkClient, TinkError } from "tink-client";

try {
  await tink.accounts.listAll();
} catch (err) {
  if (err instanceof TinkError) {
    console.log(err.type); // "authentication_error" | "rate_limit_error" | ...
    console.log(err.status); // 401
    console.log(err.errorCode); // "TOKEN_INVALID"
    console.log(err.retryable); // false
    console.log(err.format()); // "[401] Unauthorized (TOKEN_INVALID)"
  }
}
```

`err.retryable` returns `true` for network errors, timeouts, and HTTP
408/429/500/502/503/504. The infrastructure layer retries these automatically
(up to `maxRetries` attempts with exponential backoff + jitter).

---

## Webhook verification

```ts
// Register typed handlers
tink.webhooks.on("credentials.updated", async (event) => {
  console.log("credentials updated:", event.data);
});
tink.webhooks.on("*", async (event) => {
  // wildcard — receives every event type
});

// In your HTTP handler (Express example):
app.post("/webhooks/tink", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["x-tink-signature"] as string;
  try {
    await tink.webhooks.dispatch(req.body.toString(), sig);
    res.sendStatus(204);
  } catch (err) {
    res.status(400).json({ error: err instanceof TinkError ? err.format() : String(err) });
  }
});
```

---

## Configuration

| Option          | Type           | Default                   | Description                            |
| --------------- | -------------- | ------------------------- | -------------------------------------- |
| `clientId`      | `string`       | `TINK_CLIENT_ID` env      | Tink application client_id             |
| `clientSecret`  | `string`       | `TINK_CLIENT_SECRET` env  | Tink application client_secret         |
| `webhookSecret` | `string`       | `TINK_WEBHOOK_SECRET` env | HMAC-SHA256 webhook signing secret     |
| `baseUrl`       | `string`       | `https://api.tink.com`    | API base URL override                  |
| `timeoutMs`     | `number`       | `30000`                   | Per-request timeout                    |
| `maxRetries`    | `number`       | `3`                       | Max retry attempts on transient errors |
| `cache`         | `boolean`      | `true`                    | Enable GET-response LRU cache          |
| `cacheMaxSize`  | `number`       | `512`                     | Max LRU cache entries                  |
| `fetchFn`       | `typeof fetch` | `globalThis.fetch`        | Custom fetch (e.g. for testing)        |

---

## License

MIT — see [LICENSE](LICENSE).
