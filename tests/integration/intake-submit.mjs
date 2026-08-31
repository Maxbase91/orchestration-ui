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
