/**
 * @file cache.ts — In-Memory Runtime Cache for Zero-Latency Navigation
 *
 * Provides a lightweight, high-performance in-memory cache supporting
 * Stale-While-Revalidate (SWR) semantics, prefix-based invalidation,
 * TTL expiration, and bounded LRU eviction.
 *
 * Eliminates empty flashes and spinner layout shifts during page transitions
 * by serving warm memory data synchronously on initial hook mount.
 *
 * @module lib/cache
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTtlMs: number;
  private readonly maxEntries: number;

  constructor(defaultTtlMs = 5 * 60 * 1000, maxEntries = 200) {
    this.defaultTtlMs = defaultTtlMs;
    this.maxEntries = maxEntries;
  }

  /**
   * Retrieve cached data. Returns undefined if the key does not exist.
   * Note: In SWR pattern, stale data is still returned so UI renders instantly
   * while background revalidation fetches fresh data.
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;

    // Refresh position for LRU
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data;
  }

  /**
   * Check if a valid or stale entry exists in the cache.
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Check if a cached entry has passed its TTL.
   */
  isStale(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return true;
    return Date.now() - entry.timestamp > entry.ttlMs;
  }

  /**
   * Store data in cache with optional custom TTL.
   */
  set<T>(key: string, data: T, ttlMs = this.defaultTtlMs): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      // Evict oldest entry (LRU)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttlMs,
    });
  }

  /**
   * Invalidate exact key or all keys matching a prefix.
   * e.g. invalidate('products') invalidates 'products', 'products_true', 'products_false'
   */
  invalidate(keyOrPrefix: string): void {
    for (const key of Array.from(this.cache.keys())) {
      if (key === keyOrPrefix || key.startsWith(`${keyOrPrefix}_`) || key.startsWith(`${keyOrPrefix}:`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all entries.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Current number of cached keys.
   */
  get size(): number {
    return this.cache.size;
  }
}

// Global client-side singleton instance
export const clientCache = new MemoryCache();
