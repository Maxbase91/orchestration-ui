#!/usr/bin/env node
// The conversation page's pure parts (Intake Prototype, phase 4).
//
//   - classify-demand.ts: what the requester described, classified — moved out
//     of the Describe step with its rules (a `catalogue` category is a route,
//     not a commodity; an unknown category falls back to the keywords, never to
//     a literal 'goods');
//   - call-off-agenda.ts: a call-off's details, asked one at a time, prefilled
//     from what is already known, with the form's rules (dates and amounts
//     parsed, the direct call-off limit held at the value, choices by button);
//   - request-rows.ts: the "Your request" panel — provenance, inputs-only
//     editing (Q5) and "N of M known" counting what the route needs (Q6).
//
// Run: npm run test:intake-conversation
import { classifyDemand, acceptClassification } from '../../src/features/requests/new-request/conversation/classify-demand.ts';
import {
  callOffQuestions, prefillCallOff, nextCallOffQuestion, applyCallOffAnswer, callOffProgress, callOffMissing,
} from '../../src/features/requests/new-request/conversation/call-off-agenda.ts';
import { requestRows } from '../../src/features/requests/new-request/conversation/request-rows.ts';
import { INITIAL_INTAKE_DATA } from '../../src/features/requests/new-request/intake-form-data.ts';
import { DEFAULT_CATEGORY_TAXONOMY } from '../../src/data/category-taxonomy.ts';
import { EMPTY_CODE_BOOK } from '../../src/lib/procurement/category-code.ts';

let failures = 0;
function check(name, condition, detail = '') {
  if (condition) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures += 1; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

// No network in this suite: the commodity-candidate endpoint is unreachable, so
// the configured book answers, as it does when the endpoint is down.
globalThis.fetch = async () => { throw new Error('offline'); };
const deps = { aiEnabled: false, categories: DEFAULT_CATEGORY_TAXONOMY, suppliers: [{ id: 'SUP-L', name: 'Lenovo' }], codeBook: EMPTY_CODE_BOOK };

console.log('What the requester described, classified');
{
  const consulting = await classifyDemand('We need business consulting for a finance transformation programme', deps);
  check('the configured keywords classify it when AI-001 is off', consulting?.category === 'consulting' && consulting.source === 'rules', JSON.stringify(consulting));
  const paper = await classifyDemand('printer paper and toner for the office', deps);
  check('a catalogue-like demand keeps the intent but gets a real category',
    paper?.intent === 'catalogue' && paper.category !== 'catalogue', JSON.stringify(paper));
  const lenovo = await classifyDemand('laptops from Lenovo for the new starters', deps);
  const accepted = acceptClassification(lenovo, { kind: 'none' }, 'laptops from Lenovo for the new starters', { categoryLabel: (id) => `Label ${id}`, suppliers: deps.suppliers });
  check('a supplier named in the words is carried as a suggestion, not a choice',
    accepted.supplierId === 'SUP-L' && accepted.supplierProvenance === 'named');
  check('"none of these" keeps the category and leaves the code to be confirmed',
    accepted.commodityCode === '' && accepted.commodityClassificationConfirmed === true && accepted.categoryDescription === `Label ${lenovo.category}`);
  check('an empty description classifies as nothing', (await classifyDemand('   ', deps)) === null);
}

console.log('\nA call-off, asked as a conversation');
{
  const services = callOffQuestions('Consulting');
  const goods = callOffQuestions('IT Equipment');
  check('a service is asked when it starts and ends; goods, when they are needed',
    services.some((q) => q.field === 'serviceEndDate') && services.find((q) => q.field === 'needBy')?.label === 'Start'
    && !goods.some((q) => q.field === 'serviceEndDate') && goods.find((q) => q.field === 'needBy')?.label === 'Need by');
  const draft = prefillCallOff({ title: 'Finance transformation consulting', value: 180000, needBy: '2027-01-11', costCentre: 'CC-1', deliveryLocation: 'office' }, 'Consulting');
  check('what is known is prefilled, never invented',
    draft.title === 'Finance transformation consulting' && draft.value === 180000 && draft.costCentre === 'CC-1'
    && draft.serviceStartDate === '2027-01-11' && draft.purpose === '' && draft.recipient === '');
  const first = nextCallOffQuestion(services, draft);
  check('the first question is the first thing still missing — the end of the work', first?.field === 'serviceEndDate', first?.field);
  const open = applyCallOffAnswer(first, 'not known yet', draft, { directCallOffLimit: 250000 });
  check('an optional date answered "not known" is left open, and not asked again',
    open.ok && open.passed === 'serviceEndDate' && nextCallOffQuestion(services, open.draft, new Set([open.passed]))?.field === 'recipient');
  const early = applyCallOffAnswer(first, '2026-12-01', draft, { directCallOffLimit: 250000 });
  check('an end before the start is refused', !early.ok && /on or after the start/.test(early.retry));
  const prose = applyCallOffAnswer(services.find((q) => q.field === 'needBy'), 'sometime soon', draft, { directCallOffLimit: 250000 });
  check('a date that does not parse is asked again with an example', !prose.ok && /for example/.test(prose.retry));
  const value = services.find((q) => q.field === 'value');
  const over = applyCallOffAnswer(value, '€300,000', draft, { directCallOffLimit: 250000 });
  check('above the direct call-off limit it says a mini-competition is needed, at the value', !over.ok && /mini-competition/.test(over.retry));
  const bare = applyCallOffAnswer(value, '20000', draft, { directCallOffLimit: 250000 });
  check('a bare amount is read', bare.ok && bare.draft.value === 20000);
  const typedChoice = applyCallOffAnswer(services.find((q) => q.field === 'costCentre'), 'CC-2', draft, { directCallOffLimit: 250000 });
  check('a choice between configured rows is never parsed from prose', !typedChoice.ok);
  check('"N of M" counts the required details', JSON.stringify(callOffProgress(services, draft)) === JSON.stringify({ known: 5, required: 7 }), JSON.stringify(callOffProgress(services, draft)));
  check('what is missing is named', callOffMissing(services, draft).join(',') === 'for,business purpose');
}

console.log('\nYour request');
const base = {
  route: 'new-request',
  channel: { value: 'New request · Procurement-Led Sourcing', source: 'Routing · consulting is procurement-led', settled: false },
  form: {
    ...INITIAL_INTAKE_DATA, title: 'Finance transformation consulting', category: 'consulting', categoryDescription: 'Management consulting',
    commodityCode: '80101600', commodityCodeLabel: 'Management advisory', commodityClassificationConfirmed: true,
    estimatedValue: 180000, costCentre: 'CC-FIN', requesterCountry: 'Ireland',
  },
  requester: { name: 'James O\'Brien' },
  profileCostCentre: 'CC-FIN',
  costCentreLabel: (id) => ({ 'CC-FIN': 'Finance Transformation' })[id],
  deliveryLocationLabel: () => undefined,
  edited: new Set(),
  leftOpen: new Set(),
  sections: [
    { id: 'objective', label: 'Objective', required: true, text: 'Cut the close to four days.' },
    { id: 'scope', label: 'Scope', required: true, text: '' , asking: true },
    { id: 'exclusions', label: 'Exclusions', required: false, text: '' },
    { id: 'resources', label: 'Resources', required: true, text: 'Two consultants.', capture: 'assistant-drafted' },
  ],
  supplierAnswered: false,
  sources: true,
  preferredSupplierNames: ['Preferred A', 'Preferred B'],
  riskAnswers: [{ key: 'privilegedAccess', label: 'System access', answer: undefined }],
};
{
  const { groups, known, required } = requestRows(base);
  const rows = Object.fromEntries(groups.flatMap((g) => g.rows).map((r) => [r.key, r]));
  check('the groups are the artboard\'s', groups.map((g) => g.title.split(' ·')[0]).join(' / ') === 'Channel / Who and where / What / Supplier / Service description');
  check('inputs are edited in place', ['title', 'estimatedValue', 'deliveryDate', 'costCentre', 'beneficiary', 'supplier', 'section:scope'].every((k) => rows[k]?.edit));
  check('what the platform decides is not — it changes through the conversation',
    ['channel', 'category', 'preferred', 'requesterCountry', 'risk:privilegedAccess'].every((k) => rows[k] && !rows[k].edit));
  check('the profile\'s cost centre says so', rows.costCentre.source === 'Your profile' && rows.costCentre.value === 'CC-FIN · Finance Transformation');
  check('a drafted section says to check it', rows['section:resources'].provenance === 'draft' && /check it/.test(rows['section:resources'].source));
  check('the section being asked says so', rows['section:scope'].value === 'Asking now' && rows['section:scope'].provenance === 'pending');
  check('the preferred suppliers are invited when the channel sources', /Invited to sourcing/.test(rows.preferred.source));
  check('the service description counts its required sections', groups[4].title === 'Service description · required 2 of 3');
  // Required: channel, cost centre, title, category, value, need-by, risk, supplier, 3 sections = 11;
  // in: cost centre, title, category, value, objective, resources = 6.
  check('"N of M" counts what the route needs', required === 11 && known === 6, `${known} of ${required}`);
  const done = requestRows({
    ...base,
    channel: { ...base.channel, settled: true },
    form: { ...base.form, deliveryDate: '2027-01-11' },
    supplierAnswered: true,
    sections: base.sections.map((s) => ({ ...s, text: s.text || 'Written.', asking: false })),
    riskAnswers: [{ key: 'privilegedAccess', label: 'System access', answer: true }],
  });
  check('everything in: M of M', done.known === done.required, `${done.known} of ${done.required}`);
  const open = requestRows({ ...base, form: { ...base.form, estimatedValue: 0 }, leftOpen: new Set(['value']) });
  check('a budget left open is not counted as missing', !Object.fromEntries(open.groups.flatMap((g) => g.rows).map((r) => [r.key, r])).estimatedValue.required);
  const edited = requestRows({ ...base, edited: new Set(['title']) });
  check('an edit says so', edited.groups[2].rows[0].source === 'Edited by you');
}
{
  const draft = prefillCallOff({ title: 'Laptops', value: 20000, costCentre: 'CC-FIN', deliveryLocation: 'office' }, 'IT Equipment');
  const questions = callOffQuestions('IT Equipment');
  const { groups, known, required } = requestRows({
    ...base, route: 'call-off', sections: undefined, riskAnswers: undefined,
    channel: { value: 'Call-off · IT Equipment Framework', source: 'Proposed · you accept in the conversation', settled: true },
    callOff: { questions, draft, contractTitle: 'IT Equipment Framework', supplierName: 'Lenovo' },
    deliveryLocationLabel: (id) => ({ office: 'Head office' })[id],
  });
  const rows = Object.fromEntries(groups.flatMap((g) => g.rows).map((r) => [r.key, r]));
  check('a call-off shows its own details, the contract\'s supplier and where it goes',
    groups.map((g) => g.title).join(' / ') === 'Channel / Who and where / The call-off / Supplier'
    && rows.supplier.source === 'From the contract' && !rows.supplier.edit && rows.deliveryLocation.value === 'Head office');
  // Required: channel, cost centre, deliver to, what, value, need by, for, purpose = 8; missing need by, for, purpose.
  check('a call-off\'s "N of M" is its details', required === 8 && known === 5, `${known} of ${required}`);
}

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exit(1); }
console.log('All intake-conversation checks passed.');
