// Business-day arithmetic for SLA deadlines.
//
// Extracted from transition.ts so the serverless writers can use it too:
// transition.ts imports the browser database client, which api/ cannot resolve
// at runtime. This module imports nothing.
//
// An SLA of "3 days" means three working days — a request that enters a stage
// on Friday is not late on Monday.

/** `from` plus `days` working days, skipping Saturday and Sunday. */
export function addBusinessDays(from: Date, days: number): Date {
  const out = new Date(from.getTime());
  let remaining = Math.max(0, Math.floor(days));
  while (remaining > 0) {
    out.setDate(out.getDate() + 1);
    const day = out.getDay();
    if (day !== 0 && day !== 6) remaining--;
  }
  return out;
}

/**
 * The SLA deadline for a stage that opens at `enteredAt`, or null when the
 * template node sets no SLA.
 *
 * The one place this is computed. It used to live only in transition.ts, so a
 * request got a deadline on its first stage *change* and never at creation —
 * 130 of 136 requests in the live store had none, which meant no countdown and
 * no way to be overdue.
 */
export function slaDeadlineFor(enteredAt: Date, slaDays: number | null | undefined): string | null {
  return slaDays != null ? addBusinessDays(enteredAt, slaDays).toISOString() : null;
}

/**
 * A deadline as epoch milliseconds, or null when there is not one.
 *
 * Accepts a Date as well as a string because the Neon driver returns
 * `timestamptz` as a Date, not an ISO string. A `typeof === 'string'` guard on
 * `sla_deadline` silently reported every request as on-time — the column's SQL
 * type does not tell you the JavaScript type you get back.
 */
export function deadlineMs(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' && value.length > 0) {
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

/** Whole days past the deadline, or null when it is not passed (or absent). */
export function daysPastDeadline(value: unknown, now: Date = new Date()): number | null {
  const ms = deadlineMs(value);
  if (ms === null || ms > now.getTime()) return null;
  return Math.floor((now.getTime() - ms) / 86_400_000);
}
