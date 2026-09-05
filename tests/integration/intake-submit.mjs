#!/usr/bin/env node
// Intake submission regression checks: date normalization stays deterministic
// and the atomic endpoint remains behind the shared Vercel dispatcher.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { parseDeliveryDate } from '../../src/lib/parse-delivery-date.ts';

assert.match(parseDeliveryDate('2026-12-31') ?? '', /^2026-12-31$/);
assert.equal(parseDeliveryDate('the team will deliver a report and training materials'), null);
assert.match(parseDeliveryDate('by December 2026') ?? '', /^2026-12-31$/);
const endpoint = readFileSync('src/server/api/intake-submit.ts', 'utf8');
const dispatcher = readFileSync('api/db.ts', 'utf8');

// A retry of an already-submitted request replays. The client validates the
// response shape, and the replay branch used to omit `stage` — so a retry threw
// 'invalid_response' and the wizard reported an error for a submission that had
// succeeded. Both the server's branches and the client's guard are pinned here.
assert.match(endpoint, /stage: String\(existing\[0\]\.status\)/);
assert.match(endpoint, /replay: true/);
const client = readFileSync('src/lib/procurement/submit-intake.ts', 'utf8');

// Every completed intake enters validation. stageFor voided both its arguments
// and returned that constant, so the branches reading its result — an
// approval_entries insert, three of the four workflow nodes, and a policy query
// per submission — were unreachable while reading as live routing.
assert.match(endpoint, /const INITIAL_STAGE = \{ status: 'validation', stage: 'validation' \} as const;/);
assert.doesNotMatch(endpoint, /function stageFor\(/);
assert.doesNotMatch(endpoint, /stage\.stage === 'approval'/);
assert.doesNotMatch(endpoint, /approvalFullThreshold/);
assert.match(endpoint, /current_node_ids: json\(\['n3'\]\)/);
assert.match(client, /!body\.stage/);
assert.match(endpoint, /sql\.transaction\(queries\)/);
assert.match(endpoint, /invalid_date/);
assert.match(endpoint, /missing_required_field/);
assert.match(endpoint, /approval_entries/);
assert.match(endpoint, /business_justification: null/);
assert.match(endpoint, /information_schema\.columns/);
assert.match(endpoint, /persistedRequestRow/);
assert.match(endpoint, /procurement-led.*validation|validation.*procurement-led/s,
  'procurement-led intake must enter the shared validation gate before sourcing');
assert.match(endpoint, /previously incomplete submission/,
  'safe retries repair legacy orphaned intake rows with no lifecycle evidence');
assert.match(dispatcher, /'intake-submit'/);
console.log('Atomic intake submission and date checks passed.');
