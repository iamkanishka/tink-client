import { TinkError } from "../src/domain/errors";
import { describe, expect, it } from "@jest/globals";

describe("TinkError.fromResponse", () => {
  it("classifies 401 as authentication_error", () => {
    const e = TinkError.fromResponse(401, {
      errorMessage: "bad token",
      errorCode: "TOKEN_INVALID",
    });
    expect(e.type).toBe("authentication_error");
    expect(e.status).toBe(401);
    expect(e.errorCode).toBe("TOKEN_INVALID");
    expect(e.message).toBe("bad token");
  });

  it("classifies 429 as rate_limit_error", () => {
    const e = TinkError.fromResponse(429, {});
    expect(e.type).toBe("rate_limit_error");
  });

  it("classifies 400 as validation_error", () => {
    const e = TinkError.fromResponse(400, { message: "bad input" });
    expect(e.type).toBe("validation_error");
  });

  it("classifies 500 as api_error and marks retryable", () => {
    const e = TinkError.fromResponse(500, {});
    expect(e.type).toBe("api_error");
    expect(e.retryable).toBe(true);
  });

  it("marks 401 as NOT retryable", () => {
    const e = TinkError.fromResponse(401, {});
    expect(e.retryable).toBe(false);
  });

  it("marks 502/503/504 as retryable", () => {
    for (const s of [502, 503, 504]) {
      expect(TinkError.fromResponse(s, {}).retryable).toBe(true);
    }
  });

  it("extracts requestId from response body", () => {
    const e = TinkError.fromResponse(401, { requestId: "req-123" });
    expect(e.requestId).toBe("req-123");
  });
});

describe("TinkError.fromNetworkError", () => {
  it("returns null for null input", () => {
    expect(TinkError.fromNetworkError(null)).toBeNull();
  });

  it("classifies AbortError as timeout", () => {
    const err = new Error("fetch failed");
    err.name = "AbortError";
    const e = TinkError.fromNetworkError(err)!;
    expect(e.type).toBe("timeout");
    expect(e.retryable).toBe(true);
  });

  it("classifies connection refused as network_error", () => {
    const e = TinkError.fromNetworkError(new Error("connection refused"))!;
    expect(e.type).toBe("network_error");
    expect(e.retryable).toBe(true);
  });
});

describe("TinkError.fromDecodeError", () => {
  it("sets type to decode_error", () => {
    const e = TinkError.fromDecodeError(new Error("unexpected EOF"));
    expect(e.type).toBe("decode_error");
  });
});

describe("TinkError.validation", () => {
  it("creates a validation_error", () => {
    const e = TinkError.validation("scope is required");
    expect(e.type).toBe("validation_error");
    expect(e.message).toBe("scope is required");
    expect(e.retryable).toBe(false);
  });
});

describe("TinkError.format", () => {
  it("formats correctly with status and code", () => {
    const e = TinkError.fromResponse(401, {
      errorMessage: "Unauthorized",
      errorCode: "TOKEN_EXPIRED",
    });
    expect(e.format()).toBe("[401] Unauthorized (TOKEN_EXPIRED)");
  });

  it("formats without status for network errors", () => {
    const e = TinkError.fromNetworkError(new Error("timeout"))!;
    expect(e.format()).not.toContain("[");
  });
});

describe("TinkError instanceof", () => {
  it("is an instance of Error", () => {
    const e = TinkError.validation("test");
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(TinkError);
  });
});
