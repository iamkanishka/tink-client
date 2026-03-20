/**
 * Token expiry utilities for managing Tink OAuth access tokens.
 *
 * Access tokens expire after a period indicated by the `expires_in` field
 * in the token response. These helpers make it easy to check expiry and
 * proactively refresh before the token actually expires.
 *
 * A 5-minute buffer is applied so tokens are considered "expired" when
 * fewer than 300 seconds remain — giving time to refresh before API calls fail.
 *
 * @example
 * ```ts
 * import { parseExpiration, expired } from "tink-client";
 *
 * const tokenResponse = await tink.auth.getAccessToken(id, secret, scope);
 * const expiresAt = parseExpiration(tokenResponse);
 *
 * // Later, before making API calls:
 * if (expired(expiresAt)) {
 *   await tink.authenticate(scope); // re-acquire token
 * }
 * ```
 */

/** Refresh buffer — tokens are treated as expired 5 minutes before actual expiry */
const BUFFER_SECONDS = 300;

/**
 * Returns true if the token has expired (or will expire within the buffer window).
 * Returns true if expiresAt is null or undefined.
 */
export function expired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return true;
  const bufferTime = new Date(Date.now() + BUFFER_SECONDS * 1000);
  return expiresAt <= bufferTime;
}

/**
 * Returns true if the token will expire soon (within the 5-minute buffer).
 * Equivalent to `expired` — a token expiring within the buffer should be refreshed.
 */
export function expiresSoon(expiresAt: Date | null | undefined): boolean {
  return expired(expiresAt);
}

/**
 * Returns the number of seconds remaining until token expiry.
 * Returns `{ ok: false, error: "no_expiration" }` if expiresAt is not provided.
 */
export function timeUntilExpiration(
  expiresAt: Date | null | undefined
): { ok: true; seconds: number } | { ok: false; error: "no_expiration" } {
  if (!expiresAt) return { ok: false, error: "no_expiration" };
  const seconds = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  return { ok: true, seconds };
}

/**
 * Computes a token expiry Date from an `expires_in` value (seconds from now).
 */
export function calculateExpiration(expiresInSeconds: number): Date {
  return new Date(Date.now() + expiresInSeconds * 1000);
}

/**
 * Returns the buffer period in seconds (300).
 */
export function bufferSeconds(): number {
  return BUFFER_SECONDS;
}

/**
 * Parses an expiry Date from a raw token response object.
 * Returns null if the response does not contain `expires_in`.
 *
 * @example
 * ```ts
 * const token = await tink.auth.getAccessToken(id, secret, scope);
 * const expiresAt = parseExpiration(token as Record<string, unknown>);
 * ```
 */
export function parseExpiration(tokenResponse: Record<string, unknown>): Date | null {
  const ei = tokenResponse["expires_in"];
  if (typeof ei === "number") return calculateExpiration(ei);
  return null;
}
