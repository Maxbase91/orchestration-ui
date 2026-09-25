#!/usr/bin/env node
// The Status Answers agent: what may be said about each object, to whom.
//
// Holds the decisions taken on 2026-09-25: every attribute of the data model
// has an entry (a new one appears switched off, and this suite fails until it
// has an entry in the defaults); per attribute a label, summary vs on-ask, and
// who may see it; per role × object None / Own / All; and one composer shared
// by the Home box, the browser assistant and api/chat.ts.
//
// Run: npm run test:status-agent
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { loadEnv } from '../lib/live.mjs';
import {
  DEFAULT_STATUS_CONFIG, STATUS_OBJECTS, statusConfigFromStored, mergeDiscoveredAttributes, accessFor, canSeeAttribute,
} from '../../src/lib/assistant/status-config.ts';
import {
  parseStatusQuestion, askedAttributes, ownershipFor, isOwn, deriveAttributes, composeItem, mayAnswer, formatStatusValue,
} from '../../src/lib/assistant/status-answer.ts';
import { workflowTemplates } from '../../src/data/workflows.ts';
import {
  mapDbToRequest, mapDbToPurchaseOrder, mapDbToInvoice, mapDbToContract, mapDbToSupplier, mapDbToApproval,
} from '../../src/lib/db/mappers.ts';

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}
const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');

// ── Every attribute of the data model has an entry ──────────────────────────
console.log('Every attribute of the data model is listed');
const TYPES = read('src/data/types.ts');
const fieldsOf = (name) => {
  const m = TYPES.match(new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`));
  return m ? [...m[1].matchAll(/^ {2}(\w+)\??:/gm)].map((x) => x[1]) : [];
};
const INTERFACE = {
  request: 'ProcurementRequest', 'purchase-order': 'PurchaseOrder', invoice: 'Invoice',
  contract: 'Contract', supplier: 'Supplier', approval: 'ApprovalEntry',
};
for (const object of STATUS_OBJECTS) {
  const fields = fieldsOf(INTERFACE[object]);
  const keys = new Set(DEFAULT_STATUS_CONFIG.objects[object].map((a) => a.key));
  const missing = fields.filter((f) => !keys.has(f));
  check(`${object}: every field of ${INTERFACE[object]} has an entry (${fields.length} fields)`, fields.length > 0 && missing.length === 0, missing.join(', '));
  const stray = DEFAULT_STATUS_CONFIG.objects[object].filter((a) => !a.derived && !fields.includes(a.key)).map((a) => a.key);
  check(`${object}: no entry names a field that does not exist`, stray.length === 0, stray.join(', '));
}

console.log('\nA new attribute appears switched off');
const merged = mergeDiscoveredAttributes(DEFAULT_STATUS_CONFIG, 'invoice', ['status', 'paymentReference']);
const added = merged.config.objects.invoice.find((a) => a.key === 'paymentReference');
check('it is listed, labelled from its name', merged.added.join() === 'paymentReference' && added?.label === 'Payment reference');
check('…and answers nothing until enabled', added?.mode === 'off' && added.visibility === 'procurement');

console.log('\nThe stored configuration is read defensively');
const stored = statusConfigFromStored({
  objects: { invoice: [{ key: 'dueDate', label: 'Payment due', mode: 'bogus', visibility: 'everyone' }, { key: '' }, 'junk'] },
  access: { 'service-owner': { invoice: 'all', request: 'everything' } },
});
const due = stored.objects.invoice.find((a) => a.key === 'dueDate');
check('an admin label is kept', due?.label === 'Payment due');
check('an unknown mode falls back to the default', due?.mode === 'summary');
check('attributes the row does not mention keep their defaults', stored.objects.invoice.length === DEFAULT_STATUS_CONFIG.objects.invoice.length);
check('a valid access cell is kept, an invalid one defaulted',
  stored.access['service-owner'].invoice === 'all' && stored.access['service-owner'].request === 'own');
check('an empty row is the defaults', JSON.stringify(statusConfigFromStored(null)) === JSON.stringify(DEFAULT_STATUS_CONFIG));

// ── The question ─────────────────────────────────────────────────────────────
console.log('\nWhat was asked');
const q = (t) => parseStatusQuestion(t);
check('an id names the record', q('where is REQ-2026-00012?')?.id === 'REQ-2026-00012' && q('where is REQ-2026-00012?')?.object === 'request');
check('a PO id', q('status of PO-2025-001')?.object === 'purchase-order');
check('an invoice id', q('when is INV-0042 due')?.object === 'invoice');
check('a contract id', q('when does CON-003 expire?')?.object === 'contract');
check('"what is waiting for me" is my approvals', q("what's waiting for me?")?.object === 'approval' && q("what's waiting for me?")?.mine);
check('"my open requests" is my requests', q('show my open requests')?.object === 'request');
check('"is Acme onboarded" names a supplier', q('is Acme Consulting onboarded?')?.name === 'Acme Consulting');
check('a demand is not a status question', q('I need a laptop for a new joiner') === null);
check('a policy question is not a status question', q('do I need three quotes for €40,000?') === null);
const inv = DEFAULT_STATUS_CONFIG.objects.invoice;
check('"due date" asks for the due date', askedAttributes('due date of INV-001', inv).has('dueDate'));
check('"expire" asks for "Expires in"', askedAttributes('when does CON-003 expire', DEFAULT_STATUS_CONFIG.objects.contract).has('expiresIn'));
check('"paid" asks for "Paid on"', askedAttributes('was INV-001 paid?', inv).has('paidDate'));

// ── Whose record ─────────────────────────────────────────────────────────────
console.log('\nOwn means the person’s own');
const requests = [
  { id: 'REQ-1', requestorId: 'u6', ownerId: 'u1', supplierId: 'SUP-1' },
  { id: 'REQ-2', requestorId: 'u9', beneficiaryId: 'u6', ownerId: 'u1' },
  { id: 'REQ-3', requestorId: 'u9', ownerId: 'u1', supplierId: 'SUP-3' },
];
const pos = [{ id: 'PO-1', requestId: 'REQ-1', supplierId: 'SUP-1' }, { id: 'PO-3', requestId: 'REQ-3', supplierId: 'SUP-3' }];
const own = ownershipFor('u6', requests, pos);
check('a request you raised, or are buying for', own.ownRequestIds.has('REQ-1') && own.ownRequestIds.has('REQ-2') && !own.ownRequestIds.has('REQ-3'));
check('a PO off it', isOwn('purchase-order', pos[0], own) && !isOwn('purchase-order', pos[1], own));
check('an invoice on that PO', isOwn('invoice', { poId: 'PO-1' }, own) && !isOwn('invoice', { poId: 'PO-3' }, own));
check('its supplier', isOwn('supplier', { id: 'SUP-1' }, own) && !isOwn('supplier', { id: 'SUP-3' }, own));
check('a contract linked to it', isOwn('contract', { linkedRequestIds: ['REQ-2'] }, own) && !isOwn('contract', { linkedRequestIds: ['REQ-3'] }, own));
check('an approval assigned to you', isOwn('approval', { approverId: 'u6' }, own));

console.log('\nThe access matrix gates every answer');
const cfg = DEFAULT_STATUS_CONFIG;
check('requesters: Own', accessFor(cfg, 'service-owner', 'request') === 'own');
check('procurement: All', accessFor(cfg, 'procurement-manager', 'invoice') === 'all');
check('the external supplier role: None', STATUS_OBJECTS.every((o) => accessFor(cfg, 'supplier', o) === 'none'));
check('Own refuses someone else’s record', !mayAnswer(cfg, 'service-owner', 'request', requests[2], own));
check('Own answers your own', mayAnswer(cfg, 'service-owner', 'request', requests[0], own));
check('All answers anyone’s', mayAnswer(cfg, 'procurement-manager', 'request', requests[2], null));
check('None refuses even your own', !mayAnswer(cfg, 'supplier', 'request', requests[0], own));

// ── The answer ───────────────────────────────────────────────────────────────
console.log('\nThe answer says what the configuration allows');
const req = {
  id: 'REQ-1', title: 'Finance close consulting', status: 'validation', buyingChannel: 'procurement-led',
  workflowTemplateId: 'WF-001', daysInStage: 2, ownerId: 'u1', requestorId: 'u6', supplierId: 'SUP-1',
  value: 180000, currency: 'EUR', approvalChain: 'chain-3', costCentre: 'CC-FIN-210',
};
const data = {
  users: [{ id: 'u1', name: 'Anna Müller' }, { id: 'u6', name: "James O'Brien" }],
  suppliers: [{ id: 'SUP-1', name: 'Acme' }],
  templates: workflowTemplates,
  approvals: [{ requestId: 'REQ-1', status: 'pending', stepOrder: 1, approverName: 'Christine Dupont', approverRole: 'Budget Owner' }],
  requestTitles: {},
};
const enriched = { ...req, ...deriveAttributes('request', req, data) };
check('time against the stage target comes from the workflow template', /^Day 2 of a 3-day target$/.test(enriched.stageTarget ?? ''), enriched.stageTarget);
check('the next stage follows the channel’s lifecycle', typeof enriched.nextStage === 'string' && enriched.nextStage.length > 0, enriched.nextStage);
check('ids become names', enriched.ownerName === 'Anna Müller' && enriched.supplierName === 'Acme');
check('the pending approver is named', enriched.pendingApprovers?.[0] === 'Christine Dupont (Budget Owner)');
const summary = composeItem('request', enriched, cfg, 'service-owner');
const labels = summary.facts.map((f) => f.label);
check('the default answer is the summary attributes', labels.includes('Stage') && labels.includes('With') && labels.includes('Time in stage') && !labels.includes('Value'), labels.join(', '));
check('the title is not repeated as a fact', !labels.includes('Title') && summary.title === 'REQ-1 · Finance close consulting');
const askedValue = composeItem('request', enriched, cfg, 'service-owner', new Set(['value', 'approvalChain']));
check('an on-ask attribute is answered when asked', askedValue.facts.some((f) => f.label === 'Value' && f.value === '€180,000'));
check('…but a procurement-only one is not, to a requester', !askedValue.facts.some((f) => f.label === 'Approval chain'));
check('…and is, to procurement', composeItem('request', enriched, cfg, 'procurement-manager', new Set(['approvalChain'])).facts.some((f) => f.label === 'Approval chain'));
const offCfg = { ...cfg, objects: { ...cfg.objects, request: cfg.objects.request.map((a) => (a.key === 'status' ? { ...a, mode: 'off' } : a)) } };
check('an attribute switched off is never said', !composeItem('request', enriched, offCfg, 'admin').facts.some((f) => f.key === 'status'));
check('an admin label is what the chatbot says',
  composeItem('request', enriched, { ...cfg, objects: { ...cfg.objects, request: cfg.objects.request.map((a) => (a.key === 'status' ? { ...a, label: 'Current step' } : a)) } }, 'admin').facts.some((f) => f.label === 'Current step'));
check('visibility follows the role', !canSeeAttribute({ key: 'x', label: 'x', mode: 'ask', visibility: 'procurement' }, 'service-owner'));
check('values read as words', formatStatusValue('status', 'referred-back', {}) === 'Referred back' && formatStatusValue('isUrgent', true, {}) === 'Yes');

console.log('\nOne configuration, every surface');
check('the browser assistant answers lookups through the agent', /answerStatusQuestion\(/.test(read('src/lib/assistant/capabilities/lookup.ts')));
const chat = read('api/chat.ts');
check('the server lookups go through the agent, with the role', /statusLookup\(db, await loadStatusContext\(db, userId, role\)/.test(chat));
check('the server lists are projected through it', (chat.match(/await project\('/g) ?? []).length === 5);
check('no hand-picked column list is left in the server lookups',
  !/select\('id, title, status, priority, value, requestor_id/.test(chat) && !/select\('id, supplier_name, amount, status, due_date/.test(chat));
check('the agent page has the configuration and a real test',
  /StatusAgentConfigPanel/.test(read('src/features/admin/ai-agents/ai-agents-page.tsx')) && /answerStatusQuestion/.test(read('src/features/admin/ai-agents/components/status-agent-test-panel.tsx')));

const env = loadEnv();
const connection = env.NEON_DATABASE_URL || env.DATABASE_URL;
if (!connection) {
  console.log('\n  (skipped live checks — no database connection)');
} else {
  console.log('\nLive');
  const sql = neon(connection);
  const [agent] = await sql`SELECT id, status, config FROM ai_agents WHERE type = 'status'`;
  check('the Status Answers agent exists, active and configured', agent?.status === 'active' && agent.config !== null, JSON.stringify(agent?.id));
  // A column added to a table reaches the mapped record — and must have an entry.
  const config = statusConfigFromStored(agent?.config);
  const samples = {
    request: [mapDbToRequest, sql`SELECT * FROM requests_with_derived LIMIT 1`],
    'purchase-order': [mapDbToPurchaseOrder, sql`SELECT * FROM purchase_orders LIMIT 1`],
    invoice: [mapDbToInvoice, sql`SELECT * FROM invoices LIMIT 1`],
    contract: [mapDbToContract, sql`SELECT * FROM contracts_with_derived LIMIT 1`],
    supplier: [mapDbToSupplier, sql`SELECT * FROM suppliers_with_derived LIMIT 1`],
    approval: [mapDbToApproval, sql`SELECT * FROM approval_entries LIMIT 1`],
  };
  for (const [object, [map, rowsPromise]] of Object.entries(samples)) {
    const [row] = await rowsPromise;
    if (!row) continue;
    const known = new Set(config.objects[object].map((a) => a.key));
    const unlisted = Object.keys(map(row)).filter((k) => !known.has(k));
    check(`${object}: every attribute a live record carries has an entry`, unlisted.length === 0, unlisted.join(', '));
  }
}

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s) failed`); process.exit(1); }
console.log('All status-agent checks passed.');
