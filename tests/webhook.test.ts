import { WebhookService } from "../src/infrastructure/webhook";
import { describe, expect, it } from "@jest/globals";

const SECRET = "test-webhook-secret-32chars-long!";

async function sign(body: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("WebhookService.verify", () => {
  it("accepts a valid signature", async () => {
    const svc = new WebhookService(SECRET);
    const body = JSON.stringify({ type: "test", data: {} });
    const sig = await sign(body, SECRET);
    await expect(svc.verify(body, sig)).resolves.toBeUndefined();
  });

  it("rejects a wrong signature", async () => {
    const svc = new WebhookService(SECRET);
    const body = JSON.stringify({ type: "test" });
    await expect(svc.verify(body, "a".repeat(64))).rejects.toMatchObject({
      type: "authentication_error",
    });
  });

  it("rejects an empty signature", async () => {
    const svc = new WebhookService(SECRET);
    await expect(svc.verify("{}", "")).rejects.toMatchObject({ type: "authentication_error" });
  });

  it("rejects a tampered body", async () => {
    const svc = new WebhookService(SECRET);
    const body = JSON.stringify({ type: "test", data: {} });
    const sig = await sign(body, SECRET);
    const tampered = JSON.stringify({ type: "test", data: { evil: true } });
    await expect(svc.verify(tampered, sig)).rejects.toMatchObject({ type: "authentication_error" });
  });

  it("throws validation_error when secret is empty", async () => {
    const svc = new WebhookService("");
    await expect(svc.verify("{}", "sig")).rejects.toMatchObject({ type: "validation_error" });
  });
});

describe("WebhookService.parse", () => {
  it("parses a well-formed event", () => {
    const svc = new WebhookService(SECRET);
    const event = svc.parse(
      JSON.stringify({
        type: "credentials.updated",
        data: { id: "c1" },
        timestamp: "2026-06-20T00:00:00Z",
      }),
    );
    expect(event.type).toBe("credentials.updated");
    expect(event.data["id"]).toBe("c1");
    expect(event.timestamp).toBe("2026-06-20T00:00:00Z");
  });

  it("throws decode_error on invalid JSON", () => {
    const svc = new WebhookService(SECRET);
    expect(() => svc.parse("not-json")).toThrow();
  });
});

describe("WebhookService.dispatch", () => {
  it("calls typed handler and wildcard handler", async () => {
    const svc = new WebhookService(SECRET);
    const received: string[] = [];

    svc.on("credentials.updated", (e) => {
      received.push("typed:" + e.type);
    });
    svc.on("*", (e) => {
      received.push("wildcard:" + e.type);
    });

    const body = JSON.stringify({ type: "credentials.updated", data: {} });
    const sig = await sign(body, SECRET);
    await svc.dispatch(body, sig);

    expect(received).toHaveLength(2);
    expect(received).toContain("typed:credentials.updated");
    expect(received).toContain("wildcard:credentials.updated");
  });

  it("calls all handlers even if one throws, then throws combined error", async () => {
    const svc = new WebhookService(SECRET);
    let secondCalled = false;
    svc.on("test", () => {
      throw new Error("handler 1 failed");
    });
    svc.on("test", () => {
      secondCalled = true;
    });

    const body = JSON.stringify({ type: "test", data: {} });
    const sig = await sign(body, SECRET);
    await expect(svc.dispatch(body, sig)).rejects.toBeDefined();
    expect(secondCalled).toBe(true);
  });

  it("rejects when signature is invalid", async () => {
    const svc = new WebhookService(SECRET);
    await expect(
      svc.dispatch(JSON.stringify({ type: "test", data: {} }), "badsig"),
    ).rejects.toMatchObject({ type: "authentication_error" });
  });
});
