/**
 * HTTP client with in-memory LRU caching and automatic retry.
 *
 * This module is the transport layer for all Tink API calls. It handles:
 * - Bearer token injection
 * - JSON and form-encoded request bodies
 * - LRU response caching with per-resource TTLs
 * - Automatic retry on retryable errors
 * - Request timeouts via AbortController
 * - Cache invalidation on mutating requests (POST/PUT/PATCH/DELETE)
 */
import { TinkError } from "./error";
import { withRetry } from "./retry";
import type { RetryOptions } from "../types";

// =============================================================================
// LRU Cache
// =============================================================================

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

class LRUCache {
  private readonly store = new Map<string, CacheEntry>();

  constructor(private readonly maxSize: number) {}

  get(key: string): unknown {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (Date.now() > e.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    // Move to end to maintain LRU order
    this.store.delete(key);
    this.store.set(key, e);
    return e.value;
  }

  set(key: string, value: unknown, ttlMs: number): void {
    if (this.store.size >= this.maxSize) {
      // Evict least-recently-used entry
      const k = this.store.keys().next().value;
      if (k !== undefined) this.store.delete(k);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  invalidatePrefix(prefix: string): void {
    for (const k of Array.from(this.store.keys())) {
      if (k.startsWith(prefix)) this.store.delete(k);
    }
  }

  clear(): void {
    this.store.clear();
  }
}

// =============================================================================
// Per-resource cache TTLs
// These match the Tink API data freshness characteristics:
// - Provider/category data is stable → long TTL
// - Balances change frequently → short TTL
// - Credentials status changes during auth → very short TTL
// =============================================================================

const CACHE_TTL: Record<string, number> = {
  providers: 60 * 60 * 1_000, // 1 hour   — rarely changes
  categories: 24 * 60 * 60 * 1_000, // 24 hours  — static reference data
  accounts: 5 * 60 * 1_000, // 5 minutes
  transactions: 5 * 60 * 1_000, // 5 minutes
  statistics: 60 * 60 * 1_000, // 1 hour
  credentials: 30 * 1_000, // 30 seconds — changes during auth flows
  balances: 1 * 60 * 1_000, // 1 minute  — real-time balance data
  users: 10 * 60 * 1_000, // 10 minutes
  reports: 24 * 60 * 60 * 1_000, // 24 hours  — immutable once generated
  default: 5 * 60 * 1_000, // 5 minutes
};

function resourceType(path: string): string {
  if (path.includes("/providers")) return "providers";
  if (path.includes("/categories")) return "categories";
  if (path.includes("investment-accounts")) return "accounts";
  if (path.includes("loan-accounts")) return "accounts";
  if (path.includes("/balances")) return "balances";
  if (path.includes("/accounts")) return "accounts";
  if (path.includes("/transactions")) return "transactions";
  if (path.includes("/statistics")) return "statistics";
  if (path.includes("/credentials")) return "credentials";
  if (path.includes("/identities")) return "users";
  if (
    path.includes("/income-check") ||
    path.includes("/expense-check") ||
    path.includes("/risk-insight") ||
    path.includes("/risk-categori") ||
    path.includes("business-account-verification")
  )
    return "reports";
  return "default";
}

/** Paths that are safe to cache (read-only endpoints) */
const CACHEABLE_PATTERNS = [
  "/api/v1/providers",
  "/api/v1/categories",
  "/api/v1/statistics",
  "/api/v1/credentials",
  "/data/v2/accounts",
  "/data/v2/investment-accounts",
  "/data/v2/loan-accounts",
  "/data/v2/transactions",
  "/data/v2/identities",
  "/finance-management/v1/business-budgets",
  "/finance-management/v1/cash-flow-summaries",
  "/finance-management/v1/financial-calendar",
];

/** Paths that must never be cached (auth, mutation, or real-time endpoints) */
const NON_CACHEABLE_PATTERNS = [
  "/oauth",
  "/user/create",
  "/user/delete",
  "/authorization-grant",
  "/link/v1/session",
  "/risk/",
  "/connector/",
  "/balance-refresh",
];

function isCacheable(path: string): boolean {
  return (
    CACHEABLE_PATTERNS.some((p) => path.includes(p)) &&
    !NON_CACHEABLE_PATTERNS.some((p) => path.includes(p))
  );
}

// =============================================================================
// HttpClient
// =============================================================================

export interface HttpClientConfig {
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
  cache: boolean;
  cacheMaxSize?: number;
  accessToken?: string;
  userId?: string;
  fetchFn?: typeof fetch;
  defaultHeaders?: Record<string, string>;
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly cacheEnabled: boolean;
  private readonly lru: LRUCache;
  private readonly fetchFn: typeof fetch;
  private readonly defaultHeaders: Record<string, string>;
  private _token: string | undefined;
  private _userId: string | undefined;

  constructor(cfg: HttpClientConfig) {
    this.baseUrl = cfg.baseUrl;
    this.timeoutMs = cfg.timeoutMs;
    this.maxRetries = cfg.maxRetries;
    this.cacheEnabled = cfg.cache;
    this.lru = new LRUCache(cfg.cacheMaxSize ?? 512);
    this._token = cfg.accessToken;
    this._userId = cfg.userId;
    this.defaultHeaders = cfg.defaultHeaders ?? {};

    if (cfg.fetchFn) {
      this.fetchFn = cfg.fetchFn;
    } else {
      const g = globalThis as { fetch?: typeof fetch };
      if (typeof g.fetch === "function") {
        this.fetchFn = g.fetch.bind(globalThis);
      } else {
        throw new TinkError({
          type: "network_error",
          message: "No global fetch found. Upgrade to Node.js ≥ 18 or pass fetchFn in TinkConfig.",
        });
      }
    }
  }

  get accessToken(): string | undefined {
    return this._token;
  }
  get userId(): string | undefined {
    return this._userId;
  }

  setAccessToken(t: string): void {
    this._token = t;
  }
  setUserId(id: string): void {
    this._userId = id;
  }

  /**
   * Invalidates all cache entries for a given user (or the current user).
   * Called automatically after any mutating request (POST/PUT/PATCH/DELETE).
   */
  invalidateUser(userId?: string): void {
    const id = userId ?? this._userId;
    if (id) this.lru.invalidatePrefix(`${id}:`);
  }

  /**
   * Clears the full cache or entries matching a path prefix.
   */
  invalidateCache(prefix?: string): void {
    prefix ? this.lru.invalidatePrefix(prefix) : this.lru.clear();
  }

  // ── HTTP verbs ─────────────────────────────────────────────────────────────

  /** GET with automatic caching for read-only endpoints */
  async get<T>(
    path: string,
    query?: Record<string, string | number | boolean | string[] | undefined>
  ): Promise<T> {
    const full = appendQuery(path, query);

    if (this.cacheEnabled && isCacheable(full)) {
      const key = cacheKey(this._userId ?? this._token, full);
      const hit = this.lru.get(key);
      if (hit !== undefined) return hit as T;
      const result = await this.dispatch<T>({ method: "GET", path: full });
      const ttl = CACHE_TTL[resourceType(full)] ?? CACHE_TTL["default"] ?? 300_000;
      this.lru.set(key, result, ttl);
      return result;
    }

    return this.dispatch<T>({ method: "GET", path: full });
  }

  /** POST — invalidates user cache on success */
  async post<T>(path: string, body?: unknown, opts: { contentType?: string } = {}): Promise<T> {
    const result = await this.dispatch<T>({
      method: "POST",
      path,
      body,
      contentType: opts.contentType,
    });
    this.invalidateUser();
    return result;
  }

  /** PUT — invalidates user cache on success */
  async put<T>(path: string, body?: unknown): Promise<T> {
    const result = await this.dispatch<T>({ method: "PUT", path, body });
    this.invalidateUser();
    return result;
  }

  /** PATCH — invalidates user cache on success */
  async patch<T>(path: string, body?: unknown): Promise<T> {
    const result = await this.dispatch<T>({ method: "PATCH", path, body });
    this.invalidateUser();
    return result;
  }

  /** DELETE — invalidates user cache on success */
  async delete<T = void>(path: string): Promise<T> {
    const result = await this.dispatch<T>({ method: "DELETE", path });
    this.invalidateUser();
    return result;
  }

  // ── Core dispatch ──────────────────────────────────────────────────────────

  private dispatch<T>(opts: ReqOpts): Promise<T> {
    return withRetry(() => this.execute<T>(opts), { maxAttempts: this.maxRetries } as RetryOptions);
  }

  private async execute<T>(opts: ReqOpts): Promise<T> {
    const url = `${this.baseUrl}${opts.path}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);

    const isForm = opts.contentType === "application/x-www-form-urlencoded";
    const headers: Record<string, string> = {
      accept: "application/json",
      ...this.defaultHeaders,
    };
    if (this._token) headers["authorization"] = `Bearer ${this._token}`;

    let fetchBody: string | undefined;
    if (opts.body !== undefined) {
      if (isForm) {
        headers["content-type"] = "application/x-www-form-urlencoded";
        fetchBody = encodeForm(opts.body as Record<string, string>);
      } else {
        headers["content-type"] = "application/json";
        try {
          fetchBody = JSON.stringify(opts.body);
        } catch (e) {
          throw TinkError.fromDecodeError(e);
        }
      }
    }

    let resp: Response;
    try {
      resp = await this.fetchFn(url, {
        method: opts.method,
        headers,
        body: fetchBody,
        signal: ctrl.signal,
      });
    } catch (e) {
      throw TinkError.fromNetworkError(e);
    } finally {
      clearTimeout(timer);
    }

    const ct = resp.headers.get("content-type") ?? "";
    let body: unknown;
    try {
      if (ct.includes("application/json")) body = await resp.json();
      else if (ct.includes("octet-stream") || ct.includes("pdf")) body = await resp.arrayBuffer();
      else {
        const t = await resp.text();
        body = t || null;
      }
    } catch (e) {
      throw TinkError.fromDecodeError(e);
    }

    if (!resp.ok) throw TinkError.fromResponse(resp.status, body);
    return body as T;
  }
}

// =============================================================================
// Private helpers
// =============================================================================

interface ReqOpts {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  contentType?: string;
}

/** Appends camelCase query params to a path */
function appendQuery(
  path: string,
  query?: Record<string, string | number | boolean | string[] | undefined>
): string {
  if (!query) return path;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    const key = k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    if (Array.isArray(v)) {
      for (const i of v) p.append(key, i);
    } else p.set(key, String(v));
  }
  const qs = p.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Cache key scoped to user or token (last 16 chars) */
function cacheKey(scope: string | undefined, path: string): string {
  return `${scope ? scope.slice(-16) : "public"}:${path}`;
}

/** Encode an object as application/x-www-form-urlencoded */
function encodeForm(data: Record<string, string>): string {
  return Object.entries(data)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}
