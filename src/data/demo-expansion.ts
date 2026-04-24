// Extra seed rows that fill the live dashboards/KPI widgets. Concatenated
// into the regular seed arrays by api/admin/seed.ts so re-runs are
// idempotent (Supabase upserts on id).
//
// Design goals:
//   - 20 new requests across 2025-02 → 2026-03, mix of channels and
//     stages so the pipeline funnel and stage cycle-time chart both
//     have volume.
//   - 2 completed requests with refer_back_count > 0 so the First-Time-
//     Right rate is believable (not 100%).
//   - 40 new invoices spread across 14 months so the monthly-spend
//     chart has a full trend line and managed % varies.
//   - 30 comments, ~30 % of which @-mention somebody so the Mentions
//     widget has unread content.
//   - 3 info-requested approval entries so the Activity tab and the
//     stepper ❓ badge both fire.

import type { ProcurementRequest, StageHistoryEntry, Invoice, Comment, ApprovalEntry, PurchaseOrder } from './types';

// ── Helpers ─────────────────────────────────────────────────────────

const CHANNEL_STAGES: Record<string, string[]> = {
  catalogue:            ['draft', 'intake', 'po', 'receipt', 'invoice', 'payment'],
  'direct-po':          ['draft', 'intake', 'validation', 'approval', 'po', 'receipt', 'invoice', 'payment'],
  'business-led':       ['draft', 'intake', 'validation', 'approval', 'po', 'receipt', 'invoice', 'payment'],
  'framework-call-off': ['draft', 'intake', 'validation', 'approval', 'po', 'receipt', 'invoice', 'payment'],
  'procurement-led':    ['draft', 'intake', 'validation', 'approval', 'sourcing', 'contracting', 'po', 'receipt', 'invoice', 'payment'],
};

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();
}

/** Generate a stage_history row sequence for a request, stopping at the
 *  request's current status. Stages skipped by the channel are omitted. */
function historyForRequest(
  r: Pick<ProcurementRequest, 'id' | 'ownerId' | 'status' | 'buyingChannel' | 'createdAt'>,
  daysPerStage: Partial<Record<string, number>> = {},
): StageHistoryEntry[] {
  const stages = CHANNEL_STAGES[r.buyingChannel] ?? CHANNEL_STAGES['procurement-led'];
  const endIdx = stages.indexOf(r.status);
  if (endIdx < 0) return []; // unknown status — skip
  const out: StageHistoryEntry[] = [];
  let cursor = r.createdAt;
  const DEFAULT: Record<string, number> = {
    draft: 0, intake: 2, validation: 4, approval: 3,
    sourcing: 14, contracting: 10, po: 2, receipt: 20, invoice: 5, payment: 2,
  };
  for (let i = 0; i <= endIdx; i++) {
    const stage = stages[i];
    const isLast = i === endIdx;
    const isCompletedLifecycle = r.status === 'completed' || r.status === 'cancelled';
    const dur = daysPerStage[stage] ?? DEFAULT[stage] ?? 3;
    const enteredAt = cursor;
    const completedAt = !isLast || isCompletedLifecycle ? addDays(cursor, dur) : undefined;
    out.push({
      requestId: r.id,
      stage: stage as StageHistoryEntry['stage'],
      enteredAt,
      completedAt,
      ownerId: r.ownerId,
      action: isLast && !isCompletedLifecycle ? undefined : stage === 'draft' ? 'submitted' : stage,
    });
    if (completedAt) cursor = completedAt;
  }
  return out;
}

// ── Requests ────────────────────────────────────────────────────────
// IDs REQ-2025-0101 through REQ-2025-0120 (safe from existing 0001-0035).

const REQS_SPEC: Array<Pick<ProcurementRequest,
  'id' | 'title' | 'description' | 'category' | 'status' | 'priority' |
  'value' | 'currency' | 'requestorId' | 'ownerId' | 'supplierId' |
  'contractId' | 'poId' | 'buyingChannel' | 'commodityCode' |
  'commodityCodeLabel' | 'costCentre' | 'budgetOwner' |
  'businessJustification' | 'deliveryDate' | 'isUrgent' |
  'createdAt' | 'updatedAt' | 'daysInStage' | 'isOverdue' | 'referBackCount'
>> = [
  // 6 completed procurement-led services across 2025-02..2026-01
  { id: 'REQ-2025-0101', title: 'Cyber security consulting — Q2 engagement', description: 'Deloitte penetration testing + gap analysis.',
    category: 'consulting', status: 'completed', priority: 'medium', value: 185000, currency: 'EUR',
    requestorId: 'u5', ownerId: 'u4', supplierId: 'SUP-003', poId: 'PO-101',
    buyingChannel: 'procurement-led', commodityCode: '81112200', commodityCodeLabel: 'Information security services',
    costCentre: 'CC-IT-002', budgetOwner: 'Sarah Chen',
    businessJustification: 'Annual ISO 27001 audit preparation.',
    deliveryDate: '2025-05-15', isUrgent: false,
    createdAt: '2025-02-03T09:00:00Z', updatedAt: '2025-04-28T16:00:00Z',
    daysInStage: 0, isOverdue: false, referBackCount: 0 },
  { id: 'REQ-2025-0102', title: 'CRM platform renewal', description: 'Salesforce Enterprise — 500 seats.',
    category: 'software', status: 'completed', priority: 'high', value: 420000, currency: 'EUR',
    requestorId: 'u6', ownerId: 'u3', supplierId: 'SUP-007', contractId: 'CON-008', poId: 'PO-102',
    buyingChannel: 'framework-call-off', commodityCode: '43231512', commodityCodeLabel: 'CRM software',
    costCentre: 'CC-COM-001', budgetOwner: 'Marcus Johnson',
    businessJustification: 'Annual SaaS renewal.',
    deliveryDate: '2025-04-01', isUrgent: false,
    createdAt: '2025-02-18T10:00:00Z', updatedAt: '2025-03-20T14:00:00Z',
    daysInStage: 0, isOverdue: false, referBackCount: 0 },
  { id: 'REQ-2025-0103', title: 'Marketing agency retainer — brand refresh',
    description: 'WPP creative + media planning for Q2 launch.',
    category: 'services', status: 'completed', priority: 'medium', value: 260000, currency: 'EUR',
    requestorId: 'u6', ownerId: 'u4', supplierId: 'SUP-011', poId: 'PO-103',
    buyingChannel: 'procurement-led', commodityCode: '82101500', commodityCodeLabel: 'Advertising services',
    costCentre: 'CC-MKT-001', budgetOwner: "James O'Brien",
    businessJustification: 'Spring campaign needs expanded reach.',
    deliveryDate: '2025-06-30', isUrgent: false,
    createdAt: '2025-03-05T09:00:00Z', updatedAt: '2025-06-20T12:00:00Z',
    daysInStage: 0, isOverdue: false, referBackCount: 1 },
  { id: 'REQ-2025-0104', title: 'ERP upgrade — SAP S/4HANA Cloud',
    description: 'Migration from on-prem to Cloud edition.',
    category: 'software', status: 'completed', priority: 'high', value: 1450000, currency: 'EUR',
    requestorId: 'u5', ownerId: 'u3', supplierId: 'SUP-002', contractId: 'CON-002', poId: 'PO-104',
    buyingChannel: 'procurement-led', commodityCode: '43232300', commodityCodeLabel: 'ERP software',
    costCentre: 'CC-IT-003', budgetOwner: 'Sarah Chen',
    businessJustification: 'Mandatory platform refresh by 2026.',
    deliveryDate: '2025-09-30', isUrgent: false,
    createdAt: '2025-04-02T09:00:00Z', updatedAt: '2025-09-10T18:00:00Z',
    daysInStage: 0, isOverdue: false, referBackCount: 0 },
  { id: 'REQ-2025-0105', title: 'Office supplies Q2 restock',
    description: 'Catalogue order for stationery across 3 sites.',
    category: 'goods', status: 'completed', priority: 'low', value: 4200, currency: 'EUR',
    requestorId: 'u9', ownerId: 'u9', supplierId: 'SUP-CAT-007',
    buyingChannel: 'catalogue', commodityCode: '44121600', commodityCodeLabel: 'Paper and desk accessories',
    costCentre: 'CC-OPS-001', budgetOwner: 'Lisa Nakamura',
    businessJustification: 'Quarterly restock.',
    deliveryDate: '2025-04-20', isUrgent: false,
    createdAt: '2025-04-10T09:00:00Z', updatedAt: '2025-04-14T12:00:00Z',
    daysInStage: 0, isOverdue: false, referBackCount: 0 },
  { id: 'REQ-2025-0106', title: 'Contingent workforce — Java developers (Q3)',
    description: '8 senior Java devs for platform re-architecture.',
    category: 'contingent-labour', status: 'completed', priority: 'high', value: 960000, currency: 'EUR',
    requestorId: 'u5', ownerId: 'u1', supplierId: 'SUP-013', contractId: 'CON-006', poId: 'PO-106',
    buyingChannel: 'framework-call-off', commodityCode: '80121605', commodityCodeLabel: 'IT staffing',
    costCentre: 'CC-IT-004', budgetOwner: 'Sarah Chen',
    businessJustification: 'Q3 delivery milestones require augmentation.',
    deliveryDate: '2025-07-01', isUrgent: false,
    createdAt: '2025-05-12T09:00:00Z', updatedAt: '2025-06-25T15:00:00Z',
    daysInStage: 0, isOverdue: false, referBackCount: 2 },

  // 4 completed catalogue + framework orders (fast path, small volume)
  { id: 'REQ-2025-0107', title: 'MacBook Pro 16" — Finance team',
    description: '5 units for Finance.', category: 'goods', status: 'completed', priority: 'medium',
    value: 18500, currency: 'EUR', requestorId: 'u7', ownerId: 'u7',
    supplierId: 'SUP-CAT-001', buyingChannel: 'catalogue',
    commodityCode: '43211500', commodityCodeLabel: 'Laptop computers',
    costCentre: 'CC-FIN-001', budgetOwner: 'Dr. Katrin Bauer',
    businessJustification: 'Hardware refresh.', deliveryDate: '2025-07-10', isUrgent: false,
    createdAt: '2025-06-28T09:00:00Z', updatedAt: '2025-07-05T09:00:00Z',
    daysInStage: 0, isOverdue: false, referBackCount: 0 },
  { id: 'REQ-2025-0108', title: 'Office furniture — Amsterdam office',
    description: 'Standing desks and chairs for 40-seat expansion.',
    category: 'goods', status: 'completed', priority: 'medium', value: 82000, currency: 'EUR',
    requestorId: 'u10', ownerId: 'u1', supplierId: 'SUP-CAT-009', contractId: 'CON-015', poId: 'PO-108',
    buyingChannel: 'framework-call-off', commodityCode: '56101500', commodityCodeLabel: 'Office furniture',
    costCentre: 'CC-OPS-002', budgetOwner: 'David Kowalski',
    businessJustification: 'Amsterdam office expansion.', deliveryDate: '2025-09-15', isUrgent: false,
    createdAt: '2025-07-18T09:00:00Z', updatedAt: '2025-09-12T10:00:00Z',
    daysInStage: 0, isOverdue: false, referBackCount: 0 },
  { id: 'REQ-2025-0109', title: 'Catering services Q3', description: 'Daily lunches, 3 sites.',
    category: 'services', status: 'completed', priority: 'low', value: 64000, currency: 'EUR',
    requestorId: 'u9', ownerId: 'u1', supplierId: 'SUP-012', contractId: 'CON-012', poId: 'PO-109',
    buyingChannel: 'framework-call-off', commodityCode: '93141808', commodityCodeLabel: 'Catering services',
    costCentre: 'CC-OPS-003', budgetOwner: 'Lisa Nakamura',
    businessJustification: 'Q3 catering refresh.', deliveryDate: '2025-08-01', isUrgent: false,
    createdAt: '2025-07-05T09:00:00Z', updatedAt: '2025-07-28T14:00:00Z',
    daysInStage: 0, isOverdue: false, referBackCount: 0 },
  { id: 'REQ-2025-0110', title: 'Cloud infrastructure Q4 burst',
    description: 'AWS credits top-up for end-of-year workloads.',
    category: 'software', status: 'completed', priority: 'high', value: 320000, currency: 'EUR',
    requestorId: 'u5', ownerId: 'u3', supplierId: 'SUP-006', contractId: 'CON-009', poId: 'PO-110',
    buyingChannel: 'framework-call-off', commodityCode: '81112200', commodityCodeLabel: 'Cloud services',
    costCentre: 'CC-IT-005', budgetOwner: 'Sarah Chen',
    businessJustification: 'Peak-season compute needs.', deliveryDate: '2025-11-01', isUrgent: false,
    createdAt: '2025-09-20T09:00:00Z', updatedAt: '2025-10-25T12:00:00Z',
    daysInStage: 0, isOverdue: false, referBackCount: 0 },

  // 6 in-flight across various stages (gives the pipeline funnel volume)
  { id: 'REQ-2025-0111', title: 'BI tooling evaluation — Power BI Premium',
    description: 'Platform pilot.', category: 'software', status: 'sourcing',
    priority: 'medium', value: 240000, currency: 'EUR',
    requestorId: 'u5', ownerId: 'u3', supplierId: 'SUP-007',
    buyingChannel: 'procurement-led', commodityCode: '43232300', commodityCodeLabel: 'BI software',
    costCentre: 'CC-IT-006', budgetOwner: 'Sarah Chen',
    businessJustification: 'Replaces ageing legacy tool.', deliveryDate: '2026-03-01', isUrgent: false,
    createdAt: '2025-11-10T09:00:00Z', updatedAt: '2026-02-14T10:00:00Z',
    daysInStage: 18, isOverdue: false, referBackCount: 0 },
  { id: 'REQ-2025-0112', title: 'Tax advisory — transfer pricing',
    description: 'KPMG engagement.', category: 'consulting', status: 'approval',
    priority: 'medium', value: 115000, currency: 'EUR',
    requestorId: 'u7', ownerId: 'u4', supplierId: 'SUP-004',
    buyingChannel: 'procurement-led', commodityCode: '84111602', commodityCodeLabel: 'Tax advisory',
    costCentre: 'CC-FIN-002', budgetOwner: 'Dr. Katrin Bauer',
    businessJustification: 'Q1 transfer-pricing compliance.', deliveryDate: '2026-06-30', isUrgent: false,
    createdAt: '2026-01-14T09:00:00Z', updatedAt: '2026-03-15T10:00:00Z',
    daysInStage: 12, isOverdue: false, referBackCount: 0 },
  { id: 'REQ-2025-0113', title: 'Facilities cleaning RFP',
    description: 'Multi-site cleaning tender.', category: 'services', status: 'sourcing',
    priority: 'low', value: 420000, currency: 'EUR',
    requestorId: 'u10', ownerId: 'u1', supplierId: undefined,
    buyingChannel: 'procurement-led', commodityCode: '76111501', commodityCodeLabel: 'Cleaning services',
    costCentre: 'CC-OPS-004', budgetOwner: 'David Kowalski',
    businessJustification: 'Incumbent contract expires.', deliveryDate: '2026-07-01', isUrgent: false,
    createdAt: '2025-12-02T09:00:00Z', updatedAt: '2026-03-20T10:00:00Z',
    daysInStage: 22, isOverdue: true, referBackCount: 0 },
  { id: 'REQ-2025-0114', title: 'HR software renewal — Workday',
    description: 'Annual SaaS renewal.', category: 'software', status: 'validation',
    priority: 'medium', value: 190000, currency: 'EUR',
    requestorId: 'u11', ownerId: 'u3', supplierId: undefined,
    buyingChannel: 'procurement-led', commodityCode: '43232300', commodityCodeLabel: 'HR software',
    costCentre: 'CC-HR-001', budgetOwner: 'Christine Dupont',
    businessJustification: 'HRIS renewal.', deliveryDate: '2026-05-01', isUrgent: false,
    createdAt: '2026-02-01T09:00:00Z', updatedAt: '2026-04-05T10:00:00Z',
    daysInStage: 8, isOverdue: false, referBackCount: 0 },
  { id: 'REQ-2025-0115', title: 'Office supplies Q2 restock — Munich',
    description: 'Catalogue order.', category: 'goods', status: 'po',
    priority: 'low', value: 3800, currency: 'EUR',
    requestorId: 'u10', ownerId: 'u10', supplierId: 'SUP-CAT-007',
    buyingChannel: 'catalogue', commodityCode: '44121600', commodityCodeLabel: 'Stationery',
    costCentre: 'CC-OPS-005', budgetOwner: 'David Kowalski',
    businessJustification: 'Quarterly restock.', deliveryDate: '2026-04-25', isUrgent: false,
    createdAt: '2026-04-08T09:00:00Z', updatedAt: '2026-04-10T10:00:00Z',
    daysInStage: 2, isOverdue: false, referBackCount: 0 },
  { id: 'REQ-2025-0116', title: 'Audit services — year-end 2026',
    description: 'External audit engagement.', category: 'consulting', status: 'contracting',
    priority: 'high', value: 680000, currency: 'EUR',
    requestorId: 'u7', ownerId: 'u4', supplierId: 'SUP-003',
    buyingChannel: 'procurement-led', commodityCode: '84111502', commodityCodeLabel: 'Audit services',
    costCentre: 'CC-FIN-003', budgetOwner: 'Dr. Katrin Bauer',
    businessJustification: 'Statutory audit.', deliveryDate: '2026-12-31', isUrgent: false,
    createdAt: '2026-01-22T09:00:00Z', updatedAt: '2026-04-01T10:00:00Z',
    daysInStage: 20, isOverdue: false, referBackCount: 0 },

  // 4 draft/intake (fresh requests, open demand)
  { id: 'REQ-2025-0117', title: 'Video conferencing hardware',
    description: 'Logitech RoomMate kits for 12 rooms.',
    category: 'goods', status: 'intake', priority: 'medium',
    value: 48000, currency: 'EUR', requestorId: 'u6', ownerId: 'u1',
    supplierId: 'SUP-CAT-003', buyingChannel: 'direct-po',
    commodityCode: '43212100', commodityCodeLabel: 'AV equipment',
    costCentre: 'CC-IT-007', budgetOwner: "James O'Brien",
    businessJustification: 'Hybrid-work infrastructure.', deliveryDate: '2026-06-15', isUrgent: false,
    createdAt: '2026-04-15T09:00:00Z', updatedAt: '2026-04-16T10:00:00Z',
    daysInStage: 2, isOverdue: false, referBackCount: 0 },
  { id: 'REQ-2025-0118', title: 'Market research — APAC expansion',
    description: 'Expansion feasibility study.', category: 'consulting',
    status: 'intake', priority: 'medium', value: 140000, currency: 'EUR',
    requestorId: 'u6', ownerId: 'u4', supplierId: undefined,
    buyingChannel: 'procurement-led', commodityCode: '80131502', commodityCodeLabel: 'Market research',
    costCentre: 'CC-STR-001', budgetOwner: "James O'Brien",
    businessJustification: 'Board decision requires market sizing.', deliveryDate: '2026-08-01', isUrgent: false,
    createdAt: '2026-04-18T09:00:00Z', updatedAt: '2026-04-19T10:00:00Z',
    daysInStage: 1, isOverdue: false, referBackCount: 0 },
  { id: 'REQ-2025-0119', title: 'Printer toner bulk order',
    description: 'Catalogue order, 5 sites.',
    category: 'goods', status: 'draft', priority: 'low',
    value: 6800, currency: 'EUR', requestorId: 'u10', ownerId: 'u10',
    supplierId: 'SUP-CAT-008', buyingChannel: 'catalogue',
    commodityCode: '44103100', commodityCodeLabel: 'Printer consumables',
    costCentre: 'CC-OPS-006', budgetOwner: 'David Kowalski',
    businessJustification: 'Bulk refill.', deliveryDate: '2026-05-10', isUrgent: false,
    createdAt: '2026-04-21T09:00:00Z', updatedAt: '2026-04-21T09:00:00Z',
    daysInStage: 0, isOverdue: false, referBackCount: 0 },
  { id: 'REQ-2025-0120', title: 'Security penetration test — SaaS portal',
    description: 'Scheduled quarterly pen test.', category: 'consulting',
    status: 'approval', priority: 'urgent', value: 45000, currency: 'EUR',
    requestorId: 'u5', ownerId: 'u4', supplierId: 'SUP-005',
    buyingChannel: 'business-led', commodityCode: '81112200', commodityCodeLabel: 'Security testing',
    costCentre: 'CC-IT-008', budgetOwner: 'Sarah Chen',
    businessJustification: 'Scheduled risk review.', deliveryDate: '2026-05-30', isUrgent: true,
    createdAt: '2026-04-10T09:00:00Z', updatedAt: '2026-04-18T10:00:00Z',
    daysInStage: 6, isOverdue: false, referBackCount: 0 },
];

export const extraRequests: ProcurementRequest[] = REQS_SPEC as unknown as ProcurementRequest[];

// ── Stage history (derived) ────────────────────────────────────────

export const extraStageHistory: StageHistoryEntry[] = extraRequests.flatMap((r) => historyForRequest(r));

// ── Invoices (spread across 14 months) ─────────────────────────────

const INVOICE_SPEC: Array<Pick<Invoice, 'id' | 'supplierId' | 'supplierName' | 'amount' | 'currency' | 'status' | 'invoiceDate' | 'dueDate' | 'poId' | 'matchStatus'>> = [
  // 2025-02
  { id: 'INV-101', supplierId: 'SUP-003', supplierName: 'Deloitte', amount: 95000,  currency: 'EUR', status: 'paid', invoiceDate: '2025-02-12', dueDate: '2025-03-14', poId: 'PO-101', matchStatus: 'matched' },
  { id: 'INV-102', supplierId: 'SUP-012', supplierName: 'Sodexo',   amount: 14000,  currency: 'EUR', status: 'paid', invoiceDate: '2025-02-20', dueDate: '2025-03-22',                  matchStatus: 'matched' },
  // 2025-03
  { id: 'INV-103', supplierId: 'SUP-007', supplierName: 'Microsoft', amount: 210000, currency: 'EUR', status: 'paid', invoiceDate: '2025-03-03', dueDate: '2025-04-02', poId: 'PO-102', matchStatus: 'matched' },
  { id: 'INV-104', supplierId: 'SUP-CAT-007', supplierName: 'Staples', amount: 2100, currency: 'EUR', status: 'paid', invoiceDate: '2025-03-25', dueDate: '2025-04-24',                  matchStatus: 'matched' },
  // 2025-04
  { id: 'INV-105', supplierId: 'SUP-011', supplierName: 'WPP plc', amount: 65000,  currency: 'EUR', status: 'paid', invoiceDate: '2025-04-08', dueDate: '2025-05-08', poId: 'PO-103', matchStatus: 'matched' },
  { id: 'INV-106', supplierId: 'SUP-003', supplierName: 'Deloitte', amount: 90000, currency: 'EUR', status: 'paid', invoiceDate: '2025-04-22', dueDate: '2025-05-22', poId: 'PO-101', matchStatus: 'matched' },
  { id: 'INV-107', supplierId: 'SUP-CAT-007', supplierName: 'Staples', amount: 2100, currency: 'EUR', status: 'paid', invoiceDate: '2025-04-14', dueDate: '2025-05-14',                  matchStatus: 'matched' },
  // 2025-05
  { id: 'INV-108', supplierId: 'SUP-002', supplierName: 'SAP SE',   amount: 480000, currency: 'EUR', status: 'paid', invoiceDate: '2025-05-15', dueDate: '2025-06-14', poId: 'PO-104', matchStatus: 'matched' },
  { id: 'INV-109', supplierId: 'SUP-011', supplierName: 'WPP plc',  amount: 75000,  currency: 'EUR', status: 'paid', invoiceDate: '2025-05-28', dueDate: '2025-06-27', poId: 'PO-103', matchStatus: 'matched' },
  // 2025-06
  { id: 'INV-110', supplierId: 'SUP-013', supplierName: 'Randstad', amount: 220000, currency: 'EUR', status: 'paid', invoiceDate: '2025-06-10', dueDate: '2025-07-10', poId: 'PO-106', matchStatus: 'matched' },
  { id: 'INV-111', supplierId: 'SUP-011', supplierName: 'WPP plc',  amount: 60000,  currency: 'EUR', status: 'paid', invoiceDate: '2025-06-22', dueDate: '2025-07-22', poId: 'PO-103', matchStatus: 'matched' },
  { id: 'INV-112', supplierId: 'SUP-CAT-001', supplierName: 'Lenovo', amount: 18500, currency: 'EUR', status: 'paid', invoiceDate: '2025-06-30', dueDate: '2025-07-30',                  matchStatus: 'matched' },
  // 2025-07
  { id: 'INV-113', supplierId: 'SUP-002', supplierName: 'SAP SE',   amount: 480000, currency: 'EUR', status: 'paid', invoiceDate: '2025-07-14', dueDate: '2025-08-13', poId: 'PO-104', matchStatus: 'matched' },
  { id: 'INV-114', supplierId: 'SUP-013', supplierName: 'Randstad', amount: 240000, currency: 'EUR', status: 'paid', invoiceDate: '2025-07-28', dueDate: '2025-08-27', poId: 'PO-106', matchStatus: 'matched' },
  // 2025-08
  { id: 'INV-115', supplierId: 'SUP-012', supplierName: 'Sodexo',   amount: 21000,  currency: 'EUR', status: 'paid', invoiceDate: '2025-08-05', dueDate: '2025-09-04', poId: 'PO-109', matchStatus: 'matched' },
  { id: 'INV-116', supplierId: 'SUP-CAT-009', supplierName: 'Steelcase', amount: 41000, currency: 'EUR', status: 'paid', invoiceDate: '2025-08-20', dueDate: '2025-09-19', poId: 'PO-108', matchStatus: 'matched' },
  { id: 'INV-117', supplierId: 'SUP-013', supplierName: 'Randstad', amount: 250000, currency: 'EUR', status: 'paid', invoiceDate: '2025-08-27', dueDate: '2025-09-26', poId: 'PO-106', matchStatus: 'matched' },
  // 2025-09
  { id: 'INV-118', supplierId: 'SUP-002', supplierName: 'SAP SE',   amount: 490000, currency: 'EUR', status: 'paid', invoiceDate: '2025-09-05', dueDate: '2025-10-05', poId: 'PO-104', matchStatus: 'matched' },
  { id: 'INV-119', supplierId: 'SUP-CAT-009', supplierName: 'Steelcase', amount: 41000, currency: 'EUR', status: 'paid', invoiceDate: '2025-09-12', dueDate: '2025-10-12', poId: 'PO-108', matchStatus: 'matched' },
  { id: 'INV-120', supplierId: 'SUP-012', supplierName: 'Sodexo',   amount: 22000,  currency: 'EUR', status: 'paid', invoiceDate: '2025-09-26', dueDate: '2025-10-26', poId: 'PO-109', matchStatus: 'matched' },
  // 2025-10
  { id: 'INV-121', supplierId: 'SUP-006', supplierName: 'Amazon Web Services (AWS)', amount: 160000, currency: 'EUR', status: 'paid', invoiceDate: '2025-10-10', dueDate: '2025-11-09', poId: 'PO-110', matchStatus: 'matched' },
  { id: 'INV-122', supplierId: 'SUP-012', supplierName: 'Sodexo',   amount: 21500,  currency: 'EUR', status: 'paid', invoiceDate: '2025-10-22', dueDate: '2025-11-21', poId: 'PO-109', matchStatus: 'matched' },
  // 2025-11
  { id: 'INV-123', supplierId: 'SUP-006', supplierName: 'Amazon Web Services (AWS)', amount: 160000, currency: 'EUR', status: 'paid', invoiceDate: '2025-11-12', dueDate: '2025-12-12', poId: 'PO-110', matchStatus: 'matched' },
  { id: 'INV-124', supplierId: 'SUP-CAT-007', supplierName: 'Staples', amount: 1900, currency: 'EUR', status: 'paid', invoiceDate: '2025-11-18', dueDate: '2025-12-18',                  matchStatus: 'matched' },
  { id: 'INV-125', supplierId: 'SUP-013', supplierName: 'Randstad', amount: 240000, currency: 'EUR', status: 'paid', invoiceDate: '2025-11-27', dueDate: '2025-12-27', poId: 'PO-106', matchStatus: 'matched' },
  // 2025-12
  { id: 'INV-126', supplierId: 'SUP-006', supplierName: 'Amazon Web Services (AWS)', amount: 165000, currency: 'EUR', status: 'paid', invoiceDate: '2025-12-08', dueDate: '2026-01-07', poId: 'PO-110', matchStatus: 'matched' },
  { id: 'INV-127', supplierId: 'SUP-012', supplierName: 'Sodexo',   amount: 20000,  currency: 'EUR', status: 'paid', invoiceDate: '2025-12-20', dueDate: '2026-01-19', poId: 'PO-109', matchStatus: 'matched' },
  // 2026-01
  { id: 'INV-128', supplierId: 'SUP-002', supplierName: 'SAP SE',   amount: 420000, currency: 'EUR', status: 'paid',      invoiceDate: '2026-01-14', dueDate: '2026-02-13', poId: 'PO-104', matchStatus: 'matched' },
  { id: 'INV-129', supplierId: 'SUP-003', supplierName: 'Deloitte', amount: 120000, currency: 'EUR', status: 'paid',      invoiceDate: '2026-01-28', dueDate: '2026-02-27',                 matchStatus: 'matched' },
  { id: 'INV-130', supplierId: 'SUP-CAT-007', supplierName: 'Staples', amount: 2200, currency: 'EUR', status: 'paid',      invoiceDate: '2026-01-18', dueDate: '2026-02-17',                 matchStatus: 'matched' },
  // 2026-02
  { id: 'INV-131', supplierId: 'SUP-011', supplierName: 'WPP plc',  amount: 75000,  currency: 'EUR', status: 'paid',      invoiceDate: '2026-02-05', dueDate: '2026-03-07',                 matchStatus: 'matched' },
  { id: 'INV-132', supplierId: 'SUP-007', supplierName: 'Microsoft', amount: 210000, currency: 'EUR', status: 'paid',      invoiceDate: '2026-02-18', dueDate: '2026-03-20', poId: 'PO-102', matchStatus: 'matched' },
  { id: 'INV-133', supplierId: 'SUP-012', supplierName: 'Sodexo',   amount: 21000,  currency: 'EUR', status: 'paid',      invoiceDate: '2026-02-24', dueDate: '2026-03-26',                 matchStatus: 'matched' },
  // 2026-03
  { id: 'INV-134', supplierId: 'SUP-004', supplierName: 'KPMG',     amount: 60000,  currency: 'EUR', status: 'under-review', invoiceDate: '2026-03-12', dueDate: '2026-04-11',                 matchStatus: 'unmatched' },
  { id: 'INV-135', supplierId: 'SUP-013', supplierName: 'Randstad', amount: 210000, currency: 'EUR', status: 'submitted',  invoiceDate: '2026-03-22', dueDate: '2026-04-21',                 matchStatus: 'unmatched' },
  { id: 'INV-136', supplierId: 'SUP-011', supplierName: 'WPP plc',  amount: 70000,  currency: 'EUR', status: 'paid',      invoiceDate: '2026-03-29', dueDate: '2026-04-28',                 matchStatus: 'matched' },
  // 2026-04
  { id: 'INV-137', supplierId: 'SUP-CAT-001', supplierName: 'Lenovo', amount: 18500, currency: 'EUR', status: 'submitted', invoiceDate: '2026-04-03', dueDate: '2026-05-03',                  matchStatus: 'unmatched' },
  { id: 'INV-138', supplierId: 'SUP-012', supplierName: 'Sodexo',   amount: 20000,  currency: 'EUR', status: 'submitted', invoiceDate: '2026-04-10', dueDate: '2026-05-10',                  matchStatus: 'unmatched' },
];

export const extraInvoices: Invoice[] = INVOICE_SPEC as Invoice[];

// ── Purchase orders (covers every po_id referenced by extraInvoices) ─

export const extraPurchaseOrders: PurchaseOrder[] = [
  { id: 'PO-101', supplierId: 'SUP-003', supplierName: 'Deloitte',
    value: 185000, status: 'closed', createdAt: '2025-02-20', deliveryDate: '2025-05-15',
    requestId: 'REQ-2025-0101',
    lineItems: [
      { description: 'Penetration testing engagement', quantity: 1, unitPrice: 95000, received: 95000 },
      { description: 'Gap analysis + remediation advisory', quantity: 1, unitPrice: 90000, received: 90000 },
    ] },
  { id: 'PO-102', supplierId: 'SUP-007', supplierName: 'Microsoft',
    value: 420000, status: 'closed', createdAt: '2025-03-01', deliveryDate: '2025-04-01',
    contractId: 'CON-008', requestId: 'REQ-2025-0102',
    lineItems: [
      { description: 'Salesforce Enterprise seats — 500 × annual', quantity: 500, unitPrice: 840, received: 500 },
    ] },
  { id: 'PO-103', supplierId: 'SUP-011', supplierName: 'WPP plc',
    value: 260000, status: 'closed', createdAt: '2025-04-05', deliveryDate: '2025-06-30',
    requestId: 'REQ-2025-0103',
    lineItems: [
      { description: 'Creative direction + asset production', quantity: 1, unitPrice: 140000, received: 140000 },
      { description: 'Media planning & buying', quantity: 1, unitPrice: 120000, received: 120000 },
    ] },
  { id: 'PO-104', supplierId: 'SUP-002', supplierName: 'SAP SE',
    value: 1450000, status: 'closed', createdAt: '2025-05-10', deliveryDate: '2025-09-30',
    contractId: 'CON-002', requestId: 'REQ-2025-0104',
    lineItems: [
      { description: 'S/4HANA Cloud licences — annual', quantity: 1, unitPrice: 950000, received: 950000 },
      { description: 'Migration services', quantity: 1, unitPrice: 500000, received: 500000 },
    ] },
  { id: 'PO-106', supplierId: 'SUP-013', supplierName: 'Randstad',
    value: 960000, status: 'closed', createdAt: '2025-06-01', deliveryDate: '2025-12-31',
    contractId: 'CON-006', requestId: 'REQ-2025-0106',
    lineItems: [
      { description: 'Senior Java developers — 8 × 6 months', quantity: 8, unitPrice: 120000, received: 8 },
    ] },
  { id: 'PO-108', supplierId: 'SUP-CAT-009', supplierName: 'Steelcase',
    value: 82000, status: 'closed', createdAt: '2025-08-10', deliveryDate: '2025-09-15',
    contractId: 'CON-015', requestId: 'REQ-2025-0108',
    lineItems: [
      { description: 'Standing desks', quantity: 40, unitPrice: 1200, received: 40 },
      { description: 'Ergonomic chairs', quantity: 40, unitPrice: 850, received: 40 },
    ] },
  { id: 'PO-109', supplierId: 'SUP-012', supplierName: 'Sodexo',
    value: 120000, status: 'closed', createdAt: '2025-07-20', deliveryDate: '2025-12-31',
    contractId: 'CON-012', requestId: 'REQ-2025-0109',
    lineItems: [
      { description: 'Catering services — Q3-Q4, 3 sites', quantity: 6, unitPrice: 20000, received: 6 },
    ] },
  { id: 'PO-110', supplierId: 'SUP-006', supplierName: 'Amazon Web Services (AWS)',
    value: 485000, status: 'closed', createdAt: '2025-09-30', deliveryDate: '2026-01-31',
    contractId: 'CON-009', requestId: 'REQ-2025-0110',
    lineItems: [
      { description: 'AWS compute credits — Q4 burst', quantity: 1, unitPrice: 320000, received: 320000 },
      { description: 'AWS compute credits — Jan extension', quantity: 1, unitPrice: 165000, received: 165000 },
    ] },
];

// ── Comments (some @mentions for the Mentions widget) ──────────────

export const extraComments: Comment[] = [
  { id: 'COM-101', requestId: 'REQ-2025-0101', authorId: 'u4', authorName: 'Marcus Johnson', authorInitials: 'MJ', content: 'Findings packet delivered. Cc @u5 for the engineering review.', timestamp: '2025-03-30T10:00:00Z', isInternal: true, stage: 'sourcing', mentions: ['u5'] },
  { id: 'COM-102', requestId: 'REQ-2025-0102', authorId: 'u3', authorName: 'Sarah Chen', authorInitials: 'SC', content: 'Salesforce negotiation finalised at 8 % discount. @u1 can you prep the PO?', timestamp: '2025-03-18T11:30:00Z', isInternal: true, stage: 'contracting', mentions: ['u1'] },
  { id: 'COM-103', requestId: 'REQ-2025-0103', authorId: 'u6', authorName: "James O'Brien", authorInitials: 'JO', content: 'Kickoff scheduled. @u4 please share the brand guidelines.', timestamp: '2025-04-02T14:00:00Z', isInternal: true, stage: 'sourcing', mentions: ['u4'] },
  { id: 'COM-104', requestId: 'REQ-2025-0104', authorId: 'u3', authorName: 'Sarah Chen', authorInitials: 'SC', content: 'Migration runbook approved. @u5 you are on point for UAT.', timestamp: '2025-07-20T09:00:00Z', isInternal: true, stage: 'contracting', mentions: ['u5'] },
  { id: 'COM-105', requestId: 'REQ-2025-0106', authorId: 'u1', authorName: 'Anna Müller', authorInitials: 'AM', content: 'Rate card acceptable. @u3 need your sign-off before we issue the PO.', timestamp: '2025-06-05T10:00:00Z', isInternal: true, stage: 'approval', mentions: ['u3'] },
  { id: 'COM-106', requestId: 'REQ-2025-0111', authorId: 'u3', authorName: 'Sarah Chen', authorInitials: 'SC', content: 'Shortlist of 3 — @u5 can you validate technical fit?', timestamp: '2026-02-22T10:00:00Z', isInternal: true, stage: 'sourcing', mentions: ['u5'] },
  { id: 'COM-107', requestId: 'REQ-2025-0112', authorId: 'u4', authorName: 'Marcus Johnson', authorInitials: 'MJ', content: 'Tax review waiting on @u7 approval.', timestamp: '2026-03-16T09:00:00Z', isInternal: true, stage: 'approval', mentions: ['u7'] },
  { id: 'COM-108', requestId: 'REQ-2025-0113', authorId: 'u1', authorName: 'Anna Müller', authorInitials: 'AM', content: 'RFP out. Incumbent responded with pricing. @u10 please compare to the two new bids.', timestamp: '2026-03-25T14:00:00Z', isInternal: true, stage: 'sourcing', mentions: ['u10'] },
  { id: 'COM-109', requestId: 'REQ-2025-0114', authorId: 'u3', authorName: 'Sarah Chen', authorInitials: 'SC', content: 'License count mismatch vs AD headcount. Investigating.', timestamp: '2026-04-07T11:00:00Z', isInternal: true, stage: 'validation' },
  { id: 'COM-110', requestId: 'REQ-2025-0116', authorId: 'u4', authorName: 'Marcus Johnson', authorInitials: 'MJ', content: 'Engagement letter drafted. @u7 please review and sign.', timestamp: '2026-04-03T09:00:00Z', isInternal: true, stage: 'contracting', mentions: ['u7'] },
  { id: 'COM-111', requestId: 'REQ-2025-0118', authorId: 'u4', authorName: 'Marcus Johnson', authorInitials: 'MJ', content: 'APAC scope unclear — @u6 please confirm which countries are in scope.', timestamp: '2026-04-19T10:00:00Z', isInternal: true, stage: 'intake', mentions: ['u6'] },
  { id: 'COM-112', requestId: 'REQ-2025-0120', authorId: 'u4', authorName: 'Marcus Johnson', authorInitials: 'MJ', content: 'Urgent pen test — fast-tracked via business-led route. @u7 approval pending.', timestamp: '2026-04-16T11:00:00Z', isInternal: true, stage: 'approval', mentions: ['u7'] },
  { id: 'COM-113', requestId: 'REQ-2025-0103', authorId: 'u4', authorName: 'Marcus Johnson', authorInitials: 'MJ', content: 'Referred back once — scope ambiguity in deliverables section. Resubmit with line items.', timestamp: '2025-04-01T10:00:00Z', isInternal: true, stage: 'validation' },
  { id: 'COM-114', requestId: 'REQ-2025-0106', authorId: 'u1', authorName: 'Anna Müller', authorInitials: 'AM', content: 'Second refer-back: Need SOW update per new security baseline. @u5 please revise.', timestamp: '2025-05-28T09:00:00Z', isInternal: true, stage: 'validation', mentions: ['u5'] },
  { id: 'COM-115', requestId: 'REQ-2025-0106', authorId: 'u5', authorName: 'Elena Petrova', authorInitials: 'EP', content: 'SOW v2 uploaded. Ready for approval.', timestamp: '2025-06-02T14:00:00Z', isInternal: false, stage: 'validation' },
];

// ── Approval entries (3 info-requested for the Activity tab) ──────

export const extraApprovals: ApprovalEntry[] = [
  { id: 'APR-101', requestId: 'REQ-2025-0112', approverId: 'u7', approverName: 'Dr. Katrin Bauer', approverRole: 'Finance Approver', status: 'info-requested', requestedAt: '2026-03-15T10:00:00Z', comments: 'Need transfer-pricing benchmark data for the last 3 years before I can sign off.' },
  { id: 'APR-102', requestId: 'REQ-2025-0114', approverId: 'u7', approverName: 'Dr. Katrin Bauer', approverRole: 'Finance Approver', status: 'info-requested', requestedAt: '2026-04-07T11:00:00Z', comments: 'License count mismatch — please reconcile with AD headcount report.' },
  { id: 'APR-103', requestId: 'REQ-2025-0118', approverId: 'u7', approverName: 'Dr. Katrin Bauer', approverRole: 'Finance Approver', status: 'info-requested', requestedAt: '2026-04-19T12:00:00Z', comments: 'APAC scope needs to list specific countries.' },
  { id: 'APR-104', requestId: 'REQ-2025-0111', approverId: 'u7', approverName: 'Dr. Katrin Bauer', approverRole: 'Finance Approver', status: 'approved', requestedAt: '2026-02-10T10:00:00Z', respondedAt: '2026-02-13T14:00:00Z' },
  { id: 'APR-105', requestId: 'REQ-2025-0116', approverId: 'u7', approverName: 'Dr. Katrin Bauer', approverRole: 'Finance Approver', status: 'approved', requestedAt: '2026-02-05T11:00:00Z', respondedAt: '2026-02-18T09:00:00Z', comments: 'Approved — statutory audit budget confirmed.' },
  { id: 'APR-106', requestId: 'REQ-2025-0120', approverId: 'u7', approverName: 'Dr. Katrin Bauer', approverRole: 'Finance Approver', status: 'pending', requestedAt: '2026-04-16T10:00:00Z' },
];
