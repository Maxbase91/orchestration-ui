// Deep links into intake — parsed once, purely, and testable.
//
// Three URLs can open the intake with context already attached, and each one
// carries a trap that has cost this codebase a defect:
//
//   ?q=<text>                   the home box. Must seed the describe step and
//                               never ask for the text a second time.
//   ?step=2&category=…&title=…  the command bar's legacy link. `category` here
//                               comes from the deterministic classifier, which
//                               can answer `catalogue` — a ROUTE, not a
//                               category. Accepting it verbatim puts the whole
//                               wizard on the catalogue fast track before the
//                               funnel has run, which is exactly the bug
//                               `ROUTE_LIKE_CATEGORY` exists to stop.
//   ?catalogueItem=…&quantity=… the return trip from the item detail page. The
//                               fulfilment context the requester just confirmed
//                               must survive; dropping it sent them back to
//                               step 1 with nothing.
//
// The parsing lives here, with no React, so those rules can be asserted by
// calling them rather than by mounting a wizard and reading the screen.

import { classifyCommodityCategory, ROUTE_LIKE_CATEGORY } from '../../../lib/procurement/classify.js';
import { CATEGORY_LABELS, type IntakeFormData } from './intake-form-data.js';
import type { IntakeStepId } from './intake-steps.js';
import type { CatalogueItem } from '../../../data/catalogue-items.js';
import type { Supplier } from '../../../data/types.js';

/**
 * The command bar still builds `step=2` links, from when the pre-check was
 * step 2. Step numbers are gone; the link's intent — "skip the describe step,
 * they have already told us" — is not, so it is translated rather than broken.
 */
export const LEGACY_STEP_PARAM: Record<string, IntakeStepId> = {
  '1': 'describe',
  '2': 'buy-route',
  '3': 'details',
};

/** A minimal params reader, so the parsers do not depend on the router. */
export interface DeepLinkParams {
  get(key: string): string | null;
}

export interface DemandDeepLink {
  patch: Partial<IntakeFormData>;
  step: IntakeStepId;
}

/**
 * Match a supplier name against the directory.
 *
 * Containment either way, because the link carries what the model extracted
 * ("Accenture") and the directory holds the legal name ("Accenture plc").
 * Returns the DIRECTORY name when matched, so what is displayed and what is
 * stored are the same record.
 */
export function matchSupplierByName(
  name: string,
  suppliers: Supplier[],
): { supplierId: string; supplier: string } {
  if (!name) return { supplierId: '', supplier: '' };
  const needle = name.toLowerCase();
  const matched = suppliers.find(
    (s) => s.name.toLowerCase().includes(needle) || needle.includes(s.name.toLowerCase()),
  );
  return matched
    ? { supplierId: matched.id, supplier: matched.name }
    : { supplierId: '', supplier: name };
}

/**
 * The command bar's demand link.
 *
 * Returns null when the link is not a demand link, so the caller does not have
 * to know the parameter shape.
 */
export function parseDemandDeepLink(
  params: DeepLinkParams,
  suppliers: Supplier[],
): DemandDeepLink | null {
  const step = params.get('step');
  const category = params.get('category');
  if (!step || !category) return null;

  const title = params.get('title') ?? '';
  // A ROUTE is not a category. `catalogue` means "this looks orderable", which
  // the buy-route step decides — so it is re-derived from what is being bought.
  const commodityCategory =
    category === ROUTE_LIKE_CATEGORY ? classifyCommodityCategory(title) : category;
  const { supplierId, supplier } = matchSupplierByName(params.get('supplier') ?? '', suppliers);

  return {
    step: LEGACY_STEP_PARAM[step] ?? 'buy-route',
    patch: {
      category: commodityCategory,
      categoryDescription: CATEGORY_LABELS[commodityCategory] ?? commodityCategory,
      title,
      supplier,
      supplierId,
      estimatedValue: Number(params.get('value') ?? 0) || 0,
      businessJustification: params.get('description') ?? '',
    },
  };
}

/** The fulfilment context confirmed on the item detail page. */
export interface CatalogueOrderLine {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  supplierId: string;
}

export interface CatalogueDeepLink {
  patch: Partial<IntakeFormData>;
  order: {
    title: string;
    estimatedValue: number;
    supplier: string;
    supplierId: string;
    catalogueItems: CatalogueOrderLine[];
  };
}

/**
 * The return trip from a catalogue item's detail page.
 *
 * Returns null when there is no item id, or when the id names an item the
 * catalogue no longer has — an unresolvable link must not half-hydrate a
 * checkout.
 */
export function parseCatalogueDeepLink(
  params: DeepLinkParams,
  catalogueItems: CatalogueItem[],
  suppliers: Supplier[],
): CatalogueDeepLink | null {
  const itemId = params.get('catalogueItem');
  if (!itemId) return null;
  const item = catalogueItems.find((candidate) => candidate.id === itemId);
  if (!item) return null;

  const quantity = Math.max(1, Number(params.get('quantity') ?? '1') || 1);
  const supplier = suppliers.find((candidate) => candidate.id === item.supplierId);
  const estimatedValue = quantity * item.unitPrice;
  const supplierName = supplier?.name ?? item.supplierName;

  return {
    order: {
      title: item.name,
      estimatedValue,
      supplier: supplierName,
      supplierId: item.supplierId,
      catalogueItems: [{
        itemId: item.id, name: item.name, quantity, unitPrice: item.unitPrice, supplierId: item.supplierId,
      }],
    },
    patch: {
      category: 'catalogue',
      categoryDescription: 'Catalogue Purchase',
      preCheckOutcome: 'catalogue',
      buyingChannelResult: 'catalogue',
      title: item.name,
      supplier: supplierName,
      supplierId: item.supplierId,
      estimatedValue,
      deliveryDate: params.get('needBy') ?? '',
      // Deliberately NOT defaulted to 'office'. This becomes `shipToLocationId`,
      // which the governed checkout rejects unless the profile approves it — the
      // two intake pages defaulted it differently, so the same order passed in
      // one and failed in the other.
      deliveryLocation: params.get('deliveryLocation') ?? '',
      costCentre: params.get('costCentre') ?? '',
      beneficiaryName: params.get('recipient') ?? '',
      businessJustification: params.get('purpose') ?? '',
    },
  };
}
