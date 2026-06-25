# Changelog

All notable changes to this project will be documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/2.0.0/).

## [2.0.0] — 2026-06-20

### Complete rewrite — aligned with Elixir and Go reference SDKs

This release is a ground-up rewrite of the original flat-resource npm package.
The public API (class names, method signatures, import paths) has changed
completely; this is not a backwards-compatible release.

### Architecture

**Before:** flat `src/resources/` directory; module-level mutable state for
the rate limiter; `types/index.ts` monolith; no structured errors.

**After:** three-layer architecture mirroring the Elixir and Go SDKs:

| Layer          | Directory             | Purpose                                                          |
| -------------- | --------------------- | ---------------------------------------------------------------- |
| Domain         | `src/domain/`         | Pure value types and `TinkError` — no I/O                        |
| Application    | `src/application/`    | One service file per bounded context                             |
| Infrastructure | `src/infrastructure/` | HTTP transport, LRU cache, retry, rate limiter, webhook verifier |

### Added

**Domain layer (`src/domain/`)**

- `errors.ts` — `TinkError` class with `type` discriminant, `retryable` getter,
  `format()`, and static constructors `fromResponse`, `fromNetworkError`,
  `fromDecodeError`, `validation`.
- `types.ts` — 80+ typed interfaces covering every Tink API aggregate:
  accounts, balances, identifiers, transactions, enrichment, categories,
  statistics, providers, users, identities, investments, loans, budgets,
  cash flow, calendar events, account check, balance check, income/expense/risk
  reports, business account check, connector, Tink Link, connectivity, webhooks.

**Infrastructure layer (`src/infrastructure/`)**

- `cache.ts` — LRU cache with per-entry TTL, prefix invalidation, O(1) get/set.
- `retry.ts` — `withRetry()`: exponential backoff with full jitter, configurable
  `shouldRetry` predicate, AbortSignal propagation.
- `rate_limiter.ts` — `RateLimiter` class (instance-based token bucket, no
  module-level state), `unlimited()` factory for disabled mode.
- `http.ts` — `HttpClient`: `fetch` wrapper with bearer token injection,
  JSON and `application/x-www-form-urlencoded` body encoding, LRU caching
  for safe GET endpoints, retry, rate limiting, per-request AbortSignal,
  `Idempotency-Key` header support.
- `webhook.ts` — `WebhookService`: HMAC-SHA256 verification via Web Crypto API,
  constant-time comparison, typed event parsing, handler registry with wildcard
  support, `dispatch()`.

**Application layer (`src/application/`)**

- `auth.ts` — `AuthService`: `clientCredentials`, `exchangeCode`, `refreshToken`,
  `createAuthorizationGrant`, `delegateAuthorizationGrant`, `buildAuthorizationUrl`,
  `buildLinkUrl`. Token caching (30-second safety margin).
- `accounts.ts` — `AccountsService`: accounts (list, listAll, get), credentials
  (list, get, delete), identity.
- `transactions.ts` — `TransactionsService`: transactions (list, listAll, get),
  enriched transactions (list, listAll) at `/enrichment/v1/transactions`,
  categories (list, get), statistics (query).
- `providers.ts` — `ProvidersService`: list (with market/capabilities filter),
  getStatus.
- `users_investments_loans.ts` — `UsersService` (profile, create, delete),
  `InvestmentsService` (listAccounts, listAllAccounts, getHoldings),
  `LoansService` (listAccounts, listAllAccounts).
- `finance.ts` — `FinanceService`: budgets (list, create, get, update, delete,
  history), cash flow, calendar events (list, create, get, delete, summaries).
- `verification.ts` — `VerificationService`: account check session creation,
  reports (list, get, account parties), balance refresh (initiate, status),
  income check, expense check, risk insights, risk categorisation, business
  account check, Tink Link URL builders (account check, consent update,
  continuous access).
- `connectivity.ts` — `ConnectivityService`: connectivity summary, credential
  connectivity, connector user creation, account/transaction ingestion,
  Tink Link URL builders (transactions, payment, generic).

**Root**

- `src/index.ts` — `TinkClient`: wires all services via a single shared
  `HttpClient`. `authenticate()` convenience method. `flushCache()`.
  Re-exports `TinkError` and all domain types.

**Tests (68 total, 7 suites)**

- `errors.test.ts` — TinkError construction, type classification, retryable logic.
- `cache.test.ts` — LRU eviction, TTL expiry, prefix invalidation, flush.
- `retry.test.ts` — success, retry-until-success, no-retry for non-retryable,
  exhaustion, custom predicate, abort.
- `rate_limiter.test.ts` — unlimited, burst exhaustion, disabled mode, refill, abort.
- `http.test.ts` — GET with/without cache, POST JSON, POST form-encoded,
  DELETE, error classification, User-Agent header.
- `auth.test.ts` — form encoding of token endpoint, authorization grant
  (snake_case keys verified), delegation with `actor_client_id`,
  token caching, `clearTokenCache`.
- `webhook.test.ts` — HMAC signature verification, tamper detection,
  empty/missing signature, event parsing, dispatch with typed+wildcard handlers.

### Fixed (vs original npm package)

| Bug                                    | Original                                                   | Fixed                                                                                                                               |
| -------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `authorization-grant` wire format      | JSON body with `userId`, `externalUserId` (camelCase)      | `application/x-www-form-urlencoded` with `user_id`, `external_user_id` (snake_case), matching real Tink API and both reference SDKs |
| `delegate` missing `actor_client_id`   | Not included, making delegation broken                     | Required field; defaults to own `clientId` when omitted                                                                             |
| Module-level rate limiter state        | `let buckets = {}; let _enabled = ...` at module top-level | `RateLimiter` class instances — no shared mutable state                                                                             |
| `buildAuthorizationUrl` wrong endpoint | Pointed to `/api/v1/oauth/authorization-grant`             | Points to correct `https://api.tink.com/oauth2/authorize`                                                                           |
| No structured errors                   | Raw `Error` objects or untyped throws                      | `TinkError` with `type`, `status`, `errorCode`, `requestId`, `retryable`                                                            |
| No enriched transactions               | Missing endpoint entirely                                  | Added `/enrichment/v1/transactions` with confirmed 10/100 default/max                                                               |
| No identities service                  | Missing                                                    | `AccountsService.getIdentity()` at `/data/v2/identity`                                                                              |
| `txConfig.cacheEnabled` global flag    | `NON_CACHEABLE_PATTERNS` using `toString()` checks         | Instance-based cache, prefix-exact matching, correct non-cacheable list                                                             |
| TypeScript not strict                  | No `strict: true`, no `exactOptionalPropertyTypes`         | Full strict mode + `exactOptionalPropertyTypes: true`                                                                               |
| No tests                               | Zero test files despite jest configured                    | 68 tests across 7 suites                                                                                                            |
