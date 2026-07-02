// ─────────────────────────────────────────────────────────────
// Formatters – Garage Auto Supplies CRM
// ─────────────────────────────────────────────────────────────

import { format } from 'date-fns';
import { formatDistanceToNow } from 'date-fns';

/**
 * Format a number as US currency.
 * e.g. 12500 → "$12,500.00"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a 10-digit phone number as (XXX) XXX-XXXX.
 * Strips non-digit chars; passes through anything that isn't 10-11 digits.
 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  // Handle 11-digit with leading 1
  const normalized = digits.length === 11 && digits.startsWith('1')
    ? digits.slice(1)
    : digits;

  if (normalized.length !== 10) return phone;

  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
}

/**
 * Format a date as "Jan 5, 2025".
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'MMM d, yyyy');
}

/**
 * Format a date with time as "Jan 5, 2025 3:30 PM".
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'MMM d, yyyy h:mm a');
}

/**
 * Human-readable relative time.
 * e.g. "5 minutes ago", "2 hours ago", "3 days ago"
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

/**
 * Extract initials from first + last name.
 * e.g. ("John", "Doe") → "JD"
 */
export function getInitials(firstName: string, lastName: string): string {
  const first = (firstName ?? '').charAt(0).toUpperCase();
  const last = (lastName ?? '').charAt(0).toUpperCase();
  return `${first}${last}`;
}
