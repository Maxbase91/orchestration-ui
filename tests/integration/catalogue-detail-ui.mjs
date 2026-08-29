#!/usr/bin/env node
// Static regression checks for the catalogue product-details boundary. The
// browser suite covers rendering; these checks fail fast if either catalogue
// entry point loses its deep link or the shared checkout contract changes.
import { readFileSync } from 'node:fs';

const detail = readFileSync(new URL('../../src/features/catalogue/catalogue-item-detail-page.tsx', import.meta.url), 'utf8');
const checkout = readFileSync(new URL('../../src/features/catalogue/catalogue-order-checkout.tsx', import.meta.url), 'utf8');
const wizard = readFileSync(new URL('../../src/features/requests/new-request/step-catalogue.tsx', import.meta.url), 'utf8');
const commandBar = readFileSync(new URL('../../src/features/dashboard/components/smart-command-bar.tsx', import.meta.url), 'utf8');

let failures = 0;
function check(name, condition) {
  if (condition) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures += 1; console.error(`  \x1b[31m✗\x1b[0m ${name}`); }
}

console.log('Catalogue item detail and governed checkout UI');
check('dedicated item page is exported', /export function CatalogueItemDetailPage/.test(detail));
check('item page resolves the selected route id', /useParams<\{ id: string \}>/.test(detail) && /useCatalogueItem\(id\)/.test(detail));
check('checkout captures fulfilment context', /needBy/.test(checkout) && /deliveryLocation/.test(checkout) && /businessPurpose/.test(checkout) && /costCentre/.test(checkout));
check('expert governance details are progressive', /mode === 'expert'/.test(checkout) && /aria-expanded/.test(checkout));
check('wizard catalogue items deep-link to item details', /navigate\(`\/catalogue\/items\//.test(wizard));
check('home command-bar items deep-link to item details', /navigate\(`\/catalogue\/items\//.test(commandBar));
check('checkout does not claim one-click/no-approval ordering', !/no approval needed/i.test(checkout));

if (failures > 0) process.exitCode = 1;
