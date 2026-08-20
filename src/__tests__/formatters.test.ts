import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate, capitalize } from '../lib/utils/formatters';

describe('formatters utility', () => {
  describe('formatCurrency', () => {
    it('formats numbers to Nigerian Naira currency', () => {
      expect(formatCurrency(1250000)).toContain('1,250,000.00');
      expect(formatCurrency(1250000, true)).toContain('₦');
    });

    it('handles zero, null, undefined, and NaN gracefully', () => {
      expect(formatCurrency(0)).toContain('0.00');
      expect(formatCurrency(null)).toBe('₦0.00');
      expect(formatCurrency(undefined)).toBe('₦0.00');
      expect(formatCurrency(NaN)).toBe('₦0.00');
    });

    it('can omit currency symbol when requested', () => {
      expect(formatCurrency(500, false)).toBe('500.00');
    });
  });

  describe('formatDate', () => {
    it('formats ISO date strings correctly', () => {
      const formatted = formatDate('2026-07-09T14:30:00Z');
      expect(formatted).toContain('2026');
      expect(formatted).toContain('Jul');
    });

    it('returns N/A for empty or invalid date strings', () => {
      expect(formatDate(null)).toBe('N/A');
      expect(formatDate(undefined)).toBe('N/A');
      expect(formatDate('invalid-date-string')).toBe('N/A');
    });
  });

  describe('capitalize', () => {
    it('capitalizes words correctly', () => {
      expect(capitalize('john doe')).toBe('John Doe');
      expect(capitalize('sales representative')).toBe('Sales Representative');
    });

    it('returns empty string for null/undefined input', () => {
      expect(capitalize(null)).toBe('');
      expect(capitalize(undefined)).toBe('');
    });
  });
});
