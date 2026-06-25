/**
 * HTTP transport adapter for the Tink SDK.
 */

import { TinkError } from "../domain/errors.js";
import type { RetryOptions } from "../domain/types.js";
import { LRUCache } from "./cache.js";
import { RateLimiter } from "./rate_limiter.js";
import { withRetry } from "./retry.js";

const DEFAULT_BASE_URL = "https://api.tink.com";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1_000;

const NON_CACHEABLE_PREFIXES = [
  "/api/v1/oauth/",
  "/api/v1/user",
  "/api/v1/credentials",
  "/connector/",
  "/monitoring/",
  "/link/v1/",
  "/api/v1/refresh/",
];

const NON_CACHEABLE_CONTAINS = ["/statistics/query", "/income-checks", "/expense-checks"];

export interface HttpClientOptions {
  baseUrl?: string;
  token?: string;
  userId?: string;
  timeoutMs?: number;
  maxRetries?: number;
  cache?: boolean;
  cacheMaxSize?: number;
  fetchFn?: typeof fetch;
  defaultHeaders?: Record<string, string>;
  retryOptions?: RetryOptions;
  rateLimiter?: RateLimiter;
}

export interface GetOptions {
  cacheTtlMs?: number | false;
  signal?: AbortSignal;
}

export interface MutationOptions {
  signal?: AbortSignal;
  idempotencyKey?: string;
}

export type TokenProvider = () => string | undefined;

export class HttpClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly cacheEnabled: boolean;
  private readonly cache: LRUCache<string>;
  private readonly fetchFn: typeof fetch;
  private readonly defaultHeaders: Record<string, string>;
  private readonly retryOptions: RetryOptions;
  private readonly rateLimiter: RateLimiter;
  // Exposed as a property so AuthService can temporarily override it.
  tokenProvider: TokenProvider;
  private userId: string | undefined;

  constructor(opts: HttpClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = opts.maxRetries ?? 3;
    this.cacheEnabled = opts.cache ?? true;
    this.cache = new LRUCache<string>(opts.cacheMaxSize ?? 512);
    this.fetchFn = opts.fetchFn ?? globalThis.fetch.bind(globalThis);
    this.defaultHeaders = opts.defaultHeaders ?? {};
    this.retryOptions = opts.retryOptions ?? {};
    this.rateLimiter = opts.rateLimiter ?? RateLimiter.unlimited();
    this.userId = opts.userId;
    const token = opts.token;
    this.tokenProvider = (): string | undefined => token;
  }

  setToken(token: string | undefined): void {
    const t = token;
    this.tokenProvider = (): string | undefined => t;
  }

  setTokenProvider(provider: TokenProvider): void {
    this.tokenProvider = provider;
  }

  setUserId(userId: string | undefined): void {
    this.userId = userId;
    if (userId) this.cache.invalidatePrefix(`user:${userId}:`);
  }

  invalidateCache(prefix: string): void {
    this.cache.invalidatePrefix(prefix);
  }
  flushCache(): void {
    this.cache.flush();
  }

  async get<T = unknown>(path: string, opts: GetOptions = {}): Promise<T> {
    const ttl =
      opts.cacheTtlMs !== false && this.cacheEnabled && isCacheable(path)
        ? (opts.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS)
        : 0;

    const cacheKey = this.cacheKey(path);
    if (ttl > 0) {
      const hit = this.cache.get(cacheKey);
      if (hit !== undefined) {
        try {
          return JSON.parse(hit) as T;
        } catch {
          this.cache.delete(cacheKey);
        }
      }
    }

    const result = await this.request<T>("GET", path, undefined, undefined, opts.signal);

    if (ttl > 0) {
      try {
        this.cache.set(cacheKey, JSON.stringify(result), ttl);
      } catch {
        /* skip caching if serialization fails */
      }
    }

    return result;
  }

  async post<T = unknown>(path: string, body?: unknown, opts: MutationOptions = {}): Promise<T> {
    return this.request<T>(
      "POST",
      path,
      body,
      "application/json",
      opts.signal,
      opts.idempotencyKey,
    );
  }

  async postForm<T = unknown>(
    path: string,
    fields: Record<string, string | undefined>,
    opts: MutationOptions = {},
  ): Promise<T> {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined && v !== "") params.set(k, v);
    }
    return this.request<T>(
      "POST",
      path,
      params.toString(),
      "application/x-www-form-urlencoded",
      opts.signal,
      opts.idempotencyKey,
    );
  }

  async put<T = unknown>(path: string, body?: unknown, opts: MutationOptions = {}): Promise<T> {
    return this.request<T>("PUT", path, body, "application/json", opts.signal, opts.idempotencyKey);
  }

  async patch<T = unknown>(path: string, body?: unknown, opts: MutationOptions = {}): Promise<T> {
    return this.request<T>(
      "PATCH",
      path,
      body,
      "application/json",
      opts.signal,
      opts.idempotencyKey,
    );
  }

  async delete(path: string, opts: MutationOptions = {}): Promise<void> {
    await this.request<void>(
      "DELETE",
      path,
      undefined,
      undefined,
      opts.signal,
      opts.idempotencyKey,
    );
  }

  private async request<T>(
    method: string,
    path: string,
    body: unknown,
    contentType: string | undefined,
    externalSignal: AbortSignal | undefined,
    idempotencyKey?: string,
  ): Promise<T> {
    await this.rateLimiter.consume(externalSignal);

    return withRetry(
      async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        const signal = externalSignal
          ? mergeSignals(externalSignal, controller.signal)
          : controller.signal;

        try {
          const url = this.baseUrl + path;
          const token = this.tokenProvider();
          const headers: Record<string, string> = {
            Accept: "application/json",
            "User-Agent": "tink-client-ts/2.0.0",
            ...this.defaultHeaders,
          };
          if (token) headers["Authorization"] = `Bearer ${token}`;
          if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

          let rawBody: string | undefined;
          if (body !== undefined) {
            rawBody = typeof body === "string" ? body : JSON.stringify(body);
            headers["Content-Type"] = contentType ?? "application/json";
          }

          const initObj: RequestInit = { method, headers, signal };
          if (rawBody !== undefined) initObj.body = rawBody;

          const resp = await this.fetchFn(url, initObj);

          if (!resp.ok) {
            let parsed: unknown;
            try {
              parsed = await resp.json();
            } catch {
              parsed = await resp.text().catch(() => "");
            }
            throw TinkError.fromResponse(resp.status, parsed);
          }

          if (resp.status === 204 || method === "DELETE") return undefined as T;

          try {
            return (await resp.json()) as T;
          } catch (err) {
            throw TinkError.fromDecodeError(err);
          }
        } catch (err) {
          if (err instanceof TinkError) throw err;
          const wrapped = TinkError.fromNetworkError(err);
          throw wrapped ?? new TinkError({ type: "network_error", message: String(err) });
        } finally {
          clearTimeout(timeout);
        }
      },
      { ...this.retryOptions, maxAttempts: this.maxRetries },
      externalSignal,
    );
  }

  private cacheKey(path: string): string {
    const scope = this.userId ? `user:${this.userId}:` : "";
    return `${scope}GET:${path}`;
  }
}

function isCacheable(path: string): boolean {
  for (const prefix of NON_CACHEABLE_PREFIXES) {
    if (path.startsWith(prefix)) return false;
  }
  for (const fragment of NON_CACHEABLE_CONTAINS) {
    if (path.includes(fragment)) return false;
  }
  return true;
}

function mergeSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const ctrl = new AbortController();
  const abort = (): void => ctrl.abort();
  if (a.aborted || b.aborted) {
    ctrl.abort();
  } else {
    a.addEventListener("abort", abort, { once: true });
    b.addEventListener("abort", abort, { once: true });
  }
  return ctrl.signal;
}
