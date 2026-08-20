/**
 * @file formatters.ts — Reusable data formatting utilities for AlbionOS
 *
 * Provides standardized formatting functions for currency, dates, numbers,
 * and text strings across the application.
 */

/**
 * Formats a numeric value into Nigerian Naira (₦) currency format.
 *
 * @param amount - Number to format
 * @param includeSymbol - Whether to include the '₦' symbol (default: true)
 * @returns Formatted currency string, e.g. "₦1,250,000.00"
 */
export function formatCurrency(amount: number | null | undefined, includeSymbol: boolean = true): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return includeSymbol ? '₦0.00' : '0.00';
  }

  const formatted = new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return includeSymbol ? `₦${formatted}` : formatted;
}

/**
 * Formats an ISO date string into a human-readable date.
 *
 * @param isoDate - ISO date string (e.g. "2026-07-09T14:30:00Z")
 * @param locale - BCP 47 locale tag (default: 'en-GB')
 * @returns Formatted date string, e.g. "09 Jul 2026"
 */
export function formatDate(isoDate: string | null | undefined, locale: string = 'en-GB'): string {
  if (!isoDate) return 'N/A';
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return 'N/A';
  }
}

/**
 * Capitalizes the first letter of each word in a string.
 */
export function capitalize(str: string | null | undefined): string {
  if (!str) return '';
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}
