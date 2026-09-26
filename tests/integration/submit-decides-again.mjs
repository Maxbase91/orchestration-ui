#!/usr/bin/env node
// Submit decides a demand again on the server, and refuses when the answer
// differs from what the requester reviewed (2026-09-26).
//
// /api/intake-submit stored the determination and the compliance record the
// browser sent: a stale Channel page, or a payload edited on the way, became
// the record, and the server checked nothing but the channel's spelling. Now it
// makes the determination itself from stored data — the supplier, its contracts
// and its reusable risk assessments through the same ports the browser reads,
// the rules, chains and validator through the same read code, the thresholds
// from the stored row — compares, refuses a difference with what changed
// (409 determination_changed, nothing written), and records its own.
//
// Four parts: the comparison, the shared ports, that both sides read the same
// way, and the handler against the live store (skipped without a database).
//
// Run: node --import tsx/esm tests/integration/submit-decides-again.mjs

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { loadEnv, skipIfUnreachable, skipLive } from '../lib/live.mjs';
import { evaluateIntakeDetermination, recordedDetermination } from '../../src/lib/procurement/intake-determination.ts';
import { buildIntakeComplianceRecord } from '../../src/lib/procurement/intake-compliance-record.ts';
import { decidedSummary, determinationChanges, reviewedSummary } from '../../src/lib/procurement/determination-changes.ts';
import { DEFAULT_POLICY_CONFIG } from '../../src/lib/procurement/policy-config.ts';
import { NeonCompatibleClient } from '../../src/lib/neon-compatible-client.ts';
import { createSharedConnectors } from '../../src/lib/integrations/shared-connectors.ts';
import { findReusableRiskAssessments } from '../../src/lib/integrations/reusable-assessments.ts';
import { routingRules } from '../../src/data/routing-rules.ts';

let failures = 0;
const check = async (label, fn) => {
  try { await fn(); console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (error) { failures++; console.error(`  \x1b[31m✗\x1b[0m ${label} — ${error.message.split('\n')[0]}`); }
};
const ROOT = new URL('../../', import.meta.url).pathname;
const read = (file) => readFileSync(join(ROOT, file), 'utf8');

// ── The comparison ──────────────────────────────────────────────────────────

console.log('\nWhat the requester reviewed and what submit decided are compared value by value');

const supplier = {
  id: 'SUP-1', name: 'Supplier One', country: 'Germany', countryCode: 'DE', riskRating: 'low', activeContracts: 0,
  totalSpend12m: 0, onboardingStatus: 'completed', sraStatus: 'valid', sraExpiryDate: '2027-01-01', screeningStatus: 'clear',
  categories: ['services'], tier: 2, certifications: [], spendHistory: [], performanceScore: 80,
};
const CHAINS = [
  { id: 'AC-1', name: 'Standard', minValue: null, maxValue: '50000', threshold: '', description: '', steps: [] },
  { id: 'AC-2', name: 'Senior', minValue: '50000', maxValue: null, threshold: '', description: '', steps: [] },
];
const chainName = (id) => (id ? CHAINS.find((c) => c.id === id)?.name ?? id : 'none');
const determination = evaluateIntakeDetermination({
  category: 'services', estimatedValue: 30000, supplierId: 'SUP-1', isUrgent: false, requestTitle: 'Office cleaning',
  serviceDescription: { objective: 'Weekly office cleaning' }, miniIrq: {}, now: '2026-09-26',
  suppliers: [supplier], contracts: [], matchingRiskAssessments: [], routingRules, approvalChains: CHAINS,
  validatorAgent: { name: 'Request Validator', status: 'active' }, policyConfig: DEFAULT_POLICY_CONFIG,
});
const decided = decidedSummary(determination, buildIntakeComplianceRecord(determination, { determinedAt: '2026-09-26T10:00:00Z' }));
// What the page sends, through JSON as it travels: an undefined chain is dropped.
const wire = (value) => JSON.parse(JSON.stringify(value));
const sent = (request = {}, compliance) => reviewedSummary(
  wire({ ...recordedDetermination(determination), ...request }),
  wire(compliance ?? buildIntakeComplianceRecord(determination, { determinedAt: '2026-09-26T09:00:00Z' })));
const changes = (request, compliance) => determinationChanges(sent(request, compliance), decided, chainName);

await check('an honest submit agrees — when each was decided is not compared', () => assert.deepEqual(changes(), []));
await check('…nor the sentences, which follow from the values', () => {
  const compliance = wire(buildIntakeComplianceRecord(determination, { determinedAt: 'x' }));
  compliance.sraCheck.detail = 'Checked by nobody';
  compliance.policyChecks = compliance.policyChecks.map((c) => ({ ...c, detail: 'anything' }));
  compliance.buyingChannel.reasoning = 'because';
  assert.deepEqual(changes({}, compliance), []);
});
await check('a different channel is named in the Channel page’s words', () => {
  const other = determination.buyingChannelSlug === 'business-led' ? 'procurement-led' : 'business-led';
  assert.equal(changes({ buyingChannel: other }).filter((c) => /^The buying channel is now /.test(c)).length, 1);
});
await check('a different approval chain is named by the chain’s name', () => {
  const other = determination.approvalChain === 'AC-2' ? 'AC-1' : 'AC-2';
  assert.match(changes({ approvalChain: other }).join(' '), new RegExp(`now ${chainName(determination.approvalChain)} \\(you reviewed ${chainName(other)}\\)`));
});
await check('each recorded value is compared', () => {
  const flipped = {
    riskAssessmentRequired: !determination.riskAssessmentRequired, inherentRiskTier: 'critical',
    materialityTier: 'critical', sourcingType: 'benchmarking', screeningOutcome: 'flagged', referralDisposition: 'refer-back',
  };
  const said = changes(flipped).join(' ');
  for (const pattern of [/A risk assessment is/, /inherent risk is now/, /Materiality is now/, /sourcing type is now/,
    /Supplier screening is now/, /disposition is now/]) assert.match(said, pattern);
});
await check('a policy check that flips, appears or goes is named', () => {
  const compliance = wire(buildIntakeComplianceRecord(determination, { determinedAt: 'x' }));
  const [first, ...rest] = compliance.policyChecks;
  compliance.policyChecks = [{ ...first, passed: !first.passed }, ...rest.slice(1), { label: 'Invented check', passed: true, detail: '' }];
  const said = changes({}, compliance).join(' ');
  assert.match(said, new RegExp(`"${first.label}" now ${first.passed ? 'passes' : 'fails'}`));
  assert.match(said, new RegExp(`"${rest[0].label}" now applies`));
  assert.match(said, /"Invented check" no longer applies/);
});
await check('the SRA outcome, the reusable assessments, onboarding and the risk questions are compared', () => {
  const compliance = wire(buildIntakeComplianceRecord(determination, { determinedAt: 'x' }));
  compliance.sraCheck.status = 'not-run';
  compliance.matchingRiskAssessmentIds = ['RA-GHOST'];
  const onboarding = compliance.riskFlags.includes('supplier-onboarding-required');
  compliance.riskFlags = [
    ...compliance.riskFlags.filter((f) => !f.startsWith('risk-question:') && f !== 'supplier-onboarding-required'),
    'risk-question:ghost=yes', ...(onboarding ? [] : ['supplier-onboarding-required']),
  ];
  const said = changes({}, compliance).join(' ');
  for (const pattern of [/risk assessment check is now/, /can be reused have changed/, /Vendor onboarding is (now|no longer) required/, /risk questions/]) {
    assert.match(said, pattern);
  }
});
await check('reusable assessments are a set — their order is not a change', () => {
  const two = { ...decided, reusableAssessmentIds: ['RA-1', 'RA-2'] };
  assert.deepEqual(determinationChanges({ ...two, reusableAssessmentIds: ['RA-2', 'RA-1'] }, two, chainName), []);
});
await check('a submit that sends no compliance record reviewed nothing, and is refused', () =>
  assert.ok(determinationChanges(reviewedSummary(wire(recordedDetermination(determination)), undefined), decided, chainName).length > 0));

// ── The shared ports ────────────────────────────────────────────────────────

console.log('\nThe shared ports read with the client they are given');

/** A client whose executor answers from fixture rows, recording what it was asked. */
function fixtureClient(tables) {
  const asked = [];
  const client = new NeonCompatibleClient(async (payload) => {
    asked.push(payload);
    let rows = tables[payload.table] ?? [];
    for (const filter of payload.filters ?? []) {
      if (filter.operator === 'eq') rows = rows.filter((row) => row[filter.column] === filter.value);
    }
    return payload.single ? rows[0] ?? null : rows;
  });
  return { client, asked };
}
const assessment = (id, over) => ({
  id, title: id, subject_type: 'supplier', supplier_id: 'SUP-1', contract_id: null, category: 'security', risk_level: 'low',
  score: 10, status: 'completed', assessor_id: 'u1', assessor_name: 'Risk', assessed_at: '2026-06-01', valid_until: '2027-06-01',
  summary: '', mitigations: [], reusable: true, linked_request_ids: [], ...over,
});
const { client, asked } = fixtureClient({
  suppliers_with_derived: [{ id: 'SUP-1', name: 'Supplier One', active_contracts_live: 2, total_spend_12m_live: 5000 }],
  contracts_with_derived: [
    { id: 'CT-1', title: 'A', supplier_id: 'SUP-1', category: 'services', status: 'active' },
    { id: 'CT-2', title: 'B', supplier_id: 'SUP-2', category: 'services', status: 'active' },
  ],
  risk_assessments: [
    assessment('RA-NEW', { assessed_at: '2026-08-01' }),
    assessment('RA-OLD', { assessed_at: '2026-01-01' }),
    assessment('RA-DRAFT', { status: 'draft' }),
    assessment('RA-SINGLE-USE', { reusable: false }),
    assessment('RA-ENDS-TODAY', { valid_until: '2026-09-26' }),
    assessment('RA-OTHER', { supplier_id: 'SUP-2' }),
    assessment('RA-CONTRACT', { supplier_id: 'SUP-9', contract_id: 'CT-1' }),
  ],
});
const ports = createSharedConnectors(client);
await check('the supplier is read from the derived view, with its live counts', async () => {
  const record = await ports.supplier.get('SUP-1');
  assert.equal(record?.data.activeContracts, 2);
  assert.ok(asked.some((p) => p.table === 'suppliers_with_derived'));
});
await check('a supplier’s contracts are read through the port’s filter', async () =>
  assert.deepEqual((await ports.contract.list({ filters: { supplierId: 'SUP-1' } })).map((r) => r.data.id), ['CT-1']));
await check('reuse: completed, reusable, valid after today, of this supplier — most recent first', async () =>
  assert.deepEqual((await findReusableRiskAssessments(ports.riskAssessment, { supplierId: 'SUP-1', today: '2026-09-26' }))
    .map((a) => a.id), ['RA-NEW', 'RA-OLD']));
await check('reuse: the supplier’s or the contract’s', async () =>
  assert.deepEqual((await findReusableRiskAssessments(ports.riskAssessment, { supplierId: 'SUP-1', contractId: 'CT-1', today: '2026-09-26' }))
    .map((a) => a.id).sort(), ['RA-CONTRACT', 'RA-NEW', 'RA-OLD']));
await check('reuse: nothing to match without a supplier or a contract', async () =>
  assert.deepEqual(await findReusableRiskAssessments(ports.riskAssessment, { today: '2026-09-26' }), []));

// ── Both sides read the same way ────────────────────────────────────────────

console.log('\nThe browser and the server read the determination’s inputs the same way');

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}
const sources = [...files(join(ROOT, 'src')), ...files(join(ROOT, 'api'))].map((path) => [path.replace(ROOT, ''), readFileSync(path, 'utf8')]);
await check('the supplier, contract and risk connectors are built in one place, for both sides', () => {
  const builders = sources.filter(([path, text]) => !path.includes('/own-store/')
    && /create(Supplier|Contract|RiskAssessment)Connector\(/.test(text)).map(([path]) => path);
  assert.deepEqual(builders, ['src/lib/integrations/shared-connectors.ts']);
  assert.match(read('src/lib/integrations/index.ts'), /createSharedConnectors\(db\)/);
  assert.match(read('api/_determination.ts'), /createSharedConnectors\(client\)/);
});
await check('reuse is read through the port everywhere — the query beside it is gone', () => {
  assert.ok(!sources.some(([, text]) => /findMatchingRiskAssessments/.test(text)));
  assert.match(read('src/lib/db/hooks/use-risk-assessments.ts'), /findReusableRiskAssessments\(/);
  assert.match(read('api/_determination.ts'), /findReusableRiskAssessments\(ports\.riskAssessment/);
});
await check('each browser read module and the server share one read', () => {
  for (const [file, call] of [
    ['src/lib/db/suppliers.ts', 'listSuppliersWith(db)'], ['src/lib/db/contracts.ts', 'listContractsWith(db)'],
    ['src/lib/db/risk-assessments.ts', 'listRiskAssessmentsWith(db)'], ['src/lib/db/routing-rules.ts', 'listRoutingRulesWith(db)'],
    ['src/lib/db/approval-chains.ts', 'listApprovalChainsWith(db)'], ['src/lib/db/ai-agents.ts', 'getAiAgentWith(db, id)'],
  ]) assert.ok(read(file).includes(call), `${file} does not read through ${call}`);
  const server = read('api/_determination.ts');
  for (const call of ['listRoutingRulesWith(client)', 'listApprovalChainsWith(client)',
    'getAiAgentWith(client, REQUEST_VALIDATOR_AGENT_ID)', 'policyConfig: policy']) assert.ok(server.includes(call), call);
});
await check('the browser decides on the saved thresholds, and knows what to fetch again', () => {
  const hook = read('src/features/requests/new-request/use-intake-determination.ts');
  assert.match(hook, /policyConfig,\n\s*\}\);/);
  const keys = /DETERMINATION_INPUT_KEYS = \[([\s\S]*?)\] as const/.exec(hook)?.[1] ?? '';
  for (const [hookName, key] of [
    ["useSourceData<Supplier>('supplier')", "['source-connector', 'supplier']"],
    ["useSourceData<Contract>('contract')", "['source-connector', 'contract']"],
    ['useMatchingRiskAssessments(', "['risk-assessments']"], ['useRoutingRules(', "['routing-rules']"],
    ['useAiAgent(', "['ai-agents']"], ['useApprovalChains(', "['approval-chains']"],
    ['usePreferredSupplierIds(', "['category-preferred-suppliers']"], ['useServiceDescriptionTemplate(', "['service-description-templates']"],
  ]) {
    if (hook.includes(hookName)) assert.ok(keys.includes(key), `${hookName} is read, but ${key} is not fetched again`);
  }
});
await check('the page sends what was reviewed and the answers, and handles a refusal', () => {
  const page = read('src/features/requests/new-request/new-request-page.tsx');
  assert.match(page, /\.\.\.recordedDetermination\(determination\)/);
  assert.match(page, /riskAnswers: formData\.miniIrq/);
  assert.match(page, /e\.code === 'determination_changed'[\s\S]{0,120}refreshDeterminationInputs\(queryClient\)/);
});
await check('the handler decides, compares and refuses before it writes, and records its own', () => {
  const handler = read('api/_domains/intake-submit.ts');
  const decides = handler.indexOf('determineOnServer(');
  const refuses = handler.indexOf("'determination_changed', 409");
  const writes = handler.indexOf('sql.transaction(queries)');
  assert.ok(decides > 0 && decides < refuses && refuses < writes, 'decide → refuse → write is out of order');
  assert.match(handler, /determined_at: serverCompliance\.determinedAt/);
  for (const clientValue of ['request.sourcingType', 'request.approvalChain', 'request.inherentRiskTier', 'request.materialityTier',
    'request.riskAssessmentRequired', 'request.screeningOutcome', 'request.referralDisposition', 'compliance.policyChecks']) {
    assert.ok(!handler.includes(clientValue), `the handler still reads ${clientValue} from the payload`);
  }
});

// ── The handler, against the live store ─────────────────────────────────────

console.log('\nThe server refuses a changed determination and records its own');

const env = loadEnv();
const connectionString = env.NEON_DATABASE_URL ?? env.DATABASE_URL;
if (!connectionString) {
  if (failures) { console.error(`\nFAILED: ${failures} check(s)`); process.exit(1); }
  skipLive('submit-decides-again (live part)', 'NEON_DATABASE_URL/DATABASE_URL is not configured');
}
process.env.NEON_DATABASE_URL = connectionString;
const sql = neon(connectionString);
const { default: handler } = await import('../../api/_domains/intake-submit.ts');
const { determineOnServer } = await import('../../api/_determination.ts');
const { getDbAdmin } = await import('../../api/_db-admin.ts');
const { loadPolicyConfigWith } = await import('../../api/_policy.ts');
const { getNeonClient } = await import('../../api/_neon.ts');

const invoke = async (body) => {
  let status = 200; let json;
  const res = { status(code) { status = code; return res; }, json(value) { json = value; return res; }, setHeader() {} };
  await handler({ method: 'POST', body, headers: {} }, res);
  return { status, json };
};

let fixture;
try {
  const [user] = await sql.query('SELECT id FROM users ORDER BY id LIMIT 1');
  const [centre] = await sql.query('SELECT id FROM cost_centres WHERE active = true ORDER BY id LIMIT 1');
  const [supplierRow] = await sql.query("SELECT id FROM suppliers ORDER BY id LIMIT 1");
  fixture = { user, centre, supplierRow };
} catch (error) {
  skipIfUnreachable('submit-decides-again', error);
}
if (!fixture?.user || !fixture?.centre || !fixture?.supplierRow) skipLive('submit-decides-again', 'needs a user, an active cost centre and a supplier');

const suffix = Date.now().toString(36);
const ids = { changed: `TEST-SDA-C-${suffix}`, channel: `TEST-SDA-X-${suffix}`, honest: `TEST-SDA-H-${suffix}` };
async function cleanup() {
  for (const id of Object.values(ids)) {
    for (const table of ['approval_entries', 'workflow_instances', 'stage_history', 'intake_compliance_records', 'service_descriptions']) {
      await sql.query(`DELETE FROM ${table} WHERE request_id = $1`, [id]);
    }
    await sql.query('DELETE FROM requests WHERE id = $1', [id]);
  }
}

try {
  await cleanup();
  const today = new Date().toISOString().slice(0, 10);
  const sow = { objective: 'Weekly office cleaning for one site', scope: 'Cleaning of offices and shared areas', narrative: 'Weekly office cleaning.' };
  const psl = (await sql.query("SELECT supplier_id FROM category_preferred_suppliers WHERE category_id = 'services'")).map((r) => String(r.supplier_id));
  const demand = {
    category: 'services', estimatedValue: 30000, supplierId: fixture.supplierRow.id, isUrgent: false,
    requestTitle: `Submit decides again ${suffix}`, serviceDescription: sow, riskAnswers: {}, preferredSupplierIds: psl,
  };
  // The honest browser: the determination a page reading the same store would show.
  const policy = await loadPolicyConfigWith(getNeonClient());
  const { determination: reviewed } = await determineOnServer(getDbAdmin(), demand, policy, today);
  const payload = (id, { request = {}, compliance, buyingChannel } = {}) => ({
    request: {
      id, title: demand.requestTitle, category: 'services', value: 30000, currency: 'EUR', requestorId: fixture.user.id,
      ownerId: fixture.user.id, costCentre: fixture.centre.id, deliveryDate: '2027-03-31', supplierId: demand.supplierId,
      supplierOverrideReason: 'The only supplier for this site', isUrgent: false, ...recordedDetermination(reviewed), ...request,
    },
    serviceDescription: sow,
    compliance: compliance ?? buildIntakeComplianceRecord(reviewed, { determinedAt: new Date().toISOString() }),
    buyingChannel: buyingChannel ?? reviewed.buyingChannelSlug,
    riskAnswers: {},
    idempotencyKey: `intake-${id}`,
  });
  const exists = async (id) => (await sql.query('SELECT count(*)::int AS n FROM requests WHERE id = $1', [id]))[0].n === 1;

  const flipped = await invoke(payload(ids.changed, { request: { riskAssessmentRequired: !reviewed.riskAssessmentRequired } }));
  await check('a submit whose determination differs is refused — 409 determination_changed', () => {
    assert.equal(flipped.status, 409, JSON.stringify(flipped.json));
    assert.equal(flipped.json?.code, 'determination_changed');
  });
  await check('…saying what changed', () => assert.match((flipped.json?.changes ?? []).join(' '), /A risk assessment is (now|no longer) required/));
  await check('…and writing nothing', async () => assert.equal(await exists(ids.changed), false));

  const otherChannel = reviewed.buyingChannelSlug === 'business-led' ? 'procurement-led' : 'business-led';
  const channel = await invoke(payload(ids.channel, { request: { buyingChannel: otherChannel }, buyingChannel: otherChannel }));
  await check('a channel the server would not choose is refused, and named', async () => {
    assert.equal(channel.status, 409, JSON.stringify(channel.json));
    assert.match((channel.json?.changes ?? []).join(' '), /The buying channel is now/);
    assert.equal(await exists(ids.channel), false);
  });

  const compliance = wire(buildIntakeComplianceRecord(reviewed, { determinedAt: '1999-01-01T00:00:00.000Z' }));
  compliance.sraCheck.detail = 'Checked by nobody';
  compliance.policyChecks = compliance.policyChecks.map((c) => ({ ...c, detail: 'Written by the browser' }));
  const honest = await invoke(payload(ids.honest, { compliance }));
  await check('an honest submit is accepted', () => assert.equal(honest.status, 201, JSON.stringify(honest.json)));
  const [row] = await sql.query('SELECT * FROM requests WHERE id = $1', [ids.honest]);
  const [record] = await sql.query('SELECT * FROM intake_compliance_records WHERE request_id = $1', [ids.honest]);
  await check('the request records the server’s determination', () => {
    const recorded = recordedDetermination(reviewed);
    assert.equal(row?.buying_channel, recorded.buyingChannel);
    assert.equal(row?.sourcing_type, recorded.sourcingType);
    assert.equal(row?.inherent_risk_tier, recorded.inherentRiskTier);
    assert.equal(row?.materiality_tier, recorded.materialityTier);
    assert.equal(row?.risk_assessment_required, recorded.riskAssessmentRequired);
    assert.equal(row?.screening_outcome, recorded.screeningOutcome);
    assert.equal(row?.referral_disposition, recorded.referralDisposition);
    assert.equal(row?.approval_chain ?? null, recorded.approvalChain ?? null);
  });
  await check('the compliance record is the server’s — the browser’s text and date are not kept', () => {
    assert.ok(record, 'no compliance record was written');
    assert.notEqual(record.sra_check?.detail, 'Checked by nobody');
    assert.ok(!(record.policy_checks ?? []).some((c) => c.detail === 'Written by the browser'));
    assert.ok(!String(record.determined_at).startsWith('1999'), `determined_at ${record.determined_at}`);
  });
  const again = await invoke(payload(ids.honest, { compliance }));
  await check('a retry of the accepted submit replays it', () => assert.equal(again.json?.replay, true, JSON.stringify(again.json)));
} finally {
  await cleanup();
}

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exitCode = 1; }
else console.log('All submit-decides-again checks passed.');

