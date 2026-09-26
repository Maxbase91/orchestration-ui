#!/usr/bin/env node
// A request completes its lifecycle: checkout → approvals → PO → receipt.
//
// None of this journey was possible. A governed checkout wrote no workflow
// instance, no stage history and no approvals, so there was nothing to
// progress. Approving offered itself to any persona, wrote nothing and reported
// success. And nothing at all could move a request past `po` — the advance gate
// listed risk, validation and onboarding, so the button never rendered for
// receipt, invoice or payment, for any role including admin. REQ-2025-9485 is
// the request that got stuck proving it.
//
// This walks the journey against live Neon through the real handlers and the
// real data layer, and cleans up after itself.
import { neon } from '@neondatabase/serverless';
import { loadEnv, purgeAuditEntries, requireConnection, skipIfUnreachable, skipLive } from '../lib/live.mjs';

loadEnv();
const connectionString = requireConnection('request-lifecycle-e2e');
process.env.NEON_DATABASE_URL = connectionString;
const sql = neon(connectionString);

const { default: checkout } = await import('../../api/governed-checkout.ts');
const { canActOnApproval } = await import('../../src/lib/procurement/approval-derivation.ts');
const { nextStageAfter, channelStageMapFromTemplates } = await import('../../src/lib/workflow/channel-stages.ts');
const { workflowTemplates } = await import('../../src/data/workflows.ts');
// The lifecycle comes from the templates now — buying-channel-stages.ts is deleted.
const CHANNEL_STAGES = channelStageMapFromTemplates(workflowTemplates);
const { advanceOnReceipt, stageAfterReceipt } = await import('../../src/lib/db/receipts-core.ts');
const { neonClient } = await import('../lib/live.mjs');
const client = await neonClient('request-lifecycle-e2e');

let failures = 0;
const check = (label, fn) => {
  try { fn(); console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (error) { failures++; console.error(`  \x1b[31m✗\x1b[0m ${label} — ${error.message.split('\n')[0]}`); }
};
function invoke(body) {
  let statusCode = 200; let responseBody;
  const res = { status(c) { statusCode = c; return res; }, json(v) { responseBody = v; return res; } };
  return Promise.resolve(checkout({ method: 'POST', body }, res)).then(() => ({ statusCode, body: responseBody }));
}

let item;
try {
  [item] = await sql.query(
    "SELECT * FROM catalogue_items WHERE available IS DISTINCT FROM false AND contract_id IS NOT NULL ORDER BY id LIMIT 1");
} catch (error) { skipIfUnreachable('request-lifecycle-e2e', error); }
if (!item) skipLive('request-lifecycle-e2e', 'no seeded catalogue item');

const [contract] = await sql.query('SELECT * FROM contracts WHERE id = $1', [item.contract_id]);
const [supplier] = await sql.query('SELECT * FROM suppliers WHERE id = $1', [item.supplier_id]);
const [risk] = await sql.query('SELECT * FROM risk_assessments WHERE id = $1', [item.risk_assessment_id]);
const [user] = await sql.query('SELECT id, name FROM users WHERE id = $1', ['u6']);
const [centre] = await sql.query('SELECT id FROM cost_centres WHERE active = true ORDER BY sort_order LIMIT 1');
const [location] = await sql.query('SELECT id FROM delivery_locations WHERE active = true ORDER BY sort_order LIMIT 1');
if (!contract || !supplier || !risk || !centre || !location) skipLive('request-lifecycle-e2e', 'catalogue governance seed incomplete');

const suffix = Date.now().toString(36);
const requestId = `TEST-E2E-${suffix}`;
const requisitionId = `PR-${requestId}`;
const quantity = 2;

async function cleanup() {
  await sql.query('DELETE FROM goods_receipts WHERE request_id = $1', [requestId]);
  for (const table of ['approval_entries', 'purchase_orders', 'request_lines', 'purchase_requisitions', 'stage_history']) {
    await sql.query(`DELETE FROM ${table} WHERE request_id = $1`, [requestId]);
  }
  await sql.query('DELETE FROM workflow_instances WHERE request_id = $1', [requestId]);
  // The audit log is append-only; the purge is how a suite removes its own rows.
  await purgeAuditEntries('request_id = $1', [requestId]);
  await sql.query('DELETE FROM requests WHERE id = $1', [requestId]);
}
await cleanup();

try {
  console.log('\n1. A catalogue checkout creates a complete request');

  const line = {
    id: `LINE-${requestId}-1`, requestId, description: item.name, quantity,
    unit: item.unit, unitPrice: Number(item.unit_price), supplierId: supplier.id,
    contractId: contract.id, catalogueItemId: item.id, riskAssessmentId: risk.id,
    deliveryDate: '2099-01-01',
  };
  const result = await invoke({
    requestId, requisitionId,
    request: { id: requestId, title: `Lifecycle ${suffix}`, category: 'catalogue', priority: 'low',
      requestorId: user.id, ownerId: user.id, buyingChannel: 'catalogue', costCentre: centre.id, budgetOwner: user.name },
    checkout: { route: 'catalogue', currency: 'EUR', purpose: 'Lifecycle verification',
      needByDate: '2099-01-01', costCentre: centre.id, budgetOwner: user.name, accountType: 'opex',
      shipToLocationId: location.id, beneficiaryId: user.id,
      supplier: { id: supplier.id }, contract: { id: contract.id }, riskAssessment: { id: risk.id },
      profile: { userId: user.id, defaultCurrency: 'EUR', costCentre: centre.id, budgetOwner: user.name,
        accountType: 'opex', defaultShipToLocationId: location.id, approvedShipToLocations: [] } },
    lines: [line],
  });
  check('the checkout succeeds', () => {
    if (result.statusCode !== 200) throw new Error(`${result.statusCode}: ${JSON.stringify(result.body)}`);
  });

  const [request] = await sql.query('SELECT status, buying_channel, po_id, workflow_template_id FROM requests WHERE id = $1', [requestId]);
  check('it has a workflow template', () => { if (!request?.workflow_template_id) throw new Error('none'); });
  const instances = await sql.query('SELECT id FROM workflow_instances WHERE request_id = $1', [requestId]);
  check('it has exactly one workflow instance', () => {
    if (instances.length !== 1) throw new Error(`${instances.length}`);
  });
  check('it reached the PO stage', () => {
    if (request?.status !== 'po') throw new Error(`status ${request?.status}`);
  });
  check('a purchase order exists', () => { if (!request?.po_id) throw new Error('no po_id'); });

  console.log('\n2. The PO can be received');

  const [po] = await sql.query('SELECT id, status, line_items FROM purchase_orders WHERE request_id = $1', [requestId]);
  check('the PO is receivable', () => {
    if (!['submitted', 'acknowledged', 'partially-received'].includes(String(po?.status))) {
      throw new Error(`status ${po?.status} is not in the receivable set`);
    }
  });

  // A partial receipt first: it must NOT move the request.
  const partial = await advanceOnReceipt(client, { requestId, receivedBy: user.name, receiptStatus: 'partial' });
  check('a partial receipt does not move the request', () => {
    if (partial.movedTo) throw new Error(`moved to ${partial.movedTo}`);
    if (partial.reason !== 'partial') throw new Error(`reason ${partial.reason}`);
  });
  const [afterPartial] = await sql.query('SELECT status FROM requests WHERE id = $1', [requestId]);
  check('and leaves it in the PO stage', () => {
    if (afterPartial?.status !== 'po') throw new Error(`status ${afterPartial?.status}`);
  });

  const advanced = await advanceOnReceipt(client, { requestId, receivedBy: user.name, receiptStatus: 'complete' });
  check('a full receipt reports that it moved the request', () => {
    if (advanced.reason !== 'advanced') throw new Error(`reason ${advanced.reason}`);
  });
  check('a second full receipt does not move it again', () => {
    // A receipt recorded against a request that has already moved on must not
    // drag it backwards.
    return advanceOnReceipt(client, { requestId, receivedBy: user.name, receiptStatus: 'complete' })
      .then((again) => { if (again.movedTo) throw new Error(`moved again to ${again.movedTo}`); });
  });

  console.log('\n3. A full receipt moves the request on');

  const [afterFull] = await sql.query('SELECT status FROM requests WHERE id = $1', [requestId]);
  const expected = nextStageAfter(CHANNEL_STAGES, 'catalogue', 'po');
  check('the request left the PO stage', () => {
    if (afterFull?.status === 'po') throw new Error('still in po — nothing advanced it');
  });
  check(`it reached ${expected}`, () => {
    if (afterFull?.status !== expected) throw new Error(`status ${afterFull?.status}`);
  });

  const history = await sql.query(
    'SELECT stage, action, completed_at FROM stage_history WHERE request_id = $1 ORDER BY entered_at, stage', [requestId]);
  check('the receipt is on the timeline', () => {
    if (!history.some((h) => h.stage === expected)) throw new Error(JSON.stringify(history.map((h) => h.stage)));
  });
  check('exactly one stage is open', () => {
    const open = history.filter((h) => !h.completed_at);
    if (open.length !== 1) throw new Error(`${open.length} open: ${JSON.stringify(open.map((h) => h.stage))}`);
  });

  console.log('\n   The rule on its own');
  check('only a complete receipt moves anything', () => {
    if (stageAfterReceipt({ channelStages: CHANNEL_STAGES, receiptStatus: 'partial', requestStatus: 'po', buyingChannel: 'catalogue' }).movedTo) {
      throw new Error('a partial receipt moved the request');
    }
  });
  check('only from the PO stage', () => {
    if (stageAfterReceipt({ channelStages: CHANNEL_STAGES, receiptStatus: 'complete', requestStatus: 'invoice', buyingChannel: 'catalogue' }).movedTo) {
      throw new Error('it moved a request that had already gone past po');
    }
  });
  check('and only where the channel has a stage after it', () => {
    // A channel whose template ends at the PO (P-card was the shipped example;
    // it is retired, so the template is built here).
    const endsAtPo = channelStageMapFromTemplates([{
      id: 'T', channels: ['business-led'],
      nodes: [
        { id: 's', type: 'start', label: 'Start' }, { id: 'a', type: 'stage', label: 'Intake' },
        { id: 'b', type: 'stage', label: 'PO Creation' }, { id: 'e', type: 'end', label: 'End' },
      ],
      edges: [{ source: 's', target: 'a' }, { source: 'a', target: 'b' }, { source: 'b', target: 'e' }],
    }]);
    const result = stageAfterReceipt({ channelStages: endsAtPo, receiptStatus: 'complete', requestStatus: 'po', buyingChannel: 'business-led' });
    if (result.movedTo) throw new Error(`a channel with no receipt stage moved to ${result.movedTo}`);
  });

  console.log('\n4. The order carries what a hand-off needs');

  const { orderReadiness } = await import('../../src/lib/procurement/order-readiness.ts');
  const [savedLine] = await sql.query(
    'SELECT line_number, description, quantity, unit_price, supplier_part_id, unit_of_measure_code, commodity_code FROM request_lines WHERE request_id = $1 ORDER BY line_number', [requestId]);
  const [savedReq] = await sql.query(
    'SELECT currency, cost_centre, ship_to_location_id, supplier_id FROM purchase_requisitions WHERE request_id = $1', [requestId]);

  check('the line has an ordinal, not just an id', () => {
    if (savedLine?.line_number == null) throw new Error('line_number is null — cXML ItemOut requires one');
  });
  check('it carries the supplier part number', () => {
    if (!savedLine?.supplier_part_id) throw new Error('SupplierPartID is mandatory and absent');
  });
  check('it carries a unit-of-measure code, not just a word', () => {
    if (!savedLine?.unit_of_measure_code) throw new Error('no UN/CEFACT code');
    if (String(savedLine.unit_of_measure_code).length > 4) {
      throw new Error(`"${savedLine.unit_of_measure_code}" looks like a display word, not a code`);
    }
  });
  check('it carries a commodity classification', () => {
    if (!savedLine?.commodity_code) throw new Error('no UNSPSC to classify the line');
  });

  const readiness = orderReadiness(
    { currency: savedReq?.currency, supplierId: savedReq?.supplier_id,
      costCentre: savedReq?.cost_centre, shipToLocationId: savedReq?.ship_to_location_id },
    [{ lineNumber: savedLine?.line_number, description: savedLine?.description,
       quantity: Number(savedLine?.quantity), unitPrice: Number(savedLine?.unit_price),
       supplierPartId: savedLine?.supplier_part_id, unitOfMeasureCode: savedLine?.unit_of_measure_code,
       commodityCode: savedLine?.commodity_code }]);
  check('the order reports itself ready to hand off', () => {
    if (!readiness.ready) throw new Error(readiness.gaps.map((g) => `${g.line ?? 'order'}/${g.field}`).join(', '));
  });

  const [savedPo] = await sql.query('SELECT owner_id FROM purchase_orders WHERE request_id = $1', [requestId]);
  check('the purchase order has an owner', () => {
    if (!savedPo?.owner_id) throw new Error('unassigned — there was no owner concept at all before');
  });

  console.log('\n   The readiness rule on its own');
  check('a line with no part number is not ready', () => {
    const result = orderReadiness({ currency: 'EUR', supplierId: 'S', costCentre: 'C', shipToLocationId: 'L' },
      [{ lineNumber: 1, description: 'x', quantity: 1, unitPrice: 1, unitOfMeasureCode: 'EA', commodityCode: '44000000' }]);
    if (result.ready) throw new Error('a missing SupplierPartID passed');
  });
  check('a line with a zero quantity is not ready', () => {
    const result = orderReadiness({ currency: 'EUR', supplierId: 'S', costCentre: 'C', shipToLocationId: 'L' },
      [{ lineNumber: 1, description: 'x', quantity: 0, unitPrice: 1, supplierPartId: 'P', unitOfMeasureCode: 'EA', commodityCode: '4' }]);
    if (result.ready) throw new Error('a zero quantity passed');
  });
  check('a zero unit price is allowed', () => {
    // A free line is a real thing; a missing price is not.
    const result = orderReadiness({ currency: 'EUR', supplierId: 'S', costCentre: 'C', shipToLocationId: 'L' },
      [{ lineNumber: 1, description: 'x', quantity: 1, unitPrice: 0, supplierPartId: 'P', unitOfMeasureCode: 'EA', commodityCode: '4' }]);
    if (!result.ready) throw new Error(result.gaps.map((g) => g.field).join(', '));
  });

  console.log('\n5. Every stage after this one has somebody who can leave it');

  const { readFileSync } = await import('node:fs');
  const actions = readFileSync(new URL('../../src/features/requests/request-detail/components/action-buttons.tsx', import.meta.url), 'utf8');
  for (const stage of ['contracting', 'receipt', 'invoice', 'payment']) {
    check(`${stage} has an advancer`, () => {
      if (!new RegExp(`\\b${stage}:\\s*\\[`).test(actions)) {
        throw new Error('no role can leave this stage, so the button never renders');
      }
    });
  }
  check('po is deliberately not one of them', () => {
    if (/\bpo:\s*\[/.test(actions)) throw new Error('po should be advanced by a receipt, not a button');
  });
} finally {
  await cleanup();
}

if (failures > 0) { console.error(`\nrequest-lifecycle-e2e: ${failures} check(s) failed.`); process.exit(1); }
console.log('\nRequest lifecycle end-to-end checks passed.');
