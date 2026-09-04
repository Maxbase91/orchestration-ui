#!/usr/bin/env node
// Live Neon verification for the atomic governed-checkout boundary. The test
// uses one existing catalogue item and removes only its uniquely generated
// request aggregate after replay/conflict/concurrency checks complete.
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { loadEnv, requireConnection, skipIfUnreachable, skipLive } from '../lib/live.mjs';


const env = loadEnv();
const connectionString = requireConnection('governed-checkout-atomic');
process.env.NEON_DATABASE_URL = connectionString;
const sql = neon(connectionString);
const { default: handler } = await import('../../api/governed-checkout.ts');

function invoke(body) {
  let statusCode = 200;
  let responseBody;
  const response = {
    status(code) { statusCode = code; return response; },
    json(value) { responseBody = value; return response; },
  };
  return Promise.resolve(handler({ method: 'POST', body }, response)).then(() => ({ statusCode, body: responseBody }));
}

let items;
let users;
try {
  items = await sql.query(`SELECT * FROM catalogue_items WHERE available IS DISTINCT FROM false ORDER BY id LIMIT 1`);
  users = await sql.query('SELECT id, name FROM users ORDER BY id LIMIT 1');
} catch (error) {
  skipIfUnreachable('governed-checkout-atomic', error);
}
if (!items[0] || !users[0]) skipLive('governed-checkout-atomic', 'no seeded item/user');
const item = items[0];
const contract = (await sql.query('SELECT * FROM contracts WHERE id = $1', [item.contract_id]))[0];
const supplier = (await sql.query('SELECT * FROM suppliers WHERE id = $1', [item.supplier_id]))[0];
const risk = (await sql.query('SELECT * FROM risk_assessments WHERE id = $1', [item.risk_assessment_id]))[0];
const user = users[0];
// Read the reference data the server will validate against rather than inventing
// values: the checkout now rejects a cost centre or delivery location that is
// not an active row, so a hardcoded 'TEST' fails the way it should.
const [referenceCostCentre] = await sql.query('SELECT id FROM cost_centres WHERE active = true ORDER BY sort_order LIMIT 1');
const [referenceLocation] = await sql.query('SELECT id FROM delivery_locations WHERE active = true ORDER BY sort_order LIMIT 1');
if (!referenceCostCentre || !referenceLocation) {
  console.log('No active cost centre or delivery location is seeded; run the admin seed.');
  process.exit(3);
}
const REFERENCE_COST_CENTRE = String(referenceCostCentre.id);
const REFERENCE_LOCATION = String(referenceLocation.id);
if (!contract || !supplier || !risk) skipLive('governed-checkout-atomic', 'catalogue governance seed incomplete');

const suffix = Date.now().toString(36);
const requestId = `TEST-ATOMIC-${suffix}`;
const requisitionId = `PR-${requestId}`;
const idempotencyKey = `IDEMP-${suffix}`;
const payload = {
  requestId, requisitionId,
  request: { id: requestId, title: `Atomic checkout ${suffix}`, description: 'Atomic checkout integration test', category: 'catalogue', priority: 'low', requestorId: user.id, ownerId: user.id, buyingChannel: 'catalogue', businessJustification: 'Automated atomic checkout verification', costCentre: REFERENCE_COST_CENTRE, budgetOwner: user.name, commodityCode: item.commodity_code ?? '', commodityCodeLabel: item.commodity_code ?? '' },
  checkout: {
    route: 'catalogue', idempotencyKey, currency: 'EUR', needByDate: '2099-01-01', purpose: 'Automated atomic checkout verification',
    supplier: { id: supplier.id }, contract: { id: contract.id }, riskAssessment: { id: risk.id },
    // A real cost centre and a real delivery location: the server reads the
    // reference tables itself and rejects anything that is not an active row,
    // so 'TEST' and a profile-vouched location no longer pass. That rejection
    // is the point of the check — see test:governed-checkout.
    profile: { userId: user.id, defaultCurrency: 'EUR', costCentre: REFERENCE_COST_CENTRE, budgetOwner: user.name, accountType: 'expense', beneficiaryId: user.id, approvedShipToLocations: [], defaultShipToLocationId: REFERENCE_LOCATION },
  },
  lines: [{ id: `LINE-${suffix}`, requestId, description: item.name, quantity: 1, unit: item.unit, unitPrice: item.unit_price, supplierId: supplier.id, contractId: contract.id, catalogueItemId: item.id, riskAssessmentId: risk.id, commodityCode: item.commodity_code ?? '', deliveryDate: '2099-01-01' }],
};

let failures = 0;
const check = (label, condition, detail = '') => { if (condition) console.log(`  ✓ ${label}`); else { failures += 1; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); } };
try {
  const first = await invoke(payload);
  check('first submission succeeds', first.statusCode === 200 && first.body?.requestId === requestId, JSON.stringify(first));
  check('request, requisition and line are returned', Boolean(first.body?.requisition?.id) && first.body?.lines?.length === 1, JSON.stringify(first));
  const replay = await invoke(payload);
  check('same key safely replays the aggregate', replay.statusCode === 200 && replay.body?.requisition?.id === requisitionId, JSON.stringify(replay));
  const conflict = await invoke({ ...payload, checkout: { ...payload.checkout, purpose: 'Different payload with same key' } });
  check('conflicting key is rejected with 409', conflict.statusCode === 409 && conflict.body?.code === 'idempotency_conflict', JSON.stringify(conflict));
  const staleDecisionPayload = { ...payload, requestId: `${requestId}-STALE`, requisitionId: `${requisitionId}-STALE`, checkout: { ...payload.checkout, idempotencyKey: `${idempotencyKey}-STALE` }, lines: [{ ...payload.lines[0], requestId: `${requestId}-STALE`, id: `${payload.lines[0].id}-STALE` }], decision: { ok: true, totalValue: 1, currency: 'EUR', approvalRequired: false, riskReviewRequired: false, contractAmendmentRequired: false, status: 'approved', errors: [], warnings: [], resolved: { supplierId: supplier.id, contractId: contract.id, commodityCodes: [] } } };
  const stale = await invoke(staleDecisionPayload);
  check('stale client decision is rejected', stale.statusCode === 409 && stale.body?.code === 'governance_mismatch', JSON.stringify(stale));
  await sql.query('DELETE FROM purchase_orders WHERE request_id = $1', [requestId]);
  await sql.query('DELETE FROM request_lines WHERE request_id = $1', [requestId]);
  await sql.query('DELETE FROM purchase_requisitions WHERE request_id = $1', [requestId]);
  await sql.query('DELETE FROM requests WHERE id = $1', [requestId]);
  const concurrentPayload = { ...payload, requestId: `${requestId}-CONCURRENT`, requisitionId: `${requisitionId}-CONCURRENT`, checkout: { ...payload.checkout, idempotencyKey: `${idempotencyKey}-CONCURRENT` }, lines: [{ ...payload.lines[0], requestId: `${requestId}-CONCURRENT`, id: `${payload.lines[0].id}-CONCURRENT` }] };
  const concurrent = await Promise.all([invoke(concurrentPayload), invoke(concurrentPayload)]);
  check('concurrent submissions return one aggregate', concurrent.every((result) => result.statusCode === 200 && result.body?.requisition?.id === concurrentPayload.requisitionId), JSON.stringify(concurrent));
  await sql.query('DELETE FROM purchase_orders WHERE request_id = $1', [concurrentPayload.requestId]);
  await sql.query('DELETE FROM request_lines WHERE request_id = $1', [concurrentPayload.requestId]);
  await sql.query('DELETE FROM purchase_requisitions WHERE request_id = $1', [concurrentPayload.requestId]);
  await sql.query('DELETE FROM requests WHERE id = $1', [concurrentPayload.requestId]);
} finally {
  await sql.query('DELETE FROM purchase_orders WHERE request_id LIKE $1', [`${requestId}%`]);
  await sql.query('DELETE FROM request_lines WHERE request_id LIKE $1', [`${requestId}%`]);
  await sql.query('DELETE FROM purchase_requisitions WHERE request_id LIKE $1', [`${requestId}%`]);
  await sql.query('DELETE FROM requests WHERE id LIKE $1', [`${requestId}%`]);
}
if (failures) process.exitCode = 1;
else console.log('Atomic governed-checkout checks passed.');
