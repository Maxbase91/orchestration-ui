#!/usr/bin/env node
// What a full request must carry before submit — one list, read by the server
// that refuses a submit and by the Details step that gates it.
//
// They disagreed: the server required a need-by date and a cost centre, while
// Details let a requester through without either, the conversation promised
// "you can add it later", and a skipped date had nowhere to be entered. The
// first anyone heard of the rule was a refused submit on the final click.
import { readFileSync } from 'node:fs';
import {
  submissionGaps, describeGaps, isIsoCalendarDate,
} from '../../src/lib/procurement/submission-requirements.ts';
import { stepById, detailsSubmissionGaps } from '../../src/features/requests/new-request/intake-steps.ts';
import { INITIAL_INTAKE_DATA } from '../../src/features/requests/new-request/intake-form-data.ts';
import { initialsOf } from '../../src/lib/format.ts';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
};
const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');

console.log('The rule');
const fields = (gaps) => gaps.map((g) => g.field).join(',');
check('nothing given → title, need-by date, cost centre', fields(submissionGaps({})) === 'title,deliveryDate,costCentre');
check('all given → nothing missing', submissionGaps({ title: 'T', costCentre: 'CC-1', deliveryDate: '2026-12-31' }).length === 0);
check('whitespace is not a cost centre', fields(submissionGaps({ title: 'T', costCentre: '  ', deliveryDate: '2026-12-31' })) === 'costCentre');
check('an impossible date is not a date', !isIsoCalendarDate('2026-02-31') && fields(submissionGaps({ title: 'T', costCentre: 'C', deliveryDate: '2026-02-31' })) === 'deliveryDate');
check('the budget is not required — the server accepts zero', !submissionGaps({}).some((g) => /value|budget/.test(g.field)));
check('described in plain words', describeGaps(submissionGaps({ title: 'T' })) === 'a need-by date and a cost centre');

console.log('\nThe server refuses with the same list');
process.env.NEON_DATABASE_URL ??= 'postgres://unused@localhost/unused';
const { default: handler } = await import('../../api/_domains/intake-submit.ts');
const invoke = async (body) => {
  let status = 200; let json;
  const res = { status(c) { status = c; return res; }, json(v) { json = v; return res; }, setHeader() {} };
  await handler({ method: 'POST', body, headers: {} }, res);
  return { status, json };
};
const refused = await invoke({
  request: { id: 'REQ-T-1', requestorId: 'u1', title: 'Test', category: 'services', value: 1000 },
  buyingChannel: 'procurement-led',
});
check('a submit with no date and no cost centre is refused before anything is written',
  refused.status === 422 && refused.json?.code === 'missing_required_field', JSON.stringify(refused));
check('…naming both',
  refused.json?.error === 'Before submitting, add a need-by date and a cost centre.'
  && refused.json?.fields?.deliveryDate === 'Add a need-by date' && refused.json?.fields?.costCentre === 'Add a cost centre',
  JSON.stringify(refused.json));
const endpoint = read('api/_domains/intake-submit.ts');
check('the endpoint uses the shared list, not its own', /submissionGaps\(/.test(endpoint) && !/A specific need-by date is required/.test(endpoint));

console.log('\nDetails asks for them first');
// A form-path request with a title and a value — the old gate's whole rule.
const formPath = { ...INITIAL_INTAKE_DATA, preCheckOutcome: 'full-request', title: 'Office move', estimatedValue: 5000 };
const gate = (data) => stepById('details').canProceed({
  data, isChatIntakePath: false, conversationCtx: {}, conversationSlots: [], hasDetermination: false,
});
check('title and value alone no longer pass Details', gate(formPath) === false);
check('…with an unparseable date it still does not', gate({ ...formPath, costCentre: 'CC-1', deliveryDate: 'soon' }) === false);
check('…with a date the parser reads and a cost centre, it does', gate({ ...formPath, costCentre: 'CC-1', deliveryDate: '31.12.2026' }) === true);
check('the footer and the gate read the same list',
  fields(detailsSubmissionGaps({ ...formPath, costCentre: 'CC-1' })) === 'deliveryDate');
{
  const ready = { ...formPath, costCentre: 'CC-1', deliveryDate: '2027-01-15', supplierId: 'SUP-X' };
  const withList = (data) => stepById('details').canProceed({
    data, isChatIntakePath: false, conversationCtx: {}, conversationSlots: [], hasDetermination: false, preferredSupplierIds: ['SUP-P'],
  });
  check('…held without a reason', withList(ready) === false);
  check('…open with one', withList({ ...ready, supplierOverrideReason: 'Only certified supplier' }) === true);
  check('…and a preferred supplier owes nothing', withList({ ...ready, supplierId: 'SUP-P' }) === true);
}
check('catalogue and call-off keep their own gates',
  gate({ ...INITIAL_INTAKE_DATA, preCheckOutcome: 'contract', contractId: 'CON-1' }) === true);

console.log('\nThe screens stop promising "later"');
const context = read('src/features/requests/new-request/components/requester-context-block.tsx');
check('Charged to no longer says "you can add it later"', !/you can add it later/.test(context) && /needed before you submit/.test(context));
const chat = read('src/features/requests/new-request/step-chat-intake.tsx');
check('the conversation no longer promises to leave the date open', !/leave the need-by date open/.test(chat));
check('a skipped need-by date can be entered in Key facts', /id="key-facts-need-by"/.test(chat) && /type="date"/.test(chat));
const page = read('src/features/requests/new-request/new-request-page.tsx');
check('the Details footer names what submit will need', /detailsSubmissionGaps\(formData, preferredSupplierIds\)/.test(page) && /under \$\{whereEntered\(gap\.field\)\}/.test(page));

console.log('\nAvatar initials');
for (const [name, want] of [
  ['Category Manager — Robert Fischer or Anna Müller', 'CM'],
  ['Any Budget Owner', 'BO'],
  ['Dr. Katrin Bauer', 'KB'],
  ['Anna Müller', 'AM'],
  ['', '?'],
]) check(`"${name}" → ${want}`, initialsOf(name) === want, initialsOf(name));

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s) failed`); process.exit(1); }
console.log('All submission-requirement checks passed.');
