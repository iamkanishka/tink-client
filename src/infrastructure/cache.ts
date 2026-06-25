/**
 * Concurrency-safe LRU cache with per-entry TTL.
 *
 * Mirrors the Go `infrastructure/cache` package exactly:
 * doubly-linked list for eviction order, Map for O(1) lookup.
 * Size-bounded to prevent unbounded memory growth.
 */

interface Entry<V> {
  key: string;
  value: V;
  expiresAt: number; // Date.now() + ttlMs
  prev: Entry<V> | null;
  next: Entry<V> | null;
}

/** In-memory LRU cache with per-entry TTL. */
export class LRUCache<V = unknown> {
  private readonly map = new Map<string, Entry<V>>();
  private readonly maxSize: number;
  /** Sentinel nodes so we never null-check head/tail. */
  private readonly head: Entry<V>;
  private readonly tail: Entry<V>;

  constructor(maxSize = 512) {
    this.maxSize = maxSize > 0 ? maxSize : 512;
    // dummy sentinels
    this.head = {} as Entry<V>;
    this.tail = {} as Entry<V>;
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  /** Returns the cached value or `undefined` on miss / expiry. */
  get(key: string): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.remove(entry);
      return undefined;
    }
    this.moveToFront(entry);
    return entry.value;
  }

  /** Inserts or updates `key` with the given TTL in milliseconds. */
  set(key: string, value: V, ttlMs: number): void {
    const existing = this.map.get(key);
    if (existing) {
      existing.value = value;
      existing.expiresAt = Date.now() + ttlMs;
      this.moveToFront(existing);
      return;
    }
    if (this.map.size >= this.maxSize) this.evictLRU();
    const entry: Entry<V> = {
      key,
      value,
      expiresAt: Date.now() + ttlMs,
      prev: null,
      next: null,
    };
    this.insertFront(entry);
    this.map.set(key, entry);
  }

  /** Deletes a single key. No-op if absent. */
  delete(key: string): void {
    const entry = this.map.get(key);
    if (entry) this.remove(entry);
  }

  /** Removes all entries whose key starts with `prefix`. */
  invalidatePrefix(prefix: string): void {
    for (const [key, entry] of this.map) {
      if (key.startsWith(prefix)) this.remove(entry);
    }
  }

  /** Removes all entries from the cache. */
  flush(): void {
    this.map.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  /** Current number of entries (may include not-yet-evicted expired ones). */
  get size(): number {
    return this.map.size;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private insertFront(entry: Entry<V>): void {
    entry.prev = this.head;
    entry.next = this.head.next;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.head.next!.prev = entry;
    this.head.next = entry;
  }

  private moveToFront(entry: Entry<V>): void {
    this.unlink(entry);
    this.insertFront(entry);
  }

  private evictLRU(): void {
    const lru = this.tail.prev;
    if (lru && lru !== this.head) this.remove(lru);
  }

  private remove(entry: Entry<V>): void {
    this.unlink(entry);
    this.map.delete(entry.key);
  }

  private unlink(entry: Entry<V>): void {
    if (entry.prev) entry.prev.next = entry.next;
    if (entry.next) entry.next.prev = entry.prev;
  }
}
