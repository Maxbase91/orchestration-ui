#!/usr/bin/env node
// The small things that made the wizard feel broken.
//
// Each of these was reported from using the product, and each is small enough
// that it would never have surfaced from reading the code:
//
//   A perfectly good "31.12.2026" was rejected, and the second attempt made the
//   conversation abandon the need-by date entirely. The parser accepted no
//   day-first numeric form at all.
//   Pressing Enter in the chat scrolled the whole page.
//   Moving between steps landed the requester mid-page.
//   A submitted request was still headed "Start a request".
//   Contract candidates sat at "awaiting confirmation" that nothing could clear.
//   A contract that expired in May 2025 was presented as an "Active contract".
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDeliveryDate } from '../../src/lib/parse-delivery-date.ts';

let failures = 0;
const check = (label, fn) => {
  try { fn(); console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (error) { failures++; console.error(`  \x1b[31m✗\x1b[0m ${label} — ${error.message.split('\n')[0]}`); }
};
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const read = (path) => stripComments(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));

console.log('\nThe dates a requester actually types');

// Both of the reported attempts, verbatim.
check('31.12.2026 parses', () => assert.equal(parseDeliveryDate('31.12.2026'), '2026-12-31'));
check('"end. of 2026" parses despite the stray full stop', () =>
  assert.equal(parseDeliveryDate('end. of 2026'), '2026-12-31'));

for (const [input, expected] of [
  ['31/12/2026', '2026-12-31'],
  ['31-12-2026', '2026-12-31'],
  ['31.12.26', '2026-12-31'],
  ['2026-12-31', '2026-12-31'],
  ['end of 2026', '2026-12-31'],
  ['2026', '2026-12-31'],
]) {
  check(`${input} parses`, () => assert.equal(parseDeliveryDate(input), expected));
}
check('a bare quarter parses', () => assert.match(parseDeliveryDate('Q4') ?? '', /^\d{4}-12-31$/));
check('day-first is assumed, not month-first', () =>
  assert.equal(parseDeliveryDate('3.4.2026'), '2026-04-03', '3 April, not 4 March'));

console.log('\nAnd the ones that are not dates');

for (const input of ['31.02.2026', '32.12.2026', '13/13/2026', 'nonsense', '']) {
  check(`${input || '(empty)'} is refused`, () => assert.equal(parseDeliveryDate(input), null));
}
check('31.02 is refused rather than rolled into March', () => {
  // new Date(2026, 1, 31) silently becomes 3 March, so the parts have to be
  // read back to tell a real date from a rolled one.
  assert.equal(parseDeliveryDate('31.02.2026'), null);
});

console.log('\nThe page stays where the requester put it');

const chat = read('src/features/requests/new-request/step-chat-intake.tsx');
check('the chat scrolls its own container, not the window', () => {
  assert.match(chat, /scrollIntoView\(\{[^}]*block: 'nearest'/,
    "scrollIntoView without `block` scrolls every ancestor including the window");
});

const page = read('src/features/requests/new-request/new-request-page.tsx');
check('a step change starts at the top', () => {
  assert.match(page, /window\.scrollTo\(\{ top: 0/, 'nothing resets scroll between steps');
});

console.log('\nThe screen says where the requester is');

check('a submitted request is not headed "Start a request"', () => {
  assert.match(page, /stepId === 'confirmation' \? 'Request submitted'/);
});
check('the standing "nothing after this asks you for anything" strip is gone', () => {
  assert.doesNotMatch(read('src/features/requests/new-request/intake-steps.ts'),
    /Nothing after this asks you for anything/);
});
check('a step with nothing to say about what follows says nothing', () => {
  assert.match(read('src/features/requests/new-request/components/step-header-panel.tsx'),
    /\(nextOverride \?\? guidance\.next\) &&/, 'an absent next still renders an empty line');
});

console.log('\nA contract candidate can be chosen');

const route = read('src/features/requests/new-request/step-buy-route.tsx');
check('adding the detail the matcher asked for makes a contract selectable', () => {
  assert.match(route, /canCallOff = contractMatches\.length > 0[\s\S]{0,240}detailAdded/,
    'a clarify verdict is still terminal, so the row can never be clicked');
});

console.log('\nAn expired contract is not an active one');

// Both now live in the determination's contract check — the one the Channel
// page and the export read. The intake screen's "smart assessment" that held
// them re-derived coverage beside it and was retired with the Review step.
const coverage = read('src/lib/procurement/second-contract-check.ts');
check('coverage checks the end date, not only the status column', () => {
  assert.match(coverage, /c\.endDate && c\.endDate < input\.now/, 'a contract past its end date still reads as active');
});
check('an expired contract is named rather than reported as none', () => {
  assert.match(coverage, /No contract in date — \$\{lapsed\[0\]\.title\} ended/,
    'the requester knows a contract exists and would read "no contract" as a miss');
});

console.log('\nAn unset cost centre says when it is needed');

// This pinned "you can add it later", which was untrue: submit refuses a
// request without a cost centre (submission-requirements.ts). It now says the
// true thing — still not "Not set on your profile", which reads as a failure.
check('it says it is needed before submit', () => {
  const block = read('src/features/requests/new-request/components/requester-context-block.tsx');
  assert.match(block, /needed before you submit/, 'the requester would first hear of it on the final click');
  assert.doesNotMatch(block, /you can add it later|Not set on your profile/);
});

if (failures > 0) { console.error(`\nintake-quick-fixes: ${failures} check(s) failed.`); process.exit(1); }
console.log('\nIntake quick-fix checks passed.');
