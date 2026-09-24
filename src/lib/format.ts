// Shared display formatters (currency, date, relative time, number) so every
// screen renders the same locale/precision instead of ad-hoc Intl calls.
import { formatDistanceToNow, format, parseISO } from 'date-fns';

const currencyFormatter = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('en-IE');

export function formatCurrency(value: number, currency = 'EUR'): string {
  // Non-EUR currencies build a formatter per call rather than caching one per
  // code — callers pass other currencies rarely enough that this is cheap.
  if (currency !== 'EUR') {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  }
  return currencyFormatter.format(value);
}

export function formatDate(date: string | Date | null | undefined): string {
  // Missing/invalid dates render as an em dash rather than throwing or
  // showing "Invalid Date" — callers pass optional fields (e.g. delivery date).
  if (!date || date === '') return '—';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (isNaN(d.getTime())) return '—';
  return format(d, 'dd MMM yyyy');
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/**
 * At most two initials for an avatar. A role-open approver reads "Category
 * Manager — Robert Fischer or Anna Müller"; taking a letter from every word
 * rendered "CM—RFoAM" across a 32px circle. It is named by its role — the part
 * before the dash — and "Any" is a qualifier, not a name, as is a title such as
 * "Dr." (a word ending in a full stop).
 */
export function initialsOf(name: string, fallback = '?'): string {
  const head = name.split(/\s+[—–-]\s+/)[0] ?? '';
  const words = head.split(/\s+/).filter((w) => /^\p{L}/u.test(w) && !w.endsWith('.') && w.toLowerCase() !== 'any');
  return words.map((w) => w[0]).join('').slice(0, 2).toUpperCase() || fallback;
}
