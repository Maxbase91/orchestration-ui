#!/usr/bin/env node
// The intake assistant may fill request facts. It may not answer governance.
//
// The chat step spreads the model's `extracted` object straight into the
// wizard's form state, and the loop that did it copied EVERY key it was handed.
// A response naming `preCheckOutcome`, `costCentre`, `miniIrq` or
// `commodityClassificationConfirmed` would therefore set it, with nothing in
// the way — the model deciding a buying route, an account to charge, or a risk
// answer that the requester never gave. The system prompt asks it not to; this
// list is what stops it.
//
// This suite exists because the prompt is advisory and the allow-list is not.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXTRACTABLE_FIELDS } from '../../src/features/requests/new-request/extractable-fields.ts';
import { INITIAL_INTAKE_DATA } from '../../src/features/requests/new-request/intake-form-data.ts';

let failures = 0;
const check = (label, fn) => {
  try { fn(); console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (error) { failures++; console.error(`  \x1b[31m✗\x1b[0m ${label} — ${error.message.split('\n')[0]}`); }
};

console.log('\nThe model can only fill request facts');

check('every extractable field is a real field on the intake form', () => {
  const unknown = [...EXTRACTABLE_FIELDS].filter((field) => !(field in INITIAL_INTAKE_DATA));
  assert.deepEqual(unknown, [], `not on IntakeFormData: ${unknown.join(', ')}`);
});

// Naming these individually rather than deriving them: each is a decision the
// platform or the requester owns, and a future edit that adds one to the
// allow-list should have to delete a line here and say why.
const GOVERNANCE_OWNED = [
  'preCheckOutcome',        // which buying route the demand takes
  'miniIrq',                // the residual risk answers
  'costCentre',             // the account the spend is charged to
  'deliveryLocation',       // validated against approved locations at checkout
  'commodityClassificationConfirmed', // the requester confirming the classification
  'supplierId',             // resolved from the directory, never from prose
  'supplierProvenance',     // whether the supplier was named or chosen
  'attachments',
  'requesterCountry',
  'beneficiaryId',
];

for (const field of GOVERNANCE_OWNED) {
  check(`the model cannot set ${field}`, () => {
    assert.ok(!EXTRACTABLE_FIELDS.has(field), 'it is in the allow-list');
  });
}

check('the fields it CAN set are only the demand facts', () => {
  assert.deepEqual([...EXTRACTABLE_FIELDS].sort(),
    ['deliveryDate', 'estimatedValue', 'isUrgent', 'supplier', 'title']);
});

console.log('\nThe allow-list is the one the chat step applies');

// A guard against the list becoming decorative: the module must be the source
// the extraction loop consults, not a second copy that drifts from it.
check('step-chat-intake filters its extraction loop through the shared list', () => {
  const source = readFileSync(
    new URL('../../src/features/requests/new-request/step-chat-intake.tsx', import.meta.url), 'utf8');
  assert.ok(source.includes("from './extractable-fields'"), 'it does not import the list');
  assert.ok(/if \(!EXTRACTABLE_FIELDS\.has\(key\)\) continue;/.test(source),
    'the extraction loop does not skip keys outside the list');
});

console.log(failures === 0
  ? '\nAll assistant extraction-scope checks passed.'
  : `\n${failures} assistant extraction-scope check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
