#!/usr/bin/env node
// Regression coverage for the unified requester intake primitives.

import { resolveCommodityCandidates } from '../../src/lib/procurement/commodity-candidates.ts';
import { seedServiceDescriptionFromText } from '../../src/lib/procurement/intake-seed.ts';
import { existsSync, readFileSync } from 'node:fs';
import {
  progressStepsForRoute,
  routeFromOutcome,
} from '../../src/features/requests/new-request/intake-steps.ts';
import {
  LEGACY_STEP_PARAM,
  matchSupplierByName,
  parseCatalogueDeepLink,
  parseDemandDeepLink,
} from '../../src/features/requests/new-request/intake-deep-link.ts';

let failures = 0;
function check(name, condition) { if (condition) console.log(`  \x1b[32m✓\x1b[0m ${name}`); else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}`); } }

const candidates = resolveCommodityCandidates('Buy laptop computers and workstation equipment for the new team', 'goods');
check('specific commodity candidates are returned', candidates.length > 0 && candidates[0].code === '43211500');
check('candidate list follows high-confidence cap', candidates.length <= 3);
check('low-confidence classification shows one fallback', resolveCommodityCandidates('something unknown', 'goods').length === 1);

const seeded = seedServiceDescriptionFromText('We need a new customer analytics platform for the sales team. The work should include implementation, data migration and training. Deliverables include a configured platform and handover report.');
const intakePage = readFileSync('src/features/requests/new-request/new-request-page.tsx', 'utf8');
const buyRoutePage = readFileSync('src/features/requests/new-request/step-buy-route.tsx', 'utf8');
const simpleDetailPage = readFileSync('src/features/requests/request-detail/simple-request-detail-page.tsx', 'utf8');
const lifecycleStepper = readFileSync('src/features/requests/request-detail/components/lifecycle-stepper.tsx', 'utf8');
check('long pasted brief seeds objective and scope', Boolean(seeded.objective && seeded.scope));
check('deliverables remain a distinct section', Boolean(seeded.deliverables));
check('exclusions are distinct from scope in the intake model', /exclusions/.test(readFileSync('src/features/requests/new-request/new-request-page.tsx', 'utf8')) && /id: 'exclusions'/.test(readFileSync('src/lib/procurement/service-description-defaults.ts', 'utf8')));
check('scope prompt does not combine Included and Excluded questions', !readFileSync('src/lib/procurement/demand-conversation.ts', 'utf8').includes('in scope — and anything explicitly out of scope'));
check('document context carries into the adaptive chat', readFileSync('src/features/requests/new-request/step-chat-intake.tsx', 'utf8').includes('data.serviceDescription ?? {}'));
check('requester-facing intake does not render a business justification field', !/label.*Business Justification/.test(readFileSync('src/features/requests/new-request/step-chat-intake.tsx', 'utf8')));
check('upload API boundary exists', readFileSync('src/server/api/intake-upload.ts', 'utf8').includes('PDF'));
// The "helpful guidance from similar requests" card is gone, along with its
// endpoint. It was not similar to anything — the query ignored the category,
// the typed text and the commodity code, and returned the eight most recently
// updated descriptions — and its redaction rewrote every leading capitalised
// word to "the supplier", so each suggestion opened with it. It also re-queried
// the database on every keystroke.
check('no similar-requests guidance card remains', !existsSync(new URL('../../src/features/requests/new-request/components/intake-guidance-card.tsx', import.meta.url)));
check('no intake-guidance endpoint remains', !existsSync(new URL('../../src/server/api/intake-guidance.ts', import.meta.url)));
// The home box already asked what they need; asking again on the describe step
// was friction that also used to discard the text. The classification runs on
// the prefill and advances on its own.
check('a home demand seeds the describe step and advances itself',
  intakePage.includes('prefill={categoryPrefill}') && intakePage.includes("onAutoAdvance={() => setStepId('buy-route')}"));
check('the full-request escape sets an explicit outcome, never an inherited one',
  intakePage.includes("updateFormData({ preCheckOutcome: 'full-request' })"));
check('contract call-off details explain per-call value and timing',
  intakePage.includes('Contract call-off') && intakePage.includes('contract ceiling is not'));
check('a disabled Next names what is still missing, on every path',
  intakePage.includes('missingDetailFields') && intakePage.includes('To review this request, add')
  && intakePage.includes('Still needed:'));
check('call-off lifecycle distinguishes compliance validation from budget approval', simpleDetailPage.includes('contract, supplier, risk') && lifecycleStepper.includes('Contract & compliance check') && lifecycleStepper.includes('Budget approval'));
const intakeForm = readFileSync('src/features/requests/new-request/intake-form-data.ts', 'utf8');
check('the demand text is title + lifted detail + the draft being typed, each counted once',
  buyRoutePage.includes('[title, demandDetail, enrich]') && buyRoutePage.includes('text: demandText'));
// Clicking "Use this detail" looked ignored: the text was appended behind the
// screen while the box kept its contents, so the decision then read it twice.
check('using a detail clears the draft and confirms it landed',
  buyRoutePage.includes('setEnrich(\'\')') && buyRoutePage.includes('setDetailAdded(true)')
  && buyRoutePage.includes('the options above have been re-checked'));
// Appending to `title` renamed the request: "buy business consulting — IT
// strategy consulting to define a new org structure — IT strategy consulting…"
// became what the request was called everywhere afterwards.
check('added detail has its own field and never renames the request',
  intakeForm.includes('demandDetail: string')
  && !/title: formData\.title \? `\$\{formData\.title\} — \$\{text\}`/.test(intakePage)
  && intakePage.includes('demandDetail: formData.demandDetail'));
// Four contracts behind disabled "Confirm details first" buttons is not a
// choice, it is furniture — the requester cannot act on any of them.
check('contract candidates appear only once they can be acted on',
  buyRoutePage.includes('showContractCandidates')
  && buyRoutePage.includes('canCallOff || detailAdded'));
// ADR-0004: the matcher asks up to three clarifying questions rather than
// guessing. Asking its question beats a generic prompt.
check('the matcher\'s own question is what the detail box asks',
  buyRoutePage.includes('clarifyingQuestion') && buyRoutePage.includes('serverMatch.questions[0]'));
// A ROUTE, never a category. Keying the journey off `category === 'catalogue'`
// is what let a classifier answering "catalogue" for a paper-and-toner demand
// put the whole wizard on the fast track before the funnel had run. Asserted by
// calling the resolver rather than by grepping for the expression that happens
// to implement it.
check('expert full-request escape cannot be forced back into catalogue steps',
  routeFromOutcome('full-request') === 'full-request'
  && progressStepsForRoute(routeFromOutcome('full-request')).some((step) => step.id === 'review'));
check('only an explicit catalogue outcome takes the fast track',
  routeFromOutcome('catalogue') === 'catalogue'
  && routeFromOutcome('') === 'full-request'
  && !progressStepsForRoute('catalogue').some((step) => step.id === 'review'));


// ── Deep links carry context in; each one has cost a defect ─────────────────
//
// These were two effects inside the intake page, guarded by flags and sixty
// lines apart. Pulling the parsing out means the rules can be asserted by
// calling them rather than by mounting a wizard and reading the screen.

const params = (obj) => ({ get: (key) => (key in obj ? String(obj[key]) : null) });

const directory = [
  { id: 'SUP-1', name: 'Accenture plc', supplierName: 'Accenture plc' },
  { id: 'SUP-2', name: 'Sodexo', supplierName: 'Sodexo' },
];

// A ROUTE is not a category. The command bar builds this link from the
// deterministic classifier, which can answer `catalogue` for a paper-and-toner
// demand — accepting it verbatim put the whole wizard on the fast track before
// the funnel had run.
const routeShaped = parseDemandDeepLink(
  params({ step: '2', category: 'catalogue', title: 'a few reams of printer paper and toner' }),
  directory,
);
check('a route-shaped category is re-derived from what is being bought',
  routeShaped.patch.category !== 'catalogue' && routeShaped.patch.category.length > 0);
check('a real category is taken as given',
  parseDemandDeepLink(params({ step: '2', category: 'consulting', title: 'strategy work' }), directory)
    .patch.category === 'consulting');
// Step numbers are gone; the link's intent is not.
check('the legacy step number maps to the step that replaced it',
  LEGACY_STEP_PARAM['2'] === 'buy-route'
  && parseDemandDeepLink(params({ step: '2', category: 'goods', title: 'x' }), directory).step === 'buy-route');
check('a link that is not a demand link parses to nothing',
  parseDemandDeepLink(params({ q: 'buy laptops' }), directory) === null);

// The link carries what the model extracted; the directory holds the legal
// name. Matching resolves to the DIRECTORY record, so what is shown and what is
// stored are the same supplier.
check('a partial supplier name resolves to the directory record',
  matchSupplierByName('Accenture', directory).supplierId === 'SUP-1'
  && matchSupplierByName('Accenture', directory).supplier === 'Accenture plc');
check('an unknown supplier is kept as typed, not silently dropped',
  matchSupplierByName('Nobody Ltd', directory).supplierId === ''
  && matchSupplierByName('Nobody Ltd', directory).supplier === 'Nobody Ltd');

const catalogue = [
  { id: 'IT-001', name: 'ThinkPad T14', unitPrice: 1299, unit: 'each', supplierId: 'SUP-1', supplierName: 'Acme' },
];
const hydrated = parseCatalogueDeepLink(
  params({ catalogueItem: 'IT-001', quantity: '3', needBy: '2026-12-01', costCentre: 'CC-9' }),
  catalogue, directory,
);
check('the confirmed fulfilment context survives the return trip',
  hydrated.order.catalogueItems[0].quantity === 3
  && hydrated.order.estimatedValue === 3897
  && hydrated.patch.costCentre === 'CC-9'
  && hydrated.patch.preCheckOutcome === 'catalogue');
// This becomes `shipToLocationId`, which the governed checkout rejects unless
// the profile approves it. The two intake pages defaulted it differently, so
// the same order passed in one and failed in the other.
check('the delivery location is never defaulted behind the requester',
  hydrated.patch.deliveryLocation === '');
check('an unresolvable item does not half-hydrate a checkout',
  parseCatalogueDeepLink(params({ catalogueItem: 'GONE-1' }), catalogue, directory) === null);
check('a quantity of zero or nonsense falls back to one, never to zero value',
  parseCatalogueDeepLink(params({ catalogueItem: 'IT-001', quantity: '0' }), catalogue, directory)
    .order.catalogueItems[0].quantity === 1);

if (failures) process.exit(1);
console.log('Unified intake checks passed.');
