// What a full request must carry before it can be submitted — one list, read by
// the server that refuses the submit and by the Details step that gates it.
//
// They used to disagree. The server required a need-by date and a cost centre;
// the Details step let a requester through without either, the conversation
// said "we will leave the need-by date open and you can add it later", and the
// requester context read "Charged to: not set yet — you can add it later". The
// first anyone heard of the rule was a refused submit on the final click.
//
// Pure and dependency-free, so `api/_domains/intake-submit.ts` imports it too.

export type SubmissionField = 'title' | 'costCentre' | 'deliveryDate' | 'supplierOverrideReason';

export interface SubmissionGap {
  field: SubmissionField;
  /** How the requester would name it, to finish "Still needed: …". */
  label: string;
}

export interface SubmissionInput {
  title?: string | null;
  costCentre?: string | null;
  /** The need-by date, already parsed to YYYY-MM-DD — `null` when it could not be. */
  deliveryDate?: string | null;
  /** The chosen supplier is outside the category's preferred list (isPreferredSupplierOverride). */
  supplierOverride?: boolean;
  supplierOverrideReason?: string | null;
}

/** A real calendar date in YYYY-MM-DD form. */
export function isIsoCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const blank = (value: string | null | undefined): boolean => !value || value.trim().length === 0;

/**
 * Everything still missing, in the order the Details step asks for it. The
 * estimated value is deliberately not here: a requester may not know the budget
 * yet, and the server accepts zero.
 */
export function submissionGaps(input: SubmissionInput): SubmissionGap[] {
  const gaps: SubmissionGap[] = [];
  if (blank(input.title)) gaps.push({ field: 'title', label: 'a title' });
  if (!isIsoCalendarDate(input.deliveryDate)) gaps.push({ field: 'deliveryDate', label: 'a need-by date' });
  if (blank(input.costCentre)) gaps.push({ field: 'costCentre', label: 'a cost centre' });
  if (input.supplierOverride && blank(input.supplierOverrideReason)) {
    gaps.push({ field: 'supplierOverrideReason', label: 'why this supplier rather than a preferred one' });
  }
  return gaps;
}

/** "a need-by date and a cost centre" — for the footer and the server's refusal. */
export function describeGaps(gaps: SubmissionGap[]): string {
  const labels = gaps.map((g) => g.label);
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}
