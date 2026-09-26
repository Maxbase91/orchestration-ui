// A contract's status from its dates — the rule the contracts view applies in
// SQL (`contracts_with_derived.status_live`, db/schema.sql), here for what the
// screens compute beside it (days to the end, when the renewal window opens)
// and for the suite that holds the two to one answer.
//
// The status column was written once and never moved: 12 of 30 live contracts
// were past their end date while still recorded active or expiring, and the
// register, the supplier counts and the renewals page each trusted it
// (2026-09-26). Stored rows are not rewritten — the date is read every time.
//
// Pure, relative imports only, so a Node suite and api/ can import it.

import type { Contract } from '../../data/types.js';

export type ContractStatus = Contract['status'];

/**
 * Today as the store's dates are written: an ISO calendar date in UTC — what
 * `current_date` is on the database, so the browser and the view agree on
 * which day it is.
 */
export function isoToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function isoDate(value: string | null | undefined): string | null {
  const day = (value ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

/**
 * Calendar days from today to the end date: 0 on its last day, negative once
 * it has ended, null when there is no readable date. Whole days between two
 * calendar dates — a clock time never enters it, which is what made a contract
 * expire at midnight UTC on its last day in the checkout.
 */
export function daysUntilEnd(endDate: string | null | undefined, today: string = isoToday()): number | null {
  const end = isoDate(endDate);
  const from = isoDate(today);
  if (!end || !from) return null;
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * What a contract is today.
 *
 * A contract is in force through its end date: *expired* from the day after,
 * *expiring* while it ends within the renewal window (Decisioning thresholds →
 * `contractExpiryBufferDays`, the same number the intake's contract check
 * treats as "up for renewal"), *active* before that. Only a contract recorded as
 * active or expiring is read from its dates: draft, under review and terminated
 * are decisions a person recorded, and so is an expiry recorded early.
 */
export function contractStatusOn(
  recorded: ContractStatus,
  endDate: string | null | undefined,
  windowDays: number,
  today: string = isoToday(),
): ContractStatus {
  if (recorded !== 'active' && recorded !== 'expiring') return recorded;
  const days = daysUntilEnd(endDate, today);
  if (days === null) return recorded;
  if (days < 0) return 'expired';
  return days <= windowDays ? 'expiring' : 'active';
}
