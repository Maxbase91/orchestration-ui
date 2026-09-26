// What a new request still lacks for submit to accept it — the server's own
// list (submission-requirements.ts), checked as the server will see it, so the
// conversation asks for it rather than the submit refusing it.
//
// It lived in intake-steps.ts beside the wizard's step gates; the steps are
// gone (2026-09-26) and this is the part the conversation still needs.
import { submissionGaps, type SubmissionGap } from '../../../lib/procurement/submission-requirements.js';
import { parseDeliveryDate } from '../../../lib/parse-delivery-date.js';
import { isPreferredSupplierOverride } from '../../../lib/procurement/supplier-preference.js';
import type { IntakeFormData } from './intake-form-data.js';

/**
 * The need-by date is parsed first: "end of next month" is only a date once it
 * parses, and the server refuses prose in a date column.
 */
export function intakeSubmissionGaps(
  data: IntakeFormData,
  preferredSupplierIds: readonly string[] = [],
): SubmissionGap[] {
  return submissionGaps({
    title: data.title,
    costCentre: data.costCentre,
    deliveryDate: parseDeliveryDate(data.deliveryDate),
    supplierOverride: isPreferredSupplierOverride(data.supplierId, preferredSupplierIds),
    supplierOverrideReason: data.supplierOverrideReason,
  });
}
