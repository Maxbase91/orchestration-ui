#!/usr/bin/env node
// A catalogue basket becomes one order per supplier and contract, and approval
// is judged on the basket's total.
//
// Door 2 of the Intake Prototype orders a basket that can span suppliers, while
// an order — request, requisition, PO — has one supplier and one contract. So
// the basket is placed as several orders; and a €1,500 basket split into €800
// and €700 must still be the €1,500 decision it is, or splitting would be a way
// round the auto-approval threshold. The planner is pure and driven directly;
// the server half runs against the live store with its own cleanup.
//
// Run: npm run test:catalogue-basket
import { planBasket, basketPayloads, basketOrderTitle } from '../../src/lib/procurement/catalogue-basket.ts';
import { DEFAULT_POLICY_CONFIG } from '../../src/lib/procurement/policy-config.ts';
import { neon } from '@neondatabase/serverless';
import { loadEnv } from '../lib/live.mjs';

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures += 1; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

const NOW = new Date('2026-09-25');
const contract = (id, supplierId) => ({ id, supplierId, status: 'active', startDate: '2026-01-01', endDate: '2027-12-31', value: 100000, utilisationPercentage: 10, title: id });
const supplier = (id) => ({ id, name: `Supplier ${id}`, screeningStatus: 'clear' });
const item = (id, supplierId, contractId, unitPrice) => ({ id, name: `Item ${id}`, unitPrice, unit: 'each', supplierId, contractId, riskAssessmentId: `RA-${supplierId}`, commodityCode: '44121600', available: true });
const risk = (supplierId) => ({ id: `RA-${supplierId}`, supplierId, contractId: undefined, status: 'completed', validUntil: '2027-12-31' });
const DATA = {
  items: [item('A1', 'S-A', 'C-A', 800), item('A2', 'S-A', 'C-A', 50), item('B1', 'S-B', 'C-B', 700), item('X1', 'S-X', 'C-GONE', 10), item('OFF', 'S-A', 'C-A', 5)],
  suppliers: [supplier('S-A'), supplier('S-B'), supplier('S-X')],
  contracts: [contract('C-A', 'S-A'), contract('C-B', 'S-B')],
  riskAssessments: [risk('S-A'), risk('S-B')],
};
DATA.items[4].available = false;

console.log('A basket is one order per supplier and contract');
{
  const plan = planBasket([{ itemId: 'A1', quantity: 1 }, { itemId: 'B1', quantity: 1 }, { itemId: 'A2', quantity: 2 }], DATA, NOW);
  check('two suppliers make two orders', plan.orders.length === 2, plan.orders.map((o) => o.key).join(', '));
  check('lines from one supplier share its order', plan.orders.find((o) => o.supplier.id === 'S-A')?.lines.length === 2);
  check('the basket total is every line', plan.total === 800 + 100 + 700, String(plan.total));
  const unorderable = planBasket([{ itemId: 'X1', quantity: 1 }, { itemId: 'OFF', quantity: 1 }, { itemId: 'NOPE', quantity: 1 }], DATA, NOW);
  check('what cannot be ordered is said, not dropped', unorderable.orders.length === 0 && unorderable.problems.length === 3,
    unorderable.problems.map((p) => p.reason).join(' | '));
  check('an order reads as its items', basketOrderTitle(plan.orders.find((o) => o.supplier.id === 'S-A')) === 'Catalogue order: Item A1, Item A2 ×2');
}

console.log('\nApproval is judged on the basket, not on each order');
{
  const ctx = {
    requesterId: 'u1', profile: { userId: 'u1', costCentre: 'CC-1', budgetOwner: 'Budget Owner', accountType: 'expense', approvedShipToLocations: [], defaultShipToLocationId: 'LOC-1' },
    costCentre: 'CC-1', shipToLocationId: 'LOC-1', purpose: 'Office restock', currency: 'EUR',
    activeCostCentreIds: ['CC-1'], activeDeliveryLocationIds: ['LOC-1'], requestIds: ['REQ-1', 'REQ-2'], basketKey: 'K1',
  };
  const split = basketPayloads(planBasket([{ itemId: 'A1', quantity: 1 }, { itemId: 'B1', quantity: 1 }], DATA, NOW), ctx, DEFAULT_POLICY_CONFIG);
  check('€800 and €700 from two suppliers each go to approval', split.length === 2 && split.every((o) => o.decision.approvalRequired && o.decision.status === 'pending-approval'),
    split.map((o) => `${o.decision.totalValue}:${o.decision.status}`).join(', '));
  check('each order still carries its own value', split.map((o) => o.decision.totalValue).sort().join(',') === '700,800');
  const alone = basketPayloads(planBasket([{ itemId: 'A1', quantity: 1 }], DATA, NOW), { ...ctx, requestIds: ['REQ-3'] }, DEFAULT_POLICY_CONFIG);
  check('a lone €800 order is approved automatically', alone[0].decision.status === 'approved' && !alone[0].checkout.approvalBasisValue);
  check('a retry of the basket is the same orders', split.map((o) => o.checkout.idempotencyKey).join() === 'basket-K1-S-A|C-A,basket-K1-S-B|C-B');
}

// ── The server: one transaction, its own total ────────────────────────────
const env = loadEnv();
const connection = env.NEON_DATABASE_URL ?? env.DATABASE_URL;
if (!connection) {
  console.log('\n  (skipped live checks — no database connection)');
} else {
  console.log('\nThe server places the basket whole, on its own total');
  process.env.NEON_DATABASE_URL = connection;
  const sql = neon(connection);
  const { default: handler } = await import('../../api/governed-checkout.ts');
  const invoke = (body) => {
    let statusCode = 200; let responseBody;
    const res = { status(code) { statusCode = code; return res; }, json(value) { responseBody = value; return res; } };
    return Promise.resolve(handler({ method: 'POST', body }, res)).then(() => ({ statusCode, body: responseBody }));
  };
  const [policyRow] = await sql`SELECT config FROM procurement_policy_configs WHERE singleton_key = 'default'`;
  const threshold = Number(policyRow?.config?.catalogueAutoApprovalThreshold ?? DEFAULT_POLICY_CONFIG.catalogueAutoApprovalThreshold);
  const items = await sql`SELECT * FROM catalogue_items WHERE available IS DISTINCT FROM false AND risk_assessment_id IS NOT NULL AND contract_id IS NOT NULL ORDER BY unit_price DESC`;
  // Two items from different suppliers, each under the threshold, together over it.
  let pair = null;
  for (const a of items) for (const b of items) {
    if (!pair && a.supplier_id !== b.supplier_id && Number(a.unit_price) <= threshold && Number(b.unit_price) <= threshold && Number(a.unit_price) + Number(b.unit_price) > threshold) pair = [a, b];
  }
  const [user] = await sql`SELECT id, name FROM users ORDER BY id LIMIT 1`;
  const [cc] = await sql`SELECT id FROM cost_centres WHERE active = true ORDER BY sort_order LIMIT 1`;
  const [loc] = await sql`SELECT id FROM delivery_locations WHERE active = true ORDER BY sort_order LIMIT 1`;
  if (!pair || !user || !cc || !loc) {
    console.log('  (skipped — no two catalogue items from different suppliers straddle the threshold)');
  } else {
    const suffix = Date.now().toString(36);
    const ids = [`TEST-BASKET-${suffix}-1`, `TEST-BASKET-${suffix}-2`];
    const order = (it, requestId, key = `basket-${suffix}-${it.supplier_id}`) => ({
      requestId, requisitionId: `PR-${requestId}`,
      request: { id: requestId, title: `Basket test ${suffix}`, category: 'catalogue', requestorId: user.id, ownerId: user.id, buyingChannel: 'catalogue', costCentre: cc.id, budgetOwner: user.name },
      checkout: {
        route: 'catalogue', idempotencyKey: key, currency: 'EUR', purpose: 'Basket integration test',
        supplier: { id: it.supplier_id }, contract: { id: it.contract_id }, riskAssessment: { id: it.risk_assessment_id },
        profile: { userId: user.id, defaultCurrency: 'EUR', costCentre: cc.id, budgetOwner: user.name, accountType: 'expense', beneficiaryId: user.id, approvedShipToLocations: [], defaultShipToLocationId: loc.id },
        // A browser claiming a tiny basket must not decide anything.
        approvalBasisValue: 1,
      },
      lines: [{ id: `LINE-${requestId}`, requestId, description: it.name, quantity: 1, unit: it.unit, unitPrice: Number(it.unit_price), supplierId: it.supplier_id, contractId: it.contract_id, catalogueItemId: it.id, riskAssessmentId: it.risk_assessment_id }],
    });
    const basket = { basket: { orders: [order(pair[0], ids[0]), order(pair[1], ids[1])] } };
    try {
      const placed = await invoke(basket);
      check('the basket is placed as two orders', placed.statusCode === 200 && placed.body?.orders?.length === 2, JSON.stringify(placed.body).slice(0, 300));
      const reqs = await sql`SELECT id, status, approval_required FROM purchase_requisitions WHERE request_id = ANY(${ids})`;
      check('both go to approval: judged on the server\'s basket total, not the browser\'s',
        reqs.length === 2 && reqs.every((r) => r.approval_required === true && r.status === 'pending-approval'), JSON.stringify(reqs));
      const pos = await sql`SELECT id FROM purchase_orders WHERE request_id = ANY(${ids})`;
      check('no purchase order is raised before approval', pos.length === 0);
      const replay = await invoke(basket);
      check('placing the same basket again returns the same orders', replay.statusCode === 200 && replay.body?.orders?.map((o) => o.requestId).sort().join() === ids.join(), JSON.stringify(replay.body).slice(0, 200));
      // One order already placed, one genuinely new (its own id and key).
      const partial = await invoke({ basket: { orders: [basket.basket.orders[0], order(pair[1], `TEST-BASKET-${suffix}-3`, `basket-${suffix}-new`)] } });
      check('a basket only part of which exists is refused, not completed in part', partial.statusCode === 409 && partial.body?.code === 'basket_partially_placed', JSON.stringify(partial.body));
      const reused = await invoke({ basket: { orders: [basket.basket.orders[0], order(pair[1], `TEST-BASKET-${suffix}-3`)] } });
      check('a key reused for a different order is refused', reused.statusCode === 409 && reused.body?.code === 'idempotency_conflict', JSON.stringify(reused.body));
    } finally {
      const all = [...ids, `TEST-BASKET-${suffix}-3`];
      await sql`DELETE FROM approval_entries WHERE request_id = ANY(${all})`;
      await sql`DELETE FROM purchase_orders WHERE request_id = ANY(${all})`;
      await sql`DELETE FROM request_lines WHERE request_id = ANY(${all})`;
      await sql`DELETE FROM purchase_requisitions WHERE request_id = ANY(${all})`;
      const removed = await sql`DELETE FROM requests WHERE id = ANY(${all}) RETURNING id`;
      check('the test orders are removed', removed.length === 2, `${removed.length} removed`);
    }
  }
}

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exit(1); }
console.log('All catalogue-basket checks passed.');
