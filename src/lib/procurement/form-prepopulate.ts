// What a form field can be pre-filled from, drawn off the request.
//
// The mechanism already existed and was half-wired: `FormField.prePopulateFrom`
// is in the type, the Form Builder offers a dropdown of tokens, `DynamicForm`
// resolves them, and eight seeded fields already name tokens like `costCentre`,
// `value` and `supplierName`. But the only producer was sowPrePopulateValues,
// so every request-derived token resolved to nothing — an admin picked
// "Cost Centre" from a list and the field came up empty.
//
// Sibling of sowPrePopulateValues in service-description-seed.ts, and pure for
// the same reason: it can be tested without a database, and both producers
// merge into one context.
import type { ProcurementRequest } from '../../data/types.js';

/**
 * The tokens a form may pre-fill from.
 *
 * An allowlist rather than "whatever is on the request", following
 * extractable-fields.ts. Governance-determined values — the screening outcome,
 * the inherent risk tier, the approval chain — are conclusions the platform
 * reached, and seeding them into a field a requester can edit invites a form
 * that contradicts the record it came from.
 */
export const PREPOPULATE_TOKENS = [
  'title', 'description', 'category', 'commodityCode', 'commodityCodeLabel',
  'value', 'currency', 'costCentre', 'budgetOwner', 'businessJustification',
  'deliveryDate', 'buyingChannel', 'supplierName', 'poId', 'contractId',
  'requestId', 'beneficiaryName', 'sraStatus',
] as const;

export type PrepopulateToken = typeof PREPOPULATE_TOKENS[number];

/** Names the caller resolved, since the request carries ids rather than labels. */
export interface PrepopulateNames {
  supplierName?: string;
  /**
   * The supplier's SRA status. On the supplier record, not the request — which
   * is why the `sraStatus` token the Form Builder has always offered resolved
   * to nothing.
   */
  sraStatus?: string;
}

/**
 * Build the request half of a form's pre-populate context.
 *
 * Values are projected field by field, never spread or cast: `ProcurementRequest`
 * carries numbers, booleans and arrays, and `sectionValuesOf` exists in the
 * sibling module precisely because casting a mixed record to
 * `Record<string, string>` threw on the first `.trim()`.
 *
 * An empty value is omitted rather than written as `''` — `resolveDefault`
 * treats a present-but-empty entry as a pre-fill, so writing one would replace
 * a field's own `defaultValue` with nothing.
 */
export function requestPrePopulateValues(
  request: Partial<ProcurementRequest> | null | undefined,
  names: PrepopulateNames = {},
): Record<string, string> {
  if (!request) return {};
  const out: Record<string, string> = {};
  const put = (token: PrepopulateToken, value: unknown) => {
    if (value === null || value === undefined) return;
    const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
    if (text) out[token] = text;
  };

  put('requestId', request.id);
  put('title', request.title);
  put('description', request.description);
  put('category', request.category);
  put('commodityCode', request.commodityCode);
  put('commodityCodeLabel', request.commodityCodeLabel);
  put('value', request.value);
  put('currency', request.currency);
  put('costCentre', request.costCentre);
  put('budgetOwner', request.budgetOwner);
  put('businessJustification', request.businessJustification);
  put('deliveryDate', request.deliveryDate);
  put('buyingChannel', request.buyingChannel);
  put('poId', request.poId);
  put('contractId', request.contractId);
  put('beneficiaryName', request.beneficiaryName);
  // Both come off the supplier the request points at, resolved by the caller.
  put('supplierName', names.supplierName);
  put('sraStatus', names.sraStatus);

  return out;
}
