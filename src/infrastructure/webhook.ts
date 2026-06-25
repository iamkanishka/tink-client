/**
 * HMAC-SHA256 webhook signature verification using the Web Crypto API.
 */

import { TinkError } from "../domain/errors.js";
import type { WebhookEvent, WebhookEventType, WebhookHandlerFn } from "../domain/types.js";

export class WebhookService {
  private readonly secret: string;
  private readonly handlers = new Map<string, WebhookHandlerFn[]>();

  constructor(secret: string) {
    this.secret = secret;
  }

  async verify(body: ArrayBuffer | string, signature: string): Promise<void> {
    if (!this.secret) throw TinkError.validation("Webhook secret is not configured");
    if (!signature) {
      throw new TinkError({
        type: "authentication_error",
        message: "Missing X-Tink-Signature header",
      });
    }
    const expected = await this.computeHmac(body);
    if (!timingSafeEqual(expected, signature.toLowerCase())) {
      throw new TinkError({ type: "authentication_error", message: "Webhook signature mismatch" });
    }
  }

  async verifyAndParse(body: string, signature: string): Promise<WebhookEvent> {
    await this.verify(body, signature);
    return this.parse(body);
  }

  parse(body: string): WebhookEvent {
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(body) as Record<string, unknown>;
    } catch (err) {
      throw TinkError.fromDecodeError(err);
    }
    const event: WebhookEvent = {
      type: (raw["type"] as WebhookEventType | undefined) ?? "",
      data: (raw["data"] as Record<string, unknown> | undefined) ?? {},
      raw,
    };
    const ts = raw["timestamp"];
    if (typeof ts === "string") event.timestamp = ts;
    return event;
  }

  on(
    eventType: WebhookEventType | "*" | (string & NonNullable<unknown>),
    handler: WebhookHandlerFn,
  ): void {
    const existing = this.handlers.get(eventType) ?? [];
    existing.push(handler);
    this.handlers.set(eventType, existing);
  }

  async dispatch(body: string, signature: string): Promise<void> {
    const event = await this.verifyAndParse(body, signature);
    const typed = this.handlers.get(event.type) ?? [];
    const wildcard = this.handlers.get("*") ?? [];
    const all = [...typed, ...wildcard];
    const errors: string[] = [];
    for (const handler of all) {
      try {
        await handler(event);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }
    if (errors.length > 0) {
      throw new TinkError({
        type: "api_error",
        message: `Webhook handler errors: ${errors.join("; ")}`,
      });
    }
  }

  private async computeHmac(body: ArrayBuffer | string): Promise<string> {
    const enc = new TextEncoder();
    const keyData = enc.encode(this.secret);
    const msgData = typeof body === "string" ? enc.encode(body) : body;
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, msgData);
    return bufferToHex(sig);
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function bufferToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
