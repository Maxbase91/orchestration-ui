#!/usr/bin/env node
// The health screen reports what happened, not what would be reassuring.
//
// `/admin/health` showed four green "Connected" cards, 99.97% uptime, a 0.02%
// error rate and 47 active sessions. Every figure was a literal in the page
// file, and two of the cards were contradicted by the store as they rendered:
// SAP Ariba had a handover in `timeout` and Coupa Risk one in `error`. An admin
// opening this page to find out whether anything was wrong was told, in green,
// that nothing was.
//
// There is no uptime to report. R1 has no live upstream connections at all, so
// "connected" is not a fact the platform holds — and neither is an error rate
// or a session count. `system_integrations` is what it holds.
// Run: npm run test:integration-health

import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { loadEnv } from '../lib/live.mjs';
import {
  systemHealth, failedHandovers, humaniseMinutes,
} from '../../src/lib/procurement/integration-health.ts';

const ROOT = new URL('../../', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, ROOT), 'utf8');
let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
};

const SYSTEMS = [
  { system: 'ariba', label: 'SAP Ariba' },
  { system: 'sap', label: 'SAP S/4HANA' },
  { system: 'quiet', label: 'Never Used' },
];
const rec = (system, status, submittedAt, respondedAt) => ({
  id: `${system}-${status}-${submittedAt}`, requestId: 'REQ-1', system,
  systemLabel: system, status, submittedAt, respondedAt, stage: 'sourcing', detail: 'x',
});

console.log('A failing system does not read as healthy');
const records = [
  rec('ariba', 'completed', '2026-09-01T09:00:00Z', '2026-09-01T10:00:00Z'),
  rec('ariba', 'completed', '2026-09-02T09:00:00Z', '2026-09-02T10:00:00Z'),
  rec('ariba', 'timeout', '2026-09-03T09:00:00Z'),
  rec('sap', 'completed', '2026-09-04T09:00:00Z', '2026-09-04T09:30:00Z'),
];
const health = systemHealth(records, SYSTEMS);
const byId = Object.fromEntries(health.map((h) => [h.system, h]));

// The load-bearing one: two completions and one timeout is NOT healthy. The old
// page averaged exactly this into a green card.
check('one failure among successes reads as failing', byId.ariba.state === 'failing',
  `${byId.ariba.completed} completed, ${byId.ariba.failed} failed → ${byId.ariba.state}`);
check('the failure is counted, not absorbed', byId.ariba.failed === 1);
check('a system with only completions is healthy', byId.sap.state === 'healthy');

// A system nobody has handed anything to is UNUSED, which is a different
// statement from healthy — and it still gets a card. A card that vanishes when
// a system goes quiet makes an outage look like a clean dashboard.
check('an unused system is reported as unused, not healthy', byId.quiet.state === 'unused');
check('an unused system still appears', health.length === SYSTEMS.length);
check('an unused system has no invented response time', byId.quiet.meanResponseMinutes === null);

console.log('\nWaiting is its own state');
const waiting = systemHealth([
  rec('ariba', 'completed', '2026-09-01T09:00:00Z', '2026-09-01T10:00:00Z'),
  rec('ariba', 'awaiting-response', '2026-09-05T09:00:00Z'),
], SYSTEMS);
check('an open handover reads as waiting', waiting[0].state === 'waiting');
check('and is counted as open', waiting[0].open === 1);

console.log('\nResponse time is measured, or absent');
check('mean response is the real elapsed time', byId.ariba.meanResponseMinutes === 60,
  String(byId.ariba.meanResponseMinutes));
check('a handover that never came back does not count as instant',
  byId.ariba.meanResponseMinutes === 60, 'the timeout has no respondedAt and must be excluded');
check('nothing answered → null, not 0', systemHealth([rec('ariba', 'timeout', '2026-09-03T09:00:00Z')], SYSTEMS)[0].meanResponseMinutes === null);
check('null renders as an em dash, not "0 min"', humaniseMinutes(null) === '—');
check('minutes stay minutes', humaniseMinutes(45) === '45 min');
check('hours become hours', humaniseMinutes(300) === '5 h');
check('days become days', humaniseMinutes(60 * 24 * 13) === '13 d');

console.log('\nThe error log is the failed handovers');
const failed = failedHandovers(records);
check('only failures are listed', failed.length === 1 && failed[0].status === 'timeout');
check('newest first', failedHandovers([
  rec('ariba', 'error', '2026-09-01T09:00:00Z'),
  rec('ariba', 'error', '2026-09-09T09:00:00Z'),
])[0].submittedAt === '2026-09-09T09:00:00Z');

console.log('\nThe page holds no invented figures');
// Comments stripped: the page's own header names the figures it removed, and a
// guard that matches prose fails on the explanation of the fix rather than on
// the fix. Same narrowing test:config-consumption needed for daysInStage.
const page = read('src/features/admin/system-health-page.tsx')
  .split('\n')
  .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*') && !line.trim().startsWith('/*'))
  .join('\n');
for (const invented of ['99.97', '99.98', '99.95', '99.99', '0.02%', "'47'", '120ms']) {
  check(`no literal ${invented}`, !page.includes(invented),
    'every one of these was a hardcoded metric nothing measured');
}
check('no hardcoded integration array', !/const integrations: Integration\[\] = \[/.test(page));
check('no hardcoded error log', !/const errorLog: ErrorLogEntry\[\] = \[/.test(page));
check('it reads the table', /useSystemIntegrations\(\)/.test(page));
check('it says there are no live connections', /no live upstream connections/i.test(page));
// Loading, loaded and failed. A failed read and a platform with nothing to hand
// over look identical on a card.
check('an unreadable table is stated, not charted as zeroes', /isError/.test(page));

console.log('\nThe budget owner resolves to a real person');
const costCentres = read('src/features/admin/cost-centres-page.tsx');
// `approval-derivation.ts` matches `cost_centres.owner` against the user
// directory BY NAME, so free text meant a typo named nobody and fell through to
// the role — silently, which is the whole failure class here.
check('the owner is chosen from the directory, not typed',
  /useUsers\(\)/.test(costCentres) && !/id="cc-owner" value=\{form\.owner\} onChange/.test(costCentres));
check('external suppliers are not offered a budget', /role !== 'supplier'/.test(costCentres));
check('an empty owner is flagged, not shown as a dash', /No budget owner/.test(costCentres));
const derivation = read('src/lib/procurement/approval-derivation.ts');
check('the Budget Owner step still reads that name', /costCentreOwnerName/.test(derivation));

// ── Live ───────────────────────────────────────────────────────────────────
const env = loadEnv();
const connection = env.NEON_DATABASE_URL || env.DATABASE_URL;
if (!connection) {
  console.log('\n  (skipped live checks — no database connection)');
} else {
  console.log('\nThe live store agrees with what the screen would show');
  const sql = neon(connection);
  const rows = await sql`SELECT system, system_label, status, submitted_at, responded_at FROM system_integrations`;
  const live = rows.map((r) => ({
    id: `${r.system}-${r.submitted_at}`, requestId: '', system: r.system, systemLabel: r.system_label,
    status: r.status, submittedAt: r.submitted_at?.toISOString?.() ?? String(r.submitted_at ?? ''),
    respondedAt: r.responded_at ? (r.responded_at.toISOString?.() ?? String(r.responded_at)) : undefined,
    stage: '', detail: '',
  }));
  const liveHealth = systemHealth(live, SYSTEMS.slice(0, 2));
  // The specific thing the old page got wrong, asserted against production
  // data: at least one system is NOT in a green state, and the page that said
  // all four were connected was describing a store that disagreed with it.
  const anyNotHealthy = liveHealth.some((h) => h.state !== 'healthy');
  check('the live store is not uniformly healthy, as the old page claimed',
    anyNotHealthy || live.length === 0,
    liveHealth.map((h) => `${h.system}=${h.state}`).join(', '));
  console.log(`      live: ${liveHealth.map((h) => `${h.label} ${h.state} (${h.completed}✓ ${h.failed}✗ ${h.open}…)`).join(' | ')}`);
}

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exit(1); }
console.log('All integration-health checks passed.');
