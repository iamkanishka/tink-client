import { TinkError } from "../utils/error";
import type { TinkErrorType } from "../types";

describe("TinkError", () => {
  // ── constructor ────────────────────────────────────────────────────────────

  describe("constructor", () => {
    it("is instanceof Error and TinkError", () => {
      const e = new TinkError({ type: "unknown", message: "test" });
      expect(e).toBeInstanceOf(Error);
      expect(e).toBeInstanceOf(TinkError);
    });

    it("sets name to TinkError", () => {
      expect(new TinkError({ type: "unknown", message: "x" }).name).toBe("TinkError");
    });

    it("stores all constructor fields", () => {
      const e = new TinkError({
        type: "api_error", message: "msg", status: 500,
        errorCode: "ERR_CODE", requestId: "req-123",
        errorDetails: { foo: "bar" },
      });
      expect(e.type).toBe("api_error");
      expect(e.message).toBe("msg");
      expect(e.status).toBe(500);
      expect(e.errorCode).toBe("ERR_CODE");
      expect(e.requestId).toBe("req-123");
      expect(e.errorDetails).toEqual({ foo: "bar" });
    });

    it("preserves prototype chain for instanceof checks", () => {
      const e = new TinkError({ type: "unknown", message: "x" });
      expect(e instanceof TinkError).toBe(true);
      expect(e instanceof Error).toBe(true);
    });
  });

  // ── retryable ──────────────────────────────────────────────────────────────

  describe("retryable getter", () => {
    const retryable: TinkErrorType[] = ["network_error", "timeout"];
    const nonRetryable: TinkErrorType[] = [
      "api_error", "authentication_error", "rate_limit_error",
      "validation_error", "decode_error", "market_mismatch", "unknown",
    ];
    const retryableStatuses = [408, 429, 500, 502, 503, 504];
    const nonRetryableStatuses = [400, 401, 403, 404];

    retryable.forEach(type => {
      it(`returns true for type="${type}"`, () => {
        expect(new TinkError({ type, message: "" }).retryable).toBe(true);
      });
    });

    nonRetryable.forEach(type => {
      it(`returns false for type="${type}" with no status`, () => {
        expect(new TinkError({ type, message: "" }).retryable).toBe(false);
      });
    });

    retryableStatuses.forEach(status => {
      it(`returns true for status ${status}`, () => {
        expect(new TinkError({ type: "api_error", message: "", status }).retryable).toBe(true);
      });
    });

    nonRetryableStatuses.forEach(status => {
      it(`returns false for status ${status}`, () => {
        expect(new TinkError({ type: "api_error", message: "", status }).retryable).toBe(false);
      });
    });
  });

  // ── format / toString ──────────────────────────────────────────────────────

  describe("format()", () => {
    it("includes status when present", () => {
      const e = new TinkError({ type: "api_error", message: "Bad request", status: 400 });
      expect(e.format()).toBe("[400] Bad request");
    });

    it("includes errorCode when present", () => {
      const e = new TinkError({ type: "api_error", message: "Unauthorized", status: 401, errorCode: "TOKEN_INVALID" });
      expect(e.format()).toBe("[401] Unauthorized (TOKEN_INVALID)");
    });

    it("omits status and errorCode when absent", () => {
      const e = new TinkError({ type: "network_error", message: "Connection refused" });
      expect(e.format()).toBe("Connection refused");
    });
  });

  describe("toString()", () => {
    it("prefixes with TinkError:", () => {
      const e = new TinkError({ type: "timeout", message: "Timed out" });
      expect(e.toString()).toBe("TinkError: Timed out");
    });
  });

  // ── fromResponse ──────────────────────────────────────────────────────────

  describe("fromResponse()", () => {
    it("maps 401 → authentication_error", () => {
      expect(TinkError.fromResponse(401, {}).type).toBe("authentication_error");
    });
    it("maps 429 → rate_limit_error", () => {
      expect(TinkError.fromResponse(429, {}).type).toBe("rate_limit_error");
    });
    it("maps 400 → validation_error", () => {
      expect(TinkError.fromResponse(400, {}).type).toBe("validation_error");
    });
    it("maps 500 → api_error", () => {
      expect(TinkError.fromResponse(500, {}).type).toBe("api_error");
    });
    it("maps 503 → api_error", () => {
      expect(TinkError.fromResponse(503, {}).type).toBe("api_error");
    });

    it("extracts errorMessage from body", () => {
      expect(TinkError.fromResponse(400, { errorMessage: "Bad param" }).message).toBe("Bad param");
    });
    it("extracts message from body", () => {
      expect(TinkError.fromResponse(400, { message: "Invalid" }).message).toBe("Invalid");
    });
    it("extracts error from body", () => {
      expect(TinkError.fromResponse(400, { error: "invalid_grant" }).message).toBe("invalid_grant");
    });
    it("falls back to 'Unknown error' for empty body", () => {
      expect(TinkError.fromResponse(500, {}).message).toBe("Unknown error");
    });
    it("handles plain string body", () => {
      expect(TinkError.fromResponse(500, "Internal Server Error").message).toBe("Internal Server Error");
    });
    it("extracts errorCode from body", () => {
      const e = TinkError.fromResponse(400, { errorMessage: "x", errorCode: "INVALID_SCOPE" });
      expect(e.errorCode).toBe("INVALID_SCOPE");
    });
    it("extracts requestId from body", () => {
      const e = TinkError.fromResponse(500, { errorMessage: "x", requestId: "req-abc" });
      expect(e.requestId).toBe("req-abc");
    });
    it("stores full body as errorDetails", () => {
      const body = { errorMessage: "x", extra: "data" };
      expect(TinkError.fromResponse(500, body).errorDetails).toEqual(body);
    });
    it("sets status correctly", () => {
      expect(TinkError.fromResponse(404, {}).status).toBe(404);
    });
  });

  // ── fromNetworkError ──────────────────────────────────────────────────────

  describe("fromNetworkError()", () => {
    it("returns network_error for generic Error", () => {
      expect(TinkError.fromNetworkError(new Error("ECONNREFUSED")).type).toBe("network_error");
    });

    it("returns timeout for AbortError", () => {
      const e = new Error("aborted");
      e.name = "AbortError";
      expect(TinkError.fromNetworkError(e).type).toBe("timeout");
    });

    it("returns timeout when message contains 'timeout'", () => {
      expect(TinkError.fromNetworkError(new Error("request timeout")).type).toBe("timeout");
    });

    it("returns timeout when message contains 'Timeout'", () => {
      expect(TinkError.fromNetworkError(new Error("Connection Timeout")).type).toBe("timeout");
    });

    it("handles non-Error values", () => {
      const e = TinkError.fromNetworkError("socket hang up");
      expect(e.type).toBe("network_error");
      expect(e.message).toBe("socket hang up");
    });

    it("stores original error", () => {
      const orig = new Error("ECONNREFUSED");
      expect(TinkError.fromNetworkError(orig).originalError).toBe(orig);
    });

    it("is retryable", () => {
      expect(TinkError.fromNetworkError(new Error("fail")).retryable).toBe(true);
    });
  });

  // ── fromDecodeError ───────────────────────────────────────────────────────

  describe("fromDecodeError()", () => {
    it("returns decode_error type", () => {
      expect(TinkError.fromDecodeError(new Error("JSON parse error")).type).toBe("decode_error");
    });

    it("uses error message", () => {
      expect(TinkError.fromDecodeError(new Error("Unexpected token")).message).toContain("Unexpected token");
    });

    it("uses fallback message for non-Error", () => {
      expect(TinkError.fromDecodeError("bad data").message).toBe("Failed to decode response");
    });

    it("stores original error", () => {
      const orig = new SyntaxError("bad json");
      expect(TinkError.fromDecodeError(orig).originalError).toBe(orig);
    });

    it("is NOT retryable", () => {
      expect(TinkError.fromDecodeError(new Error()).retryable).toBe(false);
    });
  });

  // ── validation ────────────────────────────────────────────────────────────

  describe("validation()", () => {
    it("returns validation_error type", () => {
      expect(TinkError.validation("Missing clientId").type).toBe("validation_error");
    });

    it("uses provided message", () => {
      expect(TinkError.validation("Field is required").message).toBe("Field is required");
    });

    it("is NOT retryable", () => {
      expect(TinkError.validation("bad").retryable).toBe(false);
    });
  });
});
