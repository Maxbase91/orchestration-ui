// Can this order actually leave the platform?
//
// A downstream purchasing system expects a cXML OrderRequest, and every line in
// one requires quantity, a line ordinal, a supplier part number, a unit price,
// a description and a unit of measure, with a classification code where the
// buyer configures it. A catalogue order used to carry description, quantity,
// price and currency and none of the rest — so it would have been rejected at
// the boundary, and the first anyone knew of it was there.
//
// This says so on the order instead. Pure, so the rule is testable and the same
// answer is available wherever it is needed.

export interface OrderLineFacts {
  lineNumber?: number | null;
  description?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  supplierPartId?: string | null;
  unitOfMeasureCode?: string | null;
  commodityCode?: string | null;
}

export interface OrderHeaderFacts {
  currency?: string | null;
  supplierId?: string | null;
  costCentre?: string | null;
  shipToLocationId?: string | null;
}

export interface OrderReadinessGap {
  /** Null for a header-level gap. */
  line: number | null;
  field: string;
  detail: string;
}

export interface OrderReadiness {
  ready: boolean;
  gaps: OrderReadinessGap[];
}

/**
 * What is missing before this order could be handed off.
 *
 * Classification is reported separately from the mandatory fields because a
 * buyer can configure whether it is required; it is listed as a gap so nobody
 * discovers it downstream, but it is named for what it is.
 */
export function orderReadiness(header: OrderHeaderFacts, lines: OrderLineFacts[]): OrderReadiness {
  const gaps: OrderReadinessGap[] = [];

  if (!header.currency) gaps.push({ line: null, field: 'currency', detail: 'An order has no currency.' });
  if (!header.supplierId) gaps.push({ line: null, field: 'supplier', detail: 'No supplier to send the order to.' });
  if (!header.costCentre) gaps.push({ line: null, field: 'cost centre', detail: 'Nothing to charge the spend against.' });
  if (!header.shipToLocationId) gaps.push({ line: null, field: 'ship-to', detail: 'No delivery location.' });

  if (lines.length === 0) {
    gaps.push({ line: null, field: 'lines', detail: 'An order with no lines cannot be sent.' });
  }

  lines.forEach((line, index) => {
    const at = line.lineNumber ?? index + 1;
    const require = (value: unknown, field: string, detail: string) => {
      if (value === null || value === undefined || value === '') gaps.push({ line: at, field, detail });
    };
    require(line.lineNumber, 'line number', 'Each line needs an ordinal, and an id is not one.');
    require(line.description, 'description', 'Nothing describes what is being bought.');
    require(line.supplierPartId, 'supplier part number', "The supplier cannot tell which of their products this is.");
    require(line.unitOfMeasureCode, 'unit of measure', 'A display word such as "bag" is not a unit code.');
    require(line.commodityCode, 'commodity code', 'The line cannot be classified for reporting or tax.');
    if (line.quantity == null || Number(line.quantity) <= 0) {
      gaps.push({ line: at, field: 'quantity', detail: 'A line must order a positive quantity.' });
    }
    if (line.unitPrice == null || Number(line.unitPrice) < 0) {
      gaps.push({ line: at, field: 'unit price', detail: 'A line needs a price, even if it is zero.' });
    }
  });

  return { ready: gaps.length === 0, gaps };
}

/** One line the user can read, for a screen that does not list every gap. */
export function readinessSummary(readiness: OrderReadiness): string {
  if (readiness.ready) return 'Ready to hand off.';
  const fields = [...new Set(readiness.gaps.map((gap) => gap.field))];
  return fields.length === 1
    ? `Not ready — ${fields[0]} is missing.`
    : `Not ready — ${fields.length} things missing: ${fields.join(', ')}.`;
}
