/**
 * Webhook event dispatcher with a handler registry.
 *
 * Combines signature verification with typed event dispatch. Register
 * handlers for specific event types (or use "*" for all events), then
 * call `handleWebhook()` in your HTTP route handler.
 *
 * Handler errors are caught and silently discarded so one failing handler
 * never prevents others from running or blocks the HTTP response.
 *
 * @example
 * ```ts
 * const handler = tink.createWebhookHandler(process.env.TINK_WEBHOOK_SECRET!);
 *
 * handler
 *   .registerHandler("credentials.updated", async (event) => {
 *     await syncUserCredentials(event.data.userId as string);
 *   })
 *   .registerHandler("credentials.refresh.failed", async (event) => {
 *     await notifyUserOfRefreshFailure(event.data.userId as string);
 *   });
 *
 * // Express:
 * app.post("/webhooks/tink", express.text({ type: "*\/*" }), async (req, res) => {
 *   const event = await handler.handleWebhook(req.body, req.headers["x-tink-signature"]);
 *   res.sendStatus(200);
 * });
 * ```
 */
import { WebhookVerifier, WebhookVerificationError } from "./webhook_verifier";
import type { WebhookEvent, WebhookEventType, WebhookHandlerFn } from "../types";

/** All known Tink webhook event type strings */
const KNOWN_EVENT_TYPES: Record<string, WebhookEventType> = {
  "credentials.updated": "credentials.updated",
  "credentials.refresh.succeeded": "credentials.refresh.succeeded",
  "credentials.refresh.failed": "credentials.refresh.failed",
  "provider_consents.created": "provider_consents.created",
  "provider_consents.revoked": "provider_consents.revoked",
  test: "test",
};

/**
 * Manages webhook handlers and dispatches incoming Tink webhook events.
 *
 * Create via `tink.createWebhookHandler(secret)` rather than instantiating directly.
 */
export class WebhookHandler {
  private readonly handlers = new Map<string, WebhookHandlerFn[]>();

  constructor(private readonly verifier: WebhookVerifier) {}

  /**
   * Verifies, parses, and dispatches a raw webhook request.
   *
   * - Verifies the HMAC-SHA256 signature
   * - Parses and validates the JSON body
   * - Returns null silently for test webhooks (they should be acknowledged but not processed)
   * - Dispatches to all registered handlers for the event type
   *
   * @param body - Raw request body string (do not parse before passing)
   * @param signature - Value of the `X-Tink-Signature` header
   * @returns The parsed event, or null for test webhooks
   * @throws {WebhookVerificationError} if the signature is invalid or body is malformed
   */
  async handleWebhook(
    body: string,
    signature: string | null | undefined
  ): Promise<WebhookEvent | null> {
    // 1. Verify HMAC signature
    this.verifier.verify(body, signature);

    // 2. Parse JSON body
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      throw new WebhookVerificationError("invalid_json", "Webhook body is not valid JSON");
    }

    // 3. Validate required fields
    this.verifier.validatePayload(payload);

    // 4. Silently ack test webhooks without dispatching
    if (this.verifier.isTestWebhook(payload)) return null;

    // 5. Build typed event
    const raw = payload as Record<string, unknown>;
    const rawType = String(raw["type"] ?? "");
    const event: WebhookEvent = {
      type: KNOWN_EVENT_TYPES[rawType] ?? rawType,
      data: (raw["data"] as Record<string, unknown>) ?? {},
      timestamp: typeof raw["timestamp"] === "string" ? raw["timestamp"] : undefined,
      raw,
    };

    // 6. Dispatch to registered handlers
    await this.dispatch(event);
    return event;
  }

  /**
   * Registers a handler function for a specific event type.
   * Use `"*"` to receive all event types (wildcard handler).
   * Multiple handlers per event type are supported — all are called.
   *
   * @returns `this` for method chaining
   */
  registerHandler(eventType: WebhookEventType | "*", fn: WebhookHandlerFn): this {
    const list = this.handlers.get(eventType) ?? [];
    list.push(fn);
    this.handlers.set(eventType, list);
    return this;
  }

  /**
   * Removes all handlers registered for the given event type.
   * @returns `this` for method chaining
   */
  unregisterHandlers(eventType: WebhookEventType | "*"): this {
    this.handlers.delete(eventType);
    return this;
  }

  /**
   * Returns a snapshot of all registered handlers, keyed by event type.
   */
  getHandlers(): Map<string, WebhookHandlerFn[]> {
    return new Map(this.handlers);
  }

  private async dispatch(event: WebhookEvent): Promise<void> {
    const typeHandlers = this.handlers.get(event.type) ?? [];
    const wildcardHandlers = this.handlers.get("*") ?? [];
    const all = [...typeHandlers, ...wildcardHandlers];

    // Promise.allSettled ensures all handlers run even if one throws
    await Promise.allSettled(
      all.map((h) => {
        try {
          return Promise.resolve(h(event));
        } catch (e) {
          return Promise.reject(e);
        }
      })
    );
  }
}

export { WebhookVerifier, WebhookVerificationError };
