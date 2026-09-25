// Deep links into intake — parsed once, purely, and testable.
//
// Two URLs open the intake with context already attached, and each carries a
// trap that has cost this codebase a defect:
//
//   ?q=<text>                   the Home box, the assistant and Start renewal.
//                               Must seed the describe step and never ask for
//                               the text a second time.
//   ?catalogueItem=…&quantity=… the return trip from the item detail page. The
//                               fulfilment context the requester just confirmed
//                               must survive; dropping it sent them back to
//                               step 1 with nothing.
//
// A third, `?step=2&category=…&title=…`, carried a second classification of
// the demand — the model's category, supplier and value — past the describe
// step. Its last producer went when the Home box and the assistant took one
// question route (2026-09-25); every demand now arrives as its words.
//
// The parsing lives here, with no React, so those rules can be asserted by
// calling them rather than by mounting a wizard and reading the screen.

import type { IntakeFormData } from './intake-form-data.js';
import type { CatalogueItem } from '../../../data/catalogue-items.js';
import type { Supplier } from '../../../data/types.js';

/**
 * The Door 1 link that starts a contract's renewal.
 *
 * A renewal is a demand like any other since the renewal category and its side
 * process were retired (2026-09-25): the home-box `?q=` seeds the describe
 * step, and the contract check recognises the expiring contract. One builder,
 * because both contract screens offer the action and each had its own dead
 * button — a toast on one, no handler at all on the other.
 */
export function renewalDemandHref(contract: { title: string; supplierName: string }): string {
  return `/requests/new?q=${encodeURIComponent(`Renew ${contract.title} with ${contract.supplierName}`)}`;
}

/** A minimal params reader, so the parsers do not depend on the router. */
export interface DeepLinkParams {
  get(key: string): string | null;
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
      // The route, not a category — see onBrowseCatalogue in new-request-page.
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
