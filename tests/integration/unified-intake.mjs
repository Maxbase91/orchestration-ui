#!/usr/bin/env node
// Regression coverage for the unified requester intake primitives.

import { resolveCommodityCandidates } from '../../src/lib/procurement/commodity-candidates.ts';
import { codeBookFromCategories } from '../../src/lib/procurement/category-code.ts';
import { DEFAULT_CATEGORY_TAXONOMY } from '../../src/data/category-taxonomy.ts';
import { seedServiceDescriptionFromText } from '../../src/lib/procurement/intake-seed.ts';
import { existsSync, readFileSync } from 'node:fs';
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
// The describe and buy-route steps are the conversation page since 2026-09-26.
const conversation = readFileSync('src/features/requests/new-request/conversation/intake-conversation.tsx', 'utf8');
const routeChecks = readFileSync('src/features/requests/new-request/conversation/use-route-checks.ts', 'utf8');
const callOffAgenda = readFileSync('src/features/requests/new-request/conversation/call-off-agenda.ts', 'utf8');
const panelSources = ['your-request-panel.tsx', 'request-rows.ts', 'turns.tsx']
  .map((f) => readFileSync(`src/features/requests/new-request/conversation/${f}`, 'utf8')).join('\n');
const lifecycleStepper = readFileSync('src/features/requests/request-detail/components/lifecycle-stepper.tsx', 'utf8');
check('long pasted brief seeds objective and scope', Boolean(seeded.objective && seeded.scope));
check('deliverables remain a distinct section', Boolean(seeded.deliverables));
check('exclusions are distinct from scope in the intake model', /exclusions/.test(readFileSync('src/features/requests/new-request/new-request-page.tsx', 'utf8')) && /id: 'exclusions'/.test(readFileSync('src/lib/procurement/service-description-defaults.ts', 'utf8')));
check('scope prompt does not combine Included and Excluded questions', !readFileSync('src/lib/procurement/demand-conversation.ts', 'utf8').includes('in scope — and anything explicitly out of scope'));
check('document context carries into the adaptive chat', readFileSync('src/features/requests/new-request/conversation/use-service-description-conversation.ts', 'utf8').includes('data.serviceDescription ?? {}'));
check('requester-facing intake does not render a business justification field', !/Business Justification/i.test(conversation + panelSources));
check('upload API boundary exists', readFileSync('api/_domains/intake-upload.ts', 'utf8').includes('PDF'));
// The "helpful guidance from similar requests" card is gone, along with its
// endpoint. It was not similar to anything — the query ignored the category,
// the typed text and the commodity code, and returned the eight most recently
// updated descriptions — and its redaction rewrote every leading capitalised
// word to "the supplier", so each suggestion opened with it. It also re-queried
// the database on every keystroke.
check('no similar-requests guidance card remains', !existsSync(new URL('../../src/features/requests/new-request/components/intake-guidance-card.tsx', import.meta.url)));
check('no intake-guidance endpoint remains', !existsSync(new URL('../../api/_domains/intake-guidance.ts', import.meta.url)));
// The home box already asked what they need; asking again was friction that
// also used to discard the text. The words are the conversation's first
// message, classified on arrival — once, not again after "Start over".
check('a home demand is the conversation\u2019s first message',
  intakePage.includes('prefill={conversationKey === 0 ? prefill : undefined}') && conversation.includes('void classify(props.prefill.trim())'));
check('a new request is an explicit outcome, never an inherited one',
  conversation.includes("updateFormData({ preCheckOutcome: 'full-request' })") && conversation.includes("preCheckOutcome: 'full-request', contractId: ''"));
// The call-off's value is its own — the contract's ceiling is shown beside it,
// never taken for it.
check('a call-off is asked its own value, with the contract ceiling shown apart',
  /What is this call-off worth\?/.test(callOffAgenda) && /ceiling left/.test(conversation));
// There is no disabled Next to explain: the conversation asks, and says what
// submit would still refuse before it confirms the channel.
check('what is still missing is named in the conversation, not behind a disabled button',
  /the request needs \{list\(gaps\.map/.test(conversation) && !/Still needed:|disabled=\{!canProceed/.test(intakePage));
// The stepper is what actually draws the distinction; the deleted Simple
// detail page only restated it in prose.
check('call-off lifecycle distinguishes compliance validation from budget approval',
  lifecycleStepper.includes('Contract & compliance check') && lifecycleStepper.includes('Budget approval'));
const intakeForm = readFileSync('src/features/requests/new-request/intake-form-data.ts', 'utf8');
check('the demand text is the title and the lifted detail, each counted once',
  routeChecks.includes("[input?.title ?? '', input?.demandDetail ?? '']") && routeChecks.includes('text: demandText'));
// Clicking "Use this detail" looked ignored: the text was appended behind the
// screen while the box kept its contents, so the decision then read it twice.
// A detail is now a message: it lands in the transcript, and the re-check says
// what it changed.
check('an answered detail lands, and the re-check says what it found',
  conversation.includes('With that detail:') && conversation.includes('setAsking(null)'));
// Appending to `title` renamed the request: "buy business consulting — IT
// strategy consulting to define a new org structure — IT strategy consulting…"
// became what the request was called everywhere afterwards.
check('added detail has its own field and never renames the request',
  intakeForm.includes('demandDetail: string')
  && !/title: formData\.title \? `\$\{formData\.title\} — \$\{text\}`/.test(conversation)
  && conversation.includes('demandDetail: formData.demandDetail ?'));
// Four contracts behind disabled "Confirm details first" buttons is not a
// choice, it is furniture — the requester cannot act on any of them. The card
// appears once the contract can be called off; until then, the one detail
// that would settle it is asked.
check('a contract is offered only once it can be acted on',
  conversation.includes('contract && checks.canCallOff') && conversation.includes("setAsking('detail')"));
// ADR-0004: the matcher asks up to three clarifying questions rather than
// guessing. Asking its question beats a generic prompt.
check('the matcher\'s own question is the one asked',
  routeChecks.includes('serverMatch.questions[0]') && conversation.includes('checks.clarifyingQuestion ??'));
// A ROUTE, never a category. Keying the journey off `category === 'catalogue'`
// is what let a classifier answering "catalogue" for a paper-and-toner demand
// put the whole wizard on the fast track before the funnel had run. The page
// has no catalogue route at all — a catalogue order is placed on the
// Catalogue page (ADR-0009) — and tells a call-off from a new request by the
// outcome the conversation recorded.
check('the route is the recorded outcome, never the category',
  intakePage.includes("const isCallOff = formData.preCheckOutcome === 'contract';") && !/category === 'catalogue'/.test(intakePage + conversation));


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
  // A stored request's category is typed `as RequestCategory`; a form write is
  // not. (The one such site, the wizard's own catalogue order, is gone with the
  // wizard's catalogue route.)
  const dirs = ['', 'conversation/', 'channel/'].map((sub) => new URL(`../../src/features/requests/new-request/${sub}`, import.meta.url));
  const writers = dirs.flatMap((dir) => readdirSync(dir)
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => [f, new URL(f, dir)]))
    .flatMap(([f, url]) => readFileSync(url, 'utf8').split('\n')
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
