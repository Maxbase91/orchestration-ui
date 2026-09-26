// Links into intake, built here so every caller builds them the same way.
//
// Intake reads one link: `?q=<words>` — from the Home box, the assistant and
// Start renewal — which becomes the conversation's first message
// (use-intake-deep-link.ts). Two others are gone: `?step=2&category=…&title=…`
// carried a second classification of the demand past the retired describe
// step, and lost its last
// producer when the Home box and the assistant took one question route; and
// `?catalogueItem=…` was the return trip from an item's page into a one-item
// checkout inside the wizard, retired when catalogue orders moved to the
// Catalogue page's basket (2026-09-25).

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
