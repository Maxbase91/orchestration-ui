#!/usr/bin/env node
// Door 2 — every catalogue order is placed on the Catalogue page.
//
// Catalogue items could be ordered three ways: a one-item checkout on an item's
// page that ran through the intake wizard, a catalogue step inside the wizard,
// and a basket inside the Home box. Since 2026-09-25 there is one: the basket on
// the Catalogue page (ADR-0009), and every other entry point adds to it. These
// checks fail fast if a second way in grows back; the browser half is
// test:requester-entry-ui.
import { existsSync, readFileSync } from 'node:fs';

const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const page = read('src/features/catalogue/catalogue-page.tsx');
const detail = read('src/features/catalogue/catalogue-item-detail-page.tsx');
const commandBar = read('src/features/dashboard/components/smart-command-bar.tsx');
const requestEntry = read('src/features/requests/new-request/new-request-page.tsx')
  + read('src/features/requests/new-request/conversation/intake-conversation.tsx');
const routeTurns = read('src/lib/assistant/route-turns.ts');
const app = read('src/App.tsx');

let failures = 0;
function check(name, condition) {
  if (condition) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures += 1; console.error(`  \x1b[31m✗\x1b[0m ${name}`); }
}

console.log('The Catalogue page places the order');
check('the page is routed at /catalogue', /path="\/catalogue" element=\{<CataloguePage \/>\}/.test(app));
check('its catalogues are the ones the items belong to, not a list in code',
  /item\.catalogueId/.test(page) && !/CATALOGUE_CATEGORIES|'it-equipment'|'office-supplies'/.test(page));
check('the basket is planned and placed through the governed basket checkout',
  /planBasket\(/.test(page) && /basketPayloads\(/.test(page) && /submitGovernedBasket\(/.test(page));
check('deliver to and charged to come from the reference data, the profile first',
  /useDeliveryLocations\(\)/.test(page) && /useCostCentres\(\)/.test(page) && /profile\?\.defaultShipToLocationId/.test(page) && /profile\?\.costCentre/.test(page));
check('the purpose the checkout requires is asked for', /What is it for\?/.test(page));
check('the note says what the decision says, not a threshold comparison alone',
  /decision\.approvalRequired/.test(page) && /decision\.riskReviewRequired/.test(page));
check('a retry reuses its ids and key', /attempt\.current/.test(page) && /requestIds: attempt\.current\.requestIds/.test(page));

console.log('\nEvery way in adds to the basket');
check('the Home box', /go\(`\/catalogue\?add=\$\{encodeURIComponent\(item\.id\)\}`\)/.test(commandBar));
check('the assistant', /\/catalogue\?add=\$\{encodeURIComponent\(item\.id\)\}/.test(routeTurns));
check('an item\'s page', /navigate\(`\/catalogue\?add=\$\{encodeURIComponent\(item\.id\)\}`\)/.test(detail));
// The conversation offers a catalogue item when the check finds one, and
// "Order it" adds that item. It has no "browse the catalogue" button of its
// own: the catalogue is Home's second door and the navigation's Catalogue.
check('intake\'s catalogue match', /navigate\(`\/catalogue\?add=\$\{encodeURIComponent\(item\.id\)\}`\)/.test(requestEntry));

console.log('\nNo second way to order');
check('the wizard has no catalogue step or checkout of its own',
  !/StepCatalogue|CatalogueOrderCheckout|submitCatalogueOrder/.test(requestEntry)
  && !existsSync(new URL('../../src/features/requests/new-request/step-catalogue.tsx', import.meta.url))
  && !existsSync(new URL('../../src/features/catalogue/catalogue-order-checkout.tsx', import.meta.url)));
check('an item\'s page places no order itself', !/submitGovernedCheckout|catalogueItem:/.test(detail));
check('the Home box orders nothing itself — no basket, no direct write',
  !/createRequest|createPurchaseOrder|addToCart|Review order/.test(commandBar));

if (failures > 0) { console.error(`\nFAILED: ${failures} check(s)`); process.exitCode = 1; }
else console.log('\nAll catalogue UI checks passed.');
