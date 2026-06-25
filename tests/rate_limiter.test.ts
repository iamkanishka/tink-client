import { RateLimiter } from "../src/infrastructure/rate_limiter";
import { describe, expect, it } from "@jest/globals";

describe("RateLimiter", () => {
  it("unlimited() never blocks", async () => {
    const l = RateLimiter.unlimited();
    await expect(l.consume()).resolves.toBeUndefined();
    for (let i = 0; i < 100; i++) expect(l.tryConsume()).toBe(true);
  });

  it("tryConsume returns false when burst is exhausted", () => {
    const l = new RateLimiter({ rate: 1, burst: 3 });
    expect(l.tryConsume()).toBe(true);
    expect(l.tryConsume()).toBe(true);
    expect(l.tryConsume()).toBe(true);
    expect(l.tryConsume()).toBe(false);
  });

  it("rate <= 0 creates a disabled (unlimited) limiter", () => {
    const l = new RateLimiter({ rate: 0, burst: 1 });
    // With rate=0, every tryConsume returns true (disabled mode)
    for (let i = 0; i < 10; i++) expect(l.tryConsume()).toBe(true);
  });

  it("refills tokens over time", async () => {
    const l = new RateLimiter({ rate: 100, burst: 1 });
    expect(l.tryConsume()).toBe(true); // use the initial token
    expect(l.tryConsume()).toBe(false); // empty
    await new Promise((r) => setTimeout(r, 20)); // wait for ~2 tokens to refill
    expect(l.tryConsume()).toBe(true);
  });

  it("aborted consume rejects", async () => {
    const l = new RateLimiter({ rate: 0.0001, burst: 0 });
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(l.consume(ctrl.signal)).rejects.toThrow();
  });
});
