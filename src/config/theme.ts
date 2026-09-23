// What a status MEANS, and the one set of badge classes each meaning gets.
//
// This file used to map ~45 statuses straight to Tailwind palette classes
// (`bg-amber-100 text-amber-700`), which had two faults. They were literals, so
// no status badge anywhere followed the theme — in dark mode every one was a
// light chip on a dark row; the colour migration scanned .tsx files and this is
// .ts, so it was missed. And the hues did not mean anything consistent: six
// ordinary lifecycle stages (sourcing through payment) were amber, the warning
// colour, so a request progressing normally looked like one in trouble.
//
// Now each status names a tone, and the tone names tokens. Five tones, chosen
// for what the reader should do: nothing (progress), watch for a decision
// (waiting), nothing ever again (done), act (stopped), or ignore (idle).
export type StatusTone = 'progress' | 'waiting' | 'done' | 'stopped' | 'idle';

export const TONE_CLASS: Record<StatusTone, string> = {
  progress: 'bg-accent-soft text-accent',
  waiting: 'bg-warn-soft text-warn',
  done: 'bg-ok-soft text-ok',
  stopped: 'bg-stop-soft text-stop',
  idle: 'bg-idle-soft text-idle',
};

export const statusTone = {
  // Request lifecycle. Moving through stages is progress, not a warning.
  draft: 'idle',
  intake: 'progress',
  validation: 'progress',
  risk: 'progress',
  onboarding: 'progress',
  sourcing: 'progress',
  contracting: 'progress',
  po: 'progress',
  receipt: 'progress',
  invoice: 'progress',
  payment: 'progress',
  // Approval is the one stage that waits on a named person's decision.
  approval: 'waiting',
  completed: 'done',
  // Cancelled is over, not failing: nobody has anything to do about it.
  cancelled: 'idle',
  'referred-back': 'stopped',
  // Shared across records
  active: 'done',
  expired: 'stopped',
  expiring: 'waiting',
  blocked: 'stopped',
  pending: 'waiting',
  approved: 'done',
  rejected: 'stopped',
  overdue: 'stopped',
  // Sourcing events
  published: 'progress',
  'in-evaluation': 'waiting',
  'award-pending': 'waiting',
  // Contracts
  'under-review': 'progress',
  terminated: 'stopped',
  // Purchase orders
  submitted: 'progress',
  acknowledged: 'progress',
  received: 'done',
  'partially-received': 'waiting',
  closed: 'idle',
  // Invoices
  matched: 'done',
  scheduled: 'progress',
  paid: 'done',
  disputed: 'stopped',
  // Three-way match
  'partial-match': 'waiting',
  unmatched: 'stopped',
  variance: 'waiting',
} as const satisfies Record<string, StatusTone>;

export type StatusKey = keyof typeof statusTone;

/** Badge classes by status — derived, so a status cannot carry a colour its tone does not. */
export const statusColorMap = Object.fromEntries(
  Object.entries(statusTone).map(([status, tone]) => [status, TONE_CLASS[tone]]),
) as Record<StatusKey, string>;
