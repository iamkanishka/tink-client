import { LRUCache } from "../src/infrastructure/cache";

import { describe, expect, it } from "@jest/globals";

describe("LRUCache", () => {
  it("returns undefined on miss", () => {
    const c = new LRUCache<number>();
    expect(c.get("missing")).toBeUndefined();
  });

  it("stores and retrieves a value", () => {
    const c = new LRUCache<number>();
    c.set("key", 42, 60_000);
    expect(c.get("key")).toBe(42);
  });

  it("returns undefined after TTL expires", async () => {
    const c = new LRUCache<string>();
    c.set("k", "v", 1); // 1ms TTL
    await new Promise((r) => setTimeout(r, 10));
    expect(c.get("k")).toBeUndefined();
  });

  it("updates an existing key", () => {
    const c = new LRUCache<string>();
    c.set("k", "v1", 60_000);
    c.set("k", "v2", 60_000);
    expect(c.get("k")).toBe("v2");
    expect(c.size).toBe(1);
  });

  it("evicts LRU entry when at capacity", () => {
    const c = new LRUCache<number>(3);
    c.set("a", 1, 60_000);
    c.set("b", 2, 60_000);
    c.set("c", 3, 60_000);
    c.set("d", 4, 60_000); // evicts "a"
    expect(c.get("a")).toBeUndefined();
    expect(c.get("b")).toBe(2);
    expect(c.get("c")).toBe(3);
    expect(c.get("d")).toBe(4);
  });

  it("promotes accessed entry to front (avoids premature eviction)", () => {
    const c = new LRUCache<number>(3);
    c.set("a", 1, 60_000);
    c.set("b", 2, 60_000);
    c.set("c", 3, 60_000);
    c.get("a"); // promote "a"
    c.set("d", 4, 60_000); // should evict "b" not "a"
    expect(c.get("a")).toBe(1);
    expect(c.get("b")).toBeUndefined();
  });

  it("deletes a key", () => {
    const c = new LRUCache<string>();
    c.set("k", "v", 60_000);
    c.delete("k");
    expect(c.get("k")).toBeUndefined();
  });

  it("delete is a no-op for missing key", () => {
    const c = new LRUCache();
    expect(() => c.delete("nope")).not.toThrow();
  });

  it("invalidatePrefix removes matching keys", () => {
    const c = new LRUCache<string>();
    c.set("GET:/accounts", "a", 60_000);
    c.set("GET:/accounts/123", "b", 60_000);
    c.set("GET:/transactions", "c", 60_000);
    c.invalidatePrefix("GET:/accounts");
    expect(c.get("GET:/accounts")).toBeUndefined();
    expect(c.get("GET:/accounts/123")).toBeUndefined();
    expect(c.get("GET:/transactions")).toBe("c");
  });

  it("flush clears all entries", () => {
    const c = new LRUCache<number>();
    c.set("a", 1, 60_000);
    c.set("b", 2, 60_000);
    c.flush();
    expect(c.size).toBe(0);
    expect(c.get("a")).toBeUndefined();
  });
});
