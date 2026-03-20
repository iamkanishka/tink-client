/**
 * Internal utility helpers for the tink-client client.
 *
 * These functions handle URL and query string construction, money parsing,
 * parameter validation, and data sanitisation for logging.
 */

/**
 * Builds a URL with query parameters appended.
 * Keys are converted from snake_case to camelCase (Tink API convention).
 * Undefined and null values are omitted. Array values produce repeated params.
 *
 * @example
 * ```ts
 * buildUrl("/data/v2/accounts", { page_size: 25, type_in: ["CHECKING"] })
 * // → "/data/v2/accounts?pageSize=25&typeIn=CHECKING"
 * ```
 */
export function buildUrl(path: string, params?: unknown): string {
  if (!params) return path;
  const qs = buildQueryString(params);
  return qs ? `${path}?${qs}` : path;
}

/**
 * Encodes an object or array of [key, value] pairs as a URL query string.
 * Keys are converted from snake_case to camelCase.
 */
export function buildQueryString(params: unknown): string {
  if (!params) return "";
  const entries: Array<[string, unknown]> = Array.isArray(params)
    ? (params as Array<[string, unknown]>)
    : Object.entries(params as Record<string, unknown>);

  return entries
    .filter(([, v]) => v !== null && v !== undefined)
    .flatMap(([k, v]) => {
      const key = toCamelCase(String(k));
      if (Array.isArray(v)) {
        return v.map((i: unknown) => `${key}=${encodeURIComponent(String(i))}`);
      }
      return [`${key}=${encodeURIComponent(String(v))}`];
    })
    .join("&");
}

/**
 * Converts a snake_case string to camelCase.
 * @example toCamelCase("page_size") → "pageSize"
 */
export function toCamelCase(key: string): string {
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Parses a Tink API money object into a plain { amount, currency } pair.
 * Returns null if the input is not a valid money object.
 *
 * @example
 * ```ts
 * parseMoney({ value: "123.45", currencyCode: "GBP" })
 * // → { amount: "123.45", currency: "GBP" }
 * ```
 */
export function parseMoney(raw: unknown): { amount: string; currency: string } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r["value"] === undefined || r["value"] === null) return null;
  if (typeof r["currencyCode"] !== "string") return null;
  return { amount: String(r["value"]), currency: r["currencyCode"] as string };
}

/**
 * Validates that all required keys are present and non-null in a params object.
 *
 * @example
 * ```ts
 * const result = validateRequired({ userId: "u1" }, ["userId", "scope"]);
 * if (!result.ok) throw new Error(result.error);
 * ```
 */
export function validateRequired(
  params: Record<string, unknown>,
  requiredKeys: string[]
): { ok: true } | { ok: false; error: string } {
  for (const key of requiredKeys) {
    if (!(key in params) || params[key] === undefined || params[key] === null) {
      return { ok: false, error: `Missing required parameter: ${key}` };
    }
  }
  return { ok: true };
}

/**
 * Safely serialises a value to JSON.
 * Returns `{ ok: true, value: null }` for null/undefined input.
 */
export function encodeJson(
  data: unknown
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (data === null || data === undefined) return { ok: true, value: null };
  try {
    return { ok: true, value: JSON.stringify(data) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Encode failed" };
  }
}

/**
 * Safely parses a JSON string.
 */
export function decodeJson(
  json: string
): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(json) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Decode failed" };
  }
}

/**
 * Redacts sensitive fields from a data object before logging.
 * Replaces access tokens, secrets, and passwords with "[REDACTED]".
 */
export function redactSensitive(data: Record<string, unknown>): Record<string, unknown> {
  const sensitive = [
    "access_token",
    "accessToken",
    "refresh_token",
    "refreshToken",
    "client_secret",
    "clientSecret",
    "password",
    "api_key",
    "apiKey",
  ];
  const out = { ...data };
  for (const k of sensitive) {
    if (k in out) out[k] = "[REDACTED]";
  }
  return out;
}

/**
 * Safely retrieves a nested value from an object by key path.
 * Returns null (rather than throwing) if any intermediate key is missing.
 *
 * @example
 * ```ts
 * getInSafe({ user: { name: "John" } }, ["user", "name"]) // → "John"
 * getInSafe({ user: {} }, ["user", "age"])                 // → null
 * ```
 */
export function getInSafe(obj: unknown, keys: string[]): unknown {
  try {
    let cur = obj;
    for (const k of keys) {
      if (typeof cur !== "object" || cur === null) return null;
      cur = (cur as Record<string, unknown>)[k];
    }
    return cur ?? null;
  } catch {
    return null;
  }
}

/**
 * Merges a page token into a params object for pagination.
 * Returns the original object unchanged if pageToken is null/undefined.
 */
export function mergePaginationParams(
  opts: Record<string, unknown>,
  pageToken: string | null | undefined
): Record<string, unknown> {
  if (!pageToken) return opts;
  return { ...opts, page_token: pageToken };
}
