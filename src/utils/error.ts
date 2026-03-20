import type { TinkErrorType } from "../types";

/**
 * Structured error thrown by all TinkClient methods.
 *
 * Every API call that fails — whether from an HTTP error, network issue,
 * timeout, or decode failure — throws a TinkError with a typed `type`
 * discriminant so you can handle specific cases cleanly.
 *
 * @example
 * ```ts
 * try {
 *   await tink.accounts.listAccounts();
 * } catch (err) {
 *   if (err instanceof TinkError) {
 *     if (err.type === "authentication_error") { // re-authenticate }
 *     if (err.retryable) { // safe to retry }
 *   }
 * }
 * ```
 */
export class TinkError extends Error {
  /** Discriminated error type */
  readonly type: TinkErrorType;
  /** HTTP status code, if applicable */
  readonly status: number | undefined;
  /** Application-level error code from the API response body */
  readonly errorCode: string | undefined;
  /** Full error response body for debugging */
  readonly errorDetails: Record<string, unknown> | undefined;
  /** Request ID from the API response, useful for support tickets */
  readonly requestId: string | undefined;
  /** Original underlying error (network failure, decode error, etc.) */
  readonly originalError: unknown;

  constructor(opts: {
    type: TinkErrorType;
    message: string;
    status?: number;
    errorCode?: string;
    errorDetails?: Record<string, unknown>;
    requestId?: string;
    originalError?: unknown;
  }) {
    super(opts.message);
    this.name = "TinkError";
    this.type = opts.type;
    this.status = opts.status;
    this.errorCode = opts.errorCode;
    this.errorDetails = opts.errorDetails;
    this.requestId = opts.requestId;
    this.originalError = opts.originalError;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Returns true if this error is safe to retry.
   * Network errors, timeouts, and 5xx server errors are retryable.
   * 4xx client errors (except 408 and 429) are not.
   */
  get retryable(): boolean {
    return (
      this.type === "network_error" ||
      this.type === "timeout" ||
      (this.status !== undefined && [408, 429, 500, 502, 503, 504].includes(this.status))
    );
  }

  /**
   * Returns a human-readable error description including status and error code.
   * @example "[401] Unauthorized (TOKEN_INVALID)"
   */
  format(): string {
    const pre = this.status !== undefined ? `[${this.status}] ` : "";
    const suf = this.errorCode ? ` (${this.errorCode})` : "";
    return `${pre}${this.message}${suf}`;
  }

  override toString(): string {
    return `TinkError: ${this.format()}`;
  }

  /**
   * Creates a TinkError from an HTTP response status and body.
   * Used internally by HttpClient after every non-2xx response.
   */
  static fromResponse(status: number, body: unknown): TinkError {
    return new TinkError({
      type: typeFromStatus(status),
      message: extractMessage(body),
      status,
      errorCode: strField(body, "errorCode") ?? strField(body, "error") ?? undefined,
      errorDetails: isObj(body) ? (body as Record<string, unknown>) : undefined,
      requestId: strField(body, "requestId") ?? undefined,
    });
  }

  /**
   * Creates a TinkError from a network-level failure (fetch threw).
   * AbortError is classified as a timeout; everything else is network_error.
   */
  static fromNetworkError(cause: unknown): TinkError {
    if (cause instanceof Error) {
      const isTimeout =
        cause.name === "AbortError" || cause.message.toLowerCase().includes("timeout");
      return new TinkError({
        type: isTimeout ? "timeout" : "network_error",
        message: cause.message,
        originalError: cause,
      });
    }
    return new TinkError({ type: "network_error", message: String(cause), originalError: cause });
  }

  /**
   * Creates a TinkError when the response body cannot be parsed.
   */
  static fromDecodeError(cause: unknown): TinkError {
    return new TinkError({
      type: "decode_error",
      message: cause instanceof Error ? cause.message : "Failed to decode response",
      originalError: cause,
    });
  }

  /**
   * Creates a validation_error — used for missing required configuration.
   */
  static validation(message: string): TinkError {
    return new TinkError({ type: "validation_error", message });
  }
}

// ── private helpers ──────────────────────────────────────────────────────────

function typeFromStatus(s: number): TinkErrorType {
  if (s === 401) return "authentication_error";
  if (s === 429) return "rate_limit_error";
  if (s === 400) return "validation_error";
  if (s >= 400 && s < 600) return "api_error";
  return "unknown";
}

function extractMessage(body: unknown): string {
  if (!isObj(body)) return typeof body === "string" ? body : "HTTP error";
  const b = body as Record<string, unknown>;
  for (const k of ["errorMessage", "error_description", "message", "error"]) {
    if (typeof b[k] === "string") return b[k] as string;
  }
  return "Unknown error";
}

function strField(body: unknown, key: string): string | null {
  if (!isObj(body)) return null;
  const v = (body as Record<string, unknown>)[key];
  return typeof v === "string" ? v : null;
}

function isObj(v: unknown): boolean {
  return typeof v === "object" && v !== null;
}
