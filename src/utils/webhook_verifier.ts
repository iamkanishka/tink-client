/**
 * HMAC-SHA256 webhook signature verification.
 *
 * Tink signs every webhook payload with your webhook secret using HMAC-SHA256.
 * The signature is sent in the `X-Tink-Signature` header as a hex string.
 *
 * This module verifies that signature using a constant-time comparison
 * (via Node.js `crypto.timingSafeEqual`) to prevent timing attacks.
 *
 * @example
 * ```ts
 * // Express handler:
 * app.post("/webhooks/tink", express.text({ type: "*\/*" }), (req, res) => {
 *   const verifier = new WebhookVerifier(process.env.TINK_WEBHOOK_SECRET!);
 *   verifier.verify(req.body, req.headers["x-tink-signature"]);
 *   // If verify() doesn't throw, the payload is authentic
 *   res.sendStatus(200);
 * });
 * ```
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Thrown when webhook signature verification fails.
 * The `code` field identifies the specific failure reason.
 */
export class WebhookVerificationError extends Error {
  constructor(
    /** Machine-readable failure code */
    public readonly code:
      | "missing_signature"
      | "invalid_signature"
      | "invalid_payload"
      | "missing_type"
      | "missing_data"
      | "invalid_json"
      | string,
    message: string
  ) {
    super(message);
    this.name = "WebhookVerificationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Verifies Tink webhook signatures and validates payload structure.
 */
export class WebhookVerifier {
  constructor(private readonly secret: string) {}

  /**
   * Verifies the HMAC-SHA256 signature of a webhook payload.
   *
   * @param payload - Raw request body string (must be the exact bytes received)
   * @param signature - Value of the `X-Tink-Signature` header
   * @throws {WebhookVerificationError} if signature is missing or does not match
   */
  verify(payload: string | Buffer, signature: string | null | undefined): void {
    if (!signature) {
      throw new WebhookVerificationError(
        "missing_signature",
        "Missing X-Tink-Signature header — the request may not be from Tink"
      );
    }

    const rawPayload = typeof payload === "string" ? payload : payload.toString("utf8");
    const expected = this.generateSignature(rawPayload);

    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expected, "hex");

    // Constant-time comparison prevents timing-based signature guessing
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      throw new WebhookVerificationError(
        "invalid_signature",
        "Webhook signature mismatch — payload may have been tampered with"
      );
    }
  }

  /**
   * Generates an HMAC-SHA256 hex signature for a payload.
   * Useful for testing or for sending webhooks to yourself.
   */
  generateSignature(payload: string): string {
    return createHmac("sha256", this.secret).update(payload, "utf8").digest("hex");
  }

  /**
   * Validates that a parsed JSON payload has the expected structure
   * (`type` and `data` fields are required by all Tink webhook events).
   *
   * @throws {WebhookVerificationError} if the payload is malformed
   */
  validatePayload(payload: unknown): asserts payload is Record<string, unknown> {
    if (typeof payload !== "object" || payload === null) {
      throw new WebhookVerificationError(
        "invalid_payload",
        "Webhook payload must be a JSON object"
      );
    }
    const p = payload as Record<string, unknown>;
    if (!("type" in p)) {
      throw new WebhookVerificationError("missing_type", "Webhook payload missing 'type' field");
    }
    if (!("data" in p)) {
      throw new WebhookVerificationError("missing_data", "Webhook payload missing 'data' field");
    }
  }

  /**
   * Returns true if the payload is a Tink test webhook.
   * Test webhooks are sent from the Tink console to verify your endpoint.
   * They should be acknowledged (200 OK) but not processed.
   */
  isTestWebhook(payload: unknown): boolean {
    return (
      typeof payload === "object" &&
      payload !== null &&
      (payload as Record<string, unknown>)["type"] === "test"
    );
  }
}
