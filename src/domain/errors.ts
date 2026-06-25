/**
 * Structured error type for all tink-client SDK methods.
 */

export type TinkErrorType =
  | "api_error"
  | "authentication_error"
  | "rate_limit_error"
  | "validation_error"
  | "network_error"
  | "timeout"
  | "decode_error"
  | "unknown";

export class TinkError extends Error {
  override readonly name = "TinkError";
  readonly type: TinkErrorType;
  readonly status?: number;
  readonly errorCode?: string;
  readonly requestId?: string;
  readonly errorDetails?: Record<string, unknown>;
  readonly cause?: unknown;

  constructor(opts: {
    type: TinkErrorType;
    message: string;
    status?: number;
    errorCode?: string;
    requestId?: string;
    errorDetails?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(opts.message);
    this.type = opts.type;
    if (opts.status !== undefined) this.status = opts.status;
    if (opts.errorCode !== undefined) this.errorCode = opts.errorCode;
    if (opts.requestId !== undefined) this.requestId = opts.requestId;
    if (opts.errorDetails !== undefined) this.errorDetails = opts.errorDetails;
    if (opts.cause !== undefined) this.cause = opts.cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  get retryable(): boolean {
    if (this.type === "network_error" || this.type === "timeout") return true;
    if (this.status === undefined) return false;
    return [408, 429, 500, 502, 503, 504].includes(this.status);
  }

  format(): string {
    const pre = this.status !== undefined ? `[${this.status}] ` : "";
    const suf = this.errorCode ? ` (${this.errorCode})` : "";
    return `${pre}${this.message}${suf}`;
  }

  override toString(): string {
    return `TinkError: ${this.format()}`;
  }

  static fromResponse(status: number, body: unknown): TinkError {
    const opts: ConstructorParameters<typeof TinkError>[0] = {
      type: typeFromStatus(status),
      message: extractMessage(body),
      status,
    };
    const errorCode = strField(body, "errorCode") ?? strField(body, "error");
    if (errorCode) opts.errorCode = errorCode;
    const requestId = strField(body, "requestId");
    if (requestId) opts.requestId = requestId;
    if (isPlainObject(body)) opts.errorDetails = body as Record<string, unknown>;
    return new TinkError(opts);
  }

  static fromNetworkError(cause: unknown): TinkError | null {
    if (cause === null || cause === undefined) return null;
    if (cause instanceof Error) {
      const isTimeout =
        cause.name === "AbortError" || cause.message.toLowerCase().includes("timeout");
      return new TinkError({
        type: isTimeout ? "timeout" : "network_error",
        message: cause.message,
        cause,
      });
    }
    return new TinkError({ type: "network_error", message: String(cause), cause });
  }

  static fromDecodeError(cause: unknown): TinkError {
    return new TinkError({
      type: "decode_error",
      message: cause instanceof Error ? cause.message : "Failed to decode response",
      cause,
    });
  }

  static validation(message: string): TinkError {
    return new TinkError({ type: "validation_error", message });
  }
}

function typeFromStatus(s: number): TinkErrorType {
  if (s === 401) return "authentication_error";
  if (s === 429) return "rate_limit_error";
  if (s === 400) return "validation_error";
  if (s >= 400) return "api_error";
  return "unknown";
}

function extractMessage(body: unknown): string {
  if (!isPlainObject(body)) return typeof body === "string" ? body : "HTTP error";
  const b = body as Record<string, unknown>;
  for (const k of ["errorMessage", "error_description", "message", "error"]) {
    if (typeof b[k] === "string") return b[k];
  }
  return "Unknown error";
}

function strField(body: unknown, key: string): string | null {
  if (!isPlainObject(body)) return null;
  const v = (body as Record<string, unknown>)[key];
  return typeof v === "string" ? v : null;
}

function isPlainObject(v: unknown): boolean {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
