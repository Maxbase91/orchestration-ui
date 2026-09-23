// The request list's filters, as a URL contract — parsed here, built here.
//
// Four places link into /requests with a filter: the dashboard's attention band,
// its Requests-by-Stage widget, and the assistant's "Overdue Requests" link. The
// list read none of them, so each opened an unfiltered list of everything, and
// the band's "2 requests are past the stage SLA" landed on 140 rows. They did
// not even agree on spelling — `overdue=1` in the band, `overdue=true` in the
// assistant. Every link now builds its URL with `requestListHref` and the list
// reads it with `parseRequestListFilters`, so there is one spelling.
//
// The two personal views reuse personal-queue.ts rather than restating it: the
// count on the band and the rows behind its link are the same function, so they
// cannot disagree.
//
// Relative `.js` imports, so node can load this in a test without the `@/` alias.
import type { ProcurementRequest, RequestStatus } from '../../data/types.js';
import { overdueOnMyPlate, referredBackToMe } from './personal-queue.js';

/**
 * Every status, as a value. A Record keyed by the union rather than an array:
 * add a status to `RequestStatus` and this stops compiling until it is listed,
 * so a new stage cannot be silently unfilterable.
 */
const STATUS_SET: Record<RequestStatus, true> = {
  draft: true, intake: true, validation: true, approval: true, risk: true,
  onboarding: true, sourcing: true, contracting: true, po: true, receipt: true,
  invoice: true, payment: true, completed: true, cancelled: true, 'referred-back': true,
};
export const REQUEST_STATUSES = Object.keys(STATUS_SET) as RequestStatus[];

/** The personal views — what the attention band links to. */
export type RequestListView = 'my-overdue' | 'sent-back-to-me';
const VIEWS: Record<RequestListView, true> = { 'my-overdue': true, 'sent-back-to-me': true };

export interface RequestListFilters {
  /** Every request in this stage — the Requests-by-Stage widget. */
  status?: RequestStatus;
  /** Every request past its stage SLA, whoever holds it. */
  overdue?: boolean;
  /** One person's slice, defined in personal-queue.ts. */
  view?: RequestListView;
}

export interface ParsedRequestListFilters extends RequestListFilters {
  /**
   * Parameters present but not understood. Reported, not dropped: a list that
   * silently ignores `status=aproval` shows every request under a heading the
   * reader believes is filtered.
   */
  ignored: string[];
}

export function parseRequestListFilters(params: URLSearchParams): ParsedRequestListFilters {
  const out: ParsedRequestListFilters = { ignored: [] };
  const status = params.get('status');
  if (status !== null) {
    if (status in STATUS_SET) out.status = status as RequestStatus;
    else out.ignored.push(`status=${status}`);
  }
  const overdue = params.get('overdue');
  if (overdue !== null) {
    if (overdue === '1') out.overdue = true;
    else out.ignored.push(`overdue=${overdue}`);
  }
  const view = params.get('view');
  if (view !== null) {
    if (view in VIEWS) out.view = view as RequestListView;
    else out.ignored.push(`view=${view}`);
  }
  return out;
}

export function requestListHref(filters: RequestListFilters, base = '/requests'): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.overdue) params.set('overdue', '1');
  if (filters.view) params.set('view', filters.view);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

/** Filters combine with AND: `view=my-overdue&status=sourcing` is mine, late, in sourcing. */
export function applyRequestListFilters(
  requests: ProcurementRequest[],
  filters: RequestListFilters,
  userId: string,
): ProcurementRequest[] {
  let rows = requests;
  if (filters.view === 'my-overdue') rows = overdueOnMyPlate(rows, userId);
  if (filters.view === 'sent-back-to-me') rows = referredBackToMe(rows, userId);
  if (filters.status) rows = rows.filter((r) => r.status === filters.status);
  if (filters.overdue) rows = rows.filter((r) => r.isOverdue);
  return rows;
}

export function hasRequestListFilters(filters: RequestListFilters): boolean {
  return Boolean(filters.status || filters.overdue || filters.view);
}
