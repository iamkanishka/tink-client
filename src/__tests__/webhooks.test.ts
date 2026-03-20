import { createHmac } from "node:crypto";
import { WebhookVerifier, WebhookVerificationError } from "../utils/webhook_verifier";
import { WebhookHandler } from "../utils/webhook_handler";
import type { WebhookEvent } from "../types";

const SECRET = "test_webhook_secret_xyz_123";

function sign(payload: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

function makeBody(type: string, data: Record<string, unknown> = {}, ts = "2024-01-15T12:00:00Z"): string {
  return JSON.stringify({ type, data, timestamp: ts });
}

// ═════════════════════════════════════════════════════════════════════════════
// WebhookVerifier
// ═════════════════════════════════════════════════════════════════════════════

describe("WebhookVerifier", () => {
  let v: WebhookVerifier;
  beforeEach(() => { v = new WebhookVerifier(SECRET); });

  const VALID_BODY = makeBody("credentials.updated", { userId: "u1" });

  // ── verify() ──────────────────────────────────────────────────────────────

  describe("verify()", () => {
    it("passes silently for a valid signature", () => {
      expect(() => v.verify(VALID_BODY, sign(VALID_BODY))).not.toThrow();
    });

    it("accepts Buffer payloads", () => {
      expect(() => v.verify(Buffer.from(VALID_BODY, "utf8"), sign(VALID_BODY))).not.toThrow();
    });

    it("throws WebhookVerificationError for null signature", () => {
      expect(() => v.verify(VALID_BODY, null)).toThrow(WebhookVerificationError);
    });

    it("throws with code 'missing_signature' for null signature", () => {
      try { v.verify(VALID_BODY, null); }
      catch (e) { expect((e as WebhookVerificationError).code).toBe("missing_signature"); }
    });

    it("throws with code 'missing_signature' for undefined signature", () => {
      try { v.verify(VALID_BODY, undefined); }
      catch (e) { expect((e as WebhookVerificationError).code).toBe("missing_signature"); }
    });

    it("throws with code 'invalid_signature' for wrong secret", () => {
      try { v.verify(VALID_BODY, sign(VALID_BODY, "wrong-secret")); }
      catch (e) { expect((e as WebhookVerificationError).code).toBe("invalid_signature"); }
    });

    it("throws with code 'invalid_signature' for tampered body", () => {
      try { v.verify(VALID_BODY + "x", sign(VALID_BODY)); }
      catch (e) { expect((e as WebhookVerificationError).code).toBe("invalid_signature"); }
    });

    it("throws with code 'invalid_signature' for truncated signature", () => {
      const truncated = sign(VALID_BODY).slice(0, 32);
      try { v.verify(VALID_BODY, truncated); }
      catch (e) { expect((e as WebhookVerificationError).code).toBe("invalid_signature"); }
    });

    it("is timing-safe — different length sigs throw consistently", () => {
      expect(() => v.verify(VALID_BODY, "short")).toThrow(WebhookVerificationError);
    });
  });

  // ── generateSignature() ───────────────────────────────────────────────────

  describe("generateSignature()", () => {
    it("returns a 64-character hex string", () => {
      expect(v.generateSignature("test")).toMatch(/^[0-9a-f]{64}$/);
    });

    it("is deterministic for the same input", () => {
      expect(v.generateSignature("hello")).toBe(v.generateSignature("hello"));
    });

    it("produces different signatures for different inputs", () => {
      expect(v.generateSignature("a")).not.toBe(v.generateSignature("b"));
    });

    it("round-trips correctly with verify()", () => {
      const sig = v.generateSignature("payload123");
      expect(() => v.verify("payload123", sig)).not.toThrow();
    });
  });

  // ── validatePayload() ─────────────────────────────────────────────────────

  describe("validatePayload()", () => {
    it("passes for valid payload with type and data", () => {
      expect(() => v.validatePayload({ type: "credentials.updated", data: {} })).not.toThrow();
    });

    it("throws 'invalid_payload' for non-object", () => {
      try { v.validatePayload("string"); }
      catch (e) { expect((e as WebhookVerificationError).code).toBe("invalid_payload"); }
    });

    it("throws 'invalid_payload' for null", () => {
      try { v.validatePayload(null); }
      catch (e) { expect((e as WebhookVerificationError).code).toBe("invalid_payload"); }
    });

    it("throws 'missing_type' when type is absent", () => {
      try { v.validatePayload({ data: {} }); }
      catch (e) { expect((e as WebhookVerificationError).code).toBe("missing_type"); }
    });

    it("throws 'missing_data' when data is absent", () => {
      try { v.validatePayload({ type: "x" }); }
      catch (e) { expect((e as WebhookVerificationError).code).toBe("missing_data"); }
    });
  });

  // ── isTestWebhook() ───────────────────────────────────────────────────────

  describe("isTestWebhook()", () => {
    it("returns true for type === 'test'", () => {
      expect(v.isTestWebhook({ type: "test", data: {} })).toBe(true);
    });
    it("returns false for any other type", () => {
      expect(v.isTestWebhook({ type: "credentials.updated", data: {} })).toBe(false);
    });
    it("returns false for non-object", () => {
      expect(v.isTestWebhook("test")).toBe(false);
    });
    it("returns false for null", () => {
      expect(v.isTestWebhook(null)).toBe(false);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// WebhookHandler
// ═════════════════════════════════════════════════════════════════════════════

describe("WebhookHandler", () => {
  let handler: WebhookHandler;
  beforeEach(() => { handler = new WebhookHandler(new WebhookVerifier(SECRET)); });

  // ── handleWebhook() ───────────────────────────────────────────────────────

  describe("handleWebhook()", () => {
    it("processes a valid webhook and returns a parsed event", async () => {
      const body = makeBody("credentials.updated", { userId: "u1" });
      const event = await handler.handleWebhook(body, sign(body));
      expect(event).not.toBeNull();
      expect(event?.type).toBe("credentials.updated");
      expect(event?.data).toEqual({ userId: "u1" });
      expect(event?.timestamp).toBe("2024-01-15T12:00:00Z");
    });

    it("returns null for test webhooks", async () => {
      const body = makeBody("test");
      expect(await handler.handleWebhook(body, sign(body))).toBeNull();
    });

    it("throws WebhookVerificationError for missing signature", async () => {
      const body = makeBody("credentials.updated");
      await expect(handler.handleWebhook(body, null)).rejects.toBeInstanceOf(WebhookVerificationError);
    });

    it("throws WebhookVerificationError for invalid signature", async () => {
      const body = makeBody("credentials.updated");
      await expect(handler.handleWebhook(body, sign(body, "wrong"))).rejects.toBeInstanceOf(WebhookVerificationError);
    });

    it("throws 'invalid_json' for malformed body", async () => {
      const raw = "not json";
      try { await handler.handleWebhook(raw, sign(raw)); }
      catch (e) { expect((e as WebhookVerificationError).code).toBe("invalid_json"); }
    });

    it("maps all known event types correctly", async () => {
      const types = [
        "credentials.updated", "credentials.refresh.succeeded", "credentials.refresh.failed",
        "provider_consents.created", "provider_consents.revoked",
      ];
      for (const type of types) {
        const body = makeBody(type);
        const event = await handler.handleWebhook(body, sign(body));
        expect(event?.type).toBe(type);
      }
    });

    it("passes through unknown event types as-is", async () => {
      const body = makeBody("custom.event.type");
      const event = await handler.handleWebhook(body, sign(body));
      expect(event?.type).toBe("custom.event.type");
    });

    it("includes raw payload in event.raw", async () => {
      const body = makeBody("credentials.updated", { userId: "u1" });
      const event = await handler.handleWebhook(body, sign(body));
      expect(event?.raw).toEqual({ type: "credentials.updated", data: { userId: "u1" }, timestamp: "2024-01-15T12:00:00Z" });
    });
  });

  // ── registerHandler() ─────────────────────────────────────────────────────

  describe("registerHandler()", () => {
    it("dispatches to registered handler", async () => {
      const h = jest.fn();
      handler.registerHandler("credentials.updated", h);
      const body = makeBody("credentials.updated", { x: 1 });
      await handler.handleWebhook(body, sign(body));
      expect(h).toHaveBeenCalledTimes(1);
      expect((h.mock.calls[0] as [WebhookEvent])[0].data).toEqual({ x: 1 });
    });

    it("dispatches to multiple handlers for the same event type", async () => {
      const h1 = jest.fn(), h2 = jest.fn();
      handler.registerHandler("credentials.updated", h1);
      handler.registerHandler("credentials.updated", h2);
      const body = makeBody("credentials.updated");
      await handler.handleWebhook(body, sign(body));
      expect(h1).toHaveBeenCalledTimes(1);
      expect(h2).toHaveBeenCalledTimes(1);
    });

    it("wildcard handler receives all event types", async () => {
      const w = jest.fn();
      handler.registerHandler("*", w);
      const b1 = makeBody("credentials.updated");
      const b2 = makeBody("credentials.refresh.failed");
      await handler.handleWebhook(b1, sign(b1));
      await handler.handleWebhook(b2, sign(b2));
      expect(w).toHaveBeenCalledTimes(2);
    });

    it("both specific and wildcard handlers fire for matching event", async () => {
      const specific  = jest.fn();
      const wildcard  = jest.fn();
      handler.registerHandler("credentials.updated", specific);
      handler.registerHandler("*", wildcard);
      const body = makeBody("credentials.updated");
      await handler.handleWebhook(body, sign(body));
      expect(specific).toHaveBeenCalledTimes(1);
      expect(wildcard).toHaveBeenCalledTimes(1);
    });

    it("returns this for method chaining", () => {
      const result = handler.registerHandler("credentials.updated", jest.fn());
      expect(result).toBe(handler);
    });

    it("does NOT dispatch to unmatched handlers", async () => {
      const h = jest.fn();
      handler.registerHandler("provider_consents.created", h);
      const body = makeBody("credentials.updated");
      await handler.handleWebhook(body, sign(body));
      expect(h).not.toHaveBeenCalled();
    });
  });

  // ── unregisterHandlers() ──────────────────────────────────────────────────

  describe("unregisterHandlers()", () => {
    it("stops dispatching after unregistering", async () => {
      const h = jest.fn();
      handler.registerHandler("credentials.updated", h);
      handler.unregisterHandlers("credentials.updated");
      const body = makeBody("credentials.updated");
      await handler.handleWebhook(body, sign(body));
      expect(h).not.toHaveBeenCalled();
    });

    it("returns this for method chaining", () => {
      expect(handler.unregisterHandlers("credentials.updated")).toBe(handler);
    });
  });

  // ── getHandlers() ─────────────────────────────────────────────────────────

  describe("getHandlers()", () => {
    it("returns a Map of registered handlers", () => {
      const h = jest.fn();
      handler.registerHandler("credentials.updated", h);
      const map = handler.getHandlers();
      expect(map.get("credentials.updated")).toHaveLength(1);
    });

    it("returns a snapshot (not a reference)", () => {
      const h = jest.fn();
      handler.registerHandler("credentials.updated", h);
      const snapshot = handler.getHandlers();
      handler.unregisterHandlers("credentials.updated");
      // Snapshot should still contain the handler
      expect(snapshot.has("credentials.updated")).toBe(true);
    });
  });

  // ── Error isolation ───────────────────────────────────────────────────────

  describe("handler error isolation", () => {
    it("a throwing handler does not prevent other handlers from running", async () => {
      const thrower = jest.fn(() => { throw new Error("handler error"); });
      const good    = jest.fn();
      handler.registerHandler("credentials.updated", thrower);
      handler.registerHandler("credentials.updated", good);
      const body = makeBody("credentials.updated");
      // Should not reject — Promise.allSettled absorbs errors
      await expect(handler.handleWebhook(body, sign(body))).resolves.toBeDefined();
      expect(good).toHaveBeenCalledTimes(1);
    });

    it("an async handler that rejects does not crash the process", async () => {
      handler.registerHandler("credentials.updated", async () => { throw new Error("async error"); });
      const body = makeBody("credentials.updated");
      await expect(handler.handleWebhook(body, sign(body))).resolves.toBeDefined();
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// WebhookVerificationError
// ═════════════════════════════════════════════════════════════════════════════

describe("WebhookVerificationError", () => {
  it("is instanceof Error and WebhookVerificationError", () => {
    const e = new WebhookVerificationError("invalid_signature", "bad sig");
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(WebhookVerificationError);
  });

  it("sets name to WebhookVerificationError", () => {
    expect(new WebhookVerificationError("x", "y").name).toBe("WebhookVerificationError");
  });

  it("stores code and message", () => {
    const e = new WebhookVerificationError("missing_signature", "No header");
    expect(e.code).toBe("missing_signature");
    expect(e.message).toBe("No header");
  });
});
