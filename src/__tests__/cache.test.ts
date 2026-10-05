import { describe, it, expect, beforeEach } from 'vitest';
import { clientCache } from '@/lib/cache';

describe('clientCache (In-Memory SWR Cache)', () => {
  beforeEach(() => {
    clientCache.clear();
  });

  it('stores and retrieves data synchronously', () => {
    clientCache.set('test_key', [{ id: 1, name: 'Item 1' }]);
    expect(clientCache.has('test_key')).toBe(true);
    expect(clientCache.get('test_key')).toEqual([{ id: 1, name: 'Item 1' }]);
  });

  it('returns undefined for nonexistent keys', () => {
    expect(clientCache.has('nonexistent')).toBe(false);
    expect(clientCache.get('nonexistent')).toBeUndefined();
  });

  it('invalidates exact keys', () => {
    clientCache.set('invoices', [{ id: 'inv-1' }]);
    clientCache.invalidate('invoices');
    expect(clientCache.has('invoices')).toBe(false);
  });

  it('invalidates keys by prefix', () => {
    clientCache.set('products', [{ id: 'p1' }]);
    clientCache.set('products_true', [{ id: 'p1' }]);
    clientCache.set('products_false', [{ id: 'p2' }]);
    clientCache.set('customers', [{ id: 'c1' }]);

    clientCache.invalidate('products');

    expect(clientCache.has('products')).toBe(false);
    expect(clientCache.has('products_true')).toBe(false);
    expect(clientCache.has('products_false')).toBe(false);
    expect(clientCache.has('customers')).toBe(true);
  });

  it('correctly tracks staleness based on TTL', async () => {
    clientCache.set('short_lived', 'data', 10); // 10ms TTL
    expect(clientCache.isStale('short_lived')).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(clientCache.isStale('short_lived')).toBe(true);
    // In SWR, get still returns the data even when stale
    expect(clientCache.get('short_lived')).toBe('data');
  });

  it('clears all entries', () => {
    clientCache.set('k1', 1);
    clientCache.set('k2', 2);
    expect(clientCache.size).toBe(2);

    clientCache.clear();
    expect(clientCache.size).toBe(0);
    expect(clientCache.has('k1')).toBe(false);
  });
});
