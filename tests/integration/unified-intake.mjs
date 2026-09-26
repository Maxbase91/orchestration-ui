#!/usr/bin/env node
// Regression coverage for the unified requester intake primitives.

import { resolveCommodityCandidates } from '../../src/lib/procurement/commodity-candidates.ts';
import { codeBookFromCategories } from '../../src/lib/procurement/category-code.ts';
import { DEFAULT_CATEGORY_TAXONOMY } from '../../src/data/category-taxonomy.ts';
import { seedServiceDescriptionFromText } from '../../src/lib/procurement/intake-seed.ts';
import { existsSync, readFileSync } from 'node:fs';
import {
  progressStepsForRoute,
  routeFromOutcome,
} from '../../src/features/requests/new-request/intake-steps.ts';
import {
  renewalDemandHref,
} from '../../src/features/requests/new-request/intake-deep-link.ts';

let failures = 0;
function check(name, condition) { if (condition) console.log(`  \x1b[32m✓\x1b[0m ${name}`); else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}`); } }

const codeBook = codeBookFromCategories(DEFAULT_CATEGORY_TAXONOMY);
const candidates = resolveCommodityCandidates('Buy laptop computers and workstation equipment for the new team', 'goods', codeBook);
check('specific commodity candidates are returned', candidates.length > 0 && candidates[0].code === '43211500');
check('candidate list follows high-confidence cap', candidates.length <= 3);
check('low-confidence classification shows one fallback', resolveCommodityCandidates('something unknown', 'goods', codeBook).length === 1);

const seeded = seedServiceDescriptionFromText('We need a new customer analytics platform for the sales team. The work should include implementation, data migration and training. Deliverables include a configured platform and handover report.');
const intakePage = readFileSync('src/features/requests/new-request/new-request-page.tsx', 'utf8');
const buyRoutePage = readFileSync('src/features/requests/new-request/step-buy-route.tsx', 'utf8');
const lifecycleStepper = readFileSync('src/features/requests/request-detail/components/lifecycle-stepper.tsx', 'utf8');
check('long pasted brief seeds objective and scope', Boolean(seeded.objective && seeded.scope));
check('deliverables remain a distinct section', Boolean(seeded.deliverables));
check('exclusions are distinct from scope in the intake model', /exclusions/.test(readFileSync('src/features/requests/new-request/new-request-page.tsx', 'utf8')) && /id: 'exclusions'/.test(readFileSync('src/lib/procurement/service-description-defaults.ts', 'utf8')));
check('scope prompt does not combine Included and Excluded questions', !readFileSync('src/lib/procurement/demand-conversation.ts', 'utf8').includes('in scope — and anything explicitly out of scope'));
check('document context carries into the adaptive chat', readFileSync('src/features/requests/new-request/conversation/use-service-description-conversation.ts', 'utf8').includes('data.serviceDescription ?? {}'));
check('requester-facing intake does not render a business justification field', !/label.*Business Justification/.test(readFileSync('src/features/requests/new-request/step-chat-intake.tsx', 'utf8')));
check('upload API boundary exists', readFileSync('api/_domains/intake-upload.ts', 'utf8').includes('PDF'));
// The "helpful guidance from similar requests" card is gone, along with its
// endpoint. It was not similar to anything — the query ignored the category,
// the typed text and the commodity code, and returned the eight most recently
// updated descriptions — and its redaction rewrote every leading capitalised
// word to "the supplier", so each suggestion opened with it. It also re-queried
// the database on every keystroke.
check('no similar-requests guidance card remains', !existsSync(new URL('../../src/features/requests/new-request/components/intake-guidance-card.tsx', import.meta.url)));
check('no intake-guidance endpoint remains', !existsSync(new URL('../../api/_domains/intake-guidance.ts', import.meta.url)));
// The home box already asked what they need; asking again on the describe step
// was friction that also used to discard the text. The classification runs on
// the prefill and advances on its own.
check('a home demand seeds the describe step and advances itself',
  intakePage.includes('prefill={categoryPrefill}') && intakePage.includes("onAutoAdvance={() => setStepId('buy-route')}"));
check('the full-request escape sets an explicit outcome, never an inherited one',
  intakePage.includes("updateFormData({ preCheckOutcome: 'full-request' })"));
check('contract call-off details explain per-call value and timing',
  intakePage.includes('Contract call-off') && intakePage.includes('contract ceiling is not'));
// The form path's own footer ("To review this request, add …") went with the
// form (2026-09-25); the conversation names its slots and the submission gaps.
check('a disabled Next names what is still missing',
  intakePage.includes('Still needed:') && /gapsToName\.map\(/.test(intakePage));
// The stepper is what actually draws the distinction; the deleted Simple
// detail page only restated it in prose.
check('call-off lifecycle distinguishes compliance validation from budget approval',
  lifecycleStepper.includes('Contract & compliance check') && lifecycleStepper.includes('Budget approval'));
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
  && progressStepsForRoute(routeFromOutcome('full-request')).some((step) => step.id === 'channel'));
// The wizard has no catalogue route any more: a catalogue order is placed on
// the Catalogue page (ADR-0009). A call-off reaches the Channel page like a
// full request, with its governed decision in place of a determination.
check('an unset outcome is a full request, and a call-off also ends on the Channel page',
  routeFromOutcome('') === 'full-request'
  && progressStepsForRoute('contract').some((step) => step.id === 'channel'));


// ── Deep links carry context in; each one has cost a defect ─────────────────
//
// These were two effects inside the intake page, guarded by flags and sixty
// lines apart. Pulling the parsing out means the rules can be asserted by
// calling them rather than by mounting a wizard and reading the screen.

const params = (obj) => ({ get: (key) => (key in obj ? String(obj[key]) : null) });

// No intake module writes the ROUTE into the form's category. The catalogue
// shortcut and the catalogue deep link both did, and category outlives a change
// of route: switching to a full request then reached a Details step that
// matched no branch and rendered nothing. The route lives in preCheckOutcome.
{
  const { readdirSync, readFileSync } = await import('node:fs');
  const dir = new URL('../../src/features/requests/new-request/', import.meta.url);
  // A stored request's category is typed `as RequestCategory`; a form write is
  // not. (The one such site, the wizard's own catalogue order, is gone with the
  // wizard's catalogue route.)
  const writers = readdirSync(dir)
    .filter((f) => /\.tsx?$/.test(f))
    .flatMap((f) => readFileSync(new URL(f, dir), 'utf8').split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\{\/\*)/.test(line))
      .filter((line) => /category:\s*'catalogue'/.test(line) && !/as RequestCategory/.test(line))
      .map((line) => `${f}: ${line.trim()}`));
  check(`no intake module stores the catalogue route as a form category${writers.length ? ` — ${writers.join(' | ')}` : ''}`,
    writers.length === 0);
}

const directory = [
  { id: 'SUP-1', name: 'Accenture plc', supplierName: 'Accenture plc' },
  { id: 'SUP-2', name: 'Sodexo', supplierName: 'Sodexo' },
];

// The `?step=2&category=…` link is gone: it carried a second classification
// past the describe step (a ROUTE could arrive as a category), and its last
// producer went when the Home box and the assistant took one question route.
check('intake parses no demand link beyond the words',
  !/parseDemandDeepLink|LEGACY_STEP_PARAM/.test(readFileSync('src/features/requests/new-request/intake-deep-link.ts', 'utf8')));
// The label shown back to the requester is the configured one.
check('no category label map remains in the intake form data',
  !/CATEGORY_LABELS/.test(readFileSync('src/features/requests/new-request/intake-form-data.ts', 'utf8')));

// A renewal comes in through Door 1 (2026-09-25). Both contract screens had a
// renewal button that started nothing — a toast on one, no handler on the other.
{
  const href = renewalDemandHref({ title: 'Cloud hosting & co', supplierName: 'Acme GmbH' });
  const url = new URL(href, 'http://x');
  check('Start renewal opens Door 1 with the renewal written as the demand',
    url.pathname === '/requests/new' && url.searchParams.get('q') === 'Renew Cloud hosting & co with Acme GmbH');
  const renewals = readFileSync('src/features/contracts/renewals-page.tsx', 'utf8');
  const detail = readFileSync('src/features/contracts/contract-detail-page.tsx', 'utf8');
  check('both contract screens start a renewal through Door 1, and neither only toasts',
    /navigate\(renewalDemandHref\(/.test(renewals) && /navigate\(renewalDemandHref\(/.test(detail)
    && !/Renewal initiated for/.test(renewals.replace(/\/\/.*$/gm, '')));
}

// The `?catalogueItem=…` return trip is gone with the one-item checkout it fed:
// an item's page adds to the basket on the Catalogue page instead.
{
  const { readFileSync } = await import('node:fs');
  check('intake reads no catalogue link',
    !/catalogueItem/.test(readFileSync('src/features/requests/new-request/use-intake-deep-link.ts', 'utf8').replace(/\/\/.*$/gm, '')));
}

if (failures) process.exit(1);
console.log('Unified intake checks passed.');
