#!/usr/bin/env node
// Intake submission regression checks: date normalization stays deterministic
// and the atomic endpoint remains behind the shared Vercel dispatcher.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { parseDeliveryDate } from '../../src/lib/parse-delivery-date.ts';

assert.match(parseDeliveryDate('2026-12-31') ?? '', /^2026-12-31$/);
assert.equal(parseDeliveryDate('the team will deliver a report and training materials'), null);
assert.match(parseDeliveryDate('by December 2026') ?? '', /^2026-12-31$/);
const endpoint = readFileSync('api/_domains/intake-submit.ts', 'utf8');
const dispatcher = readFileSync('api/db.ts', 'utf8');

// A retry of an already-submitted request replays. The client validates the
// response shape, and the replay branch used to omit `stage` — so a retry threw
// 'invalid_response' and the wizard reported an error for a submission that had
// succeeded. Both the server's branches and the client's guard are pinned here.
assert.match(endpoint, /stage: String\(existing\[0\]\.status\)/);
assert.match(endpoint, /replay: true/);
const client = readFileSync('src/lib/procurement/submit-intake.ts', 'utf8');

// The landing stage comes from the request's channel.
//
// This used to pin the constant `INITIAL_STAGE = validation`, which was the
// right fix at the time: the version before it branched on value and approval
// threshold and left the writes those branches implied unreachable — an
// approval_entries insert, three of four workflow nodes, a policy query per
// submission — while reading as live routing. A constant at least said
// something true.
//
// It stopped being true when `validation` became procurement-led-only
// (2026-09-12): every other channel was written into a stage its own list
// skips. The replacement is still a lookup rather than a decision — it reads
// the same channel→stages map the stepper reads — so the original failure
// cannot come back. What is pinned now is that property, not a literal.
assert.match(endpoint, /firstActionableStage\(buyingChannel, \{ riskAssessmentRequired/);
assert.doesNotMatch(endpoint, /const INITIAL_STAGE = \{ status: 'validation'/);
// The branch that caused the original defect must not return: no threshold or
// value comparison may decide the landing stage.
assert.doesNotMatch(endpoint, /function initialStage[\s\S]{0,400}approvalThreshold/);
assert.doesNotMatch(endpoint, /function stageFor\(/);
assert.doesNotMatch(endpoint, /stage\.stage === 'approval'/);
assert.doesNotMatch(endpoint, /approvalFullThreshold/);
// The instance starts on the node the chosen template actually has for that
// stage. This pinned the literal 'n3', which is Validation in WF-001 but a
// *decision* node in WF-002 — so a request routed to WF-002 was parked
// somewhere the engine cannot resume from, and the Workflow Designer could be
// reshaped without any of it reaching the server.
assert.match(endpoint, /nodeIdForStatus\(templateNodes, stage\.status\)/);
assert.doesNotMatch(endpoint, /current_node_ids: json\(\['n\d+'\]\)/);
// No node id means no instance, rather than one pointing at a node that is not
// there: the engine's fallback can open a correct one later, and a wrong
// pointer is harder to notice than a missing one.
assert.match(endpoint, /if \(startNodeId\) \{/);
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
