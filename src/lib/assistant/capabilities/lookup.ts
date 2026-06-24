import { requireConnector, type SourceObject } from '@/lib/integrations';
import type {
  AssistantTurn, Supplier, Contract, PurchaseOrder, Invoice, RiskAssessment, ProcurementRequest,
} from '@/data/types';

type ObjectType = 'request' | 'supplier' | 'contract' | 'po' | 'invoice' | 'risk-assessment';

// The assistant reads the same governed source as the front door — every lookup
// goes through the standardised connector ports (own store today, live source
// later), never a static data import. Reads are wrapped so a source outage
// degrades gracefully rather than throwing.
const SOURCE_OBJECT: Record<ObjectType, SourceObject> = {
  request: 'purchase-request',
  supplier: 'supplier',
  contract: 'contract',
  po: 'purchase-order',
  invoice: 'invoice',
  'risk-assessment': 'risk-assessment',
};

async function getRecord<T>(type: ObjectType, key: string): Promise<T | null> {
  try {
    const rec = await requireConnector<string, T>(SOURCE_OBJECT[type]).get(key);
    return rec?.data ?? null;
  } catch {
    return null;
  }
}

async function listRecords<T>(type: ObjectType, query?: Parameters<ReturnType<typeof requireConnector<string, T>>['list']>[0]): Promise<T[]> {
  try {
    const recs = await requireConnector<string, T>(SOURCE_OBJECT[type]).list(query);
    return recs.map((r) => r.data);
  } catch {
    return [];
  }
}

function detectType(identifier: string): ObjectType | null {
  const id = identifier.toUpperCase();
  if (id.startsWith('REQ-')) return 'request';
  if (id.startsWith('SUP-')) return 'supplier';
  if (id.startsWith('CON-')) return 'contract';
  if (id.startsWith('PO-')) return 'po';
  if (id.startsWith('INV-')) return 'invoice';
  if (id.startsWith('RA-')) return 'risk-assessment';
  return null;
}

export async function lookupObject(type: ObjectType | null, identifier: string): Promise<AssistantTurn[]> {
  const resolvedType = type ?? detectType(identifier);

  if (!resolvedType || !identifier) {
    return [
      {
        type: 'chat-answer',
        content: "I need a specific ID or name to look that up. Try:\n• A request ID — REQ-2024-0001\n• A supplier name — Accenture, SAP, Deloitte\n• A contract ID — CON-003\n• A PO or invoice ID — PO-001, INV-001",
      },
    ];
  }

  if (resolvedType === 'supplier') return lookupSupplier(identifier);
  if (resolvedType === 'request') return lookupRequest(identifier);
  if (resolvedType === 'contract') return lookupContract(identifier);
  if (resolvedType === 'po') return lookupPO(identifier);
  if (resolvedType === 'invoice') return lookupInvoice(identifier);
  if (resolvedType === 'risk-assessment') return lookupRisk(identifier);

  // Fall back to name-based search across all types
  return lookupSupplier(identifier);
}

async function lookupSupplier(identifier: string): Promise<AssistantTurn[]> {
  const id = identifier.toUpperCase();
  const name = identifier.toLowerCase();
  const supplier =
    (await getRecord<Supplier>('supplier', id)) ??
    (await listRecords<Supplier>('supplier', { search: name })).find((s) => s.name.toLowerCase().includes(name));

  if (!supplier) {
    return [{ type: 'chat-answer', content: `No supplier found matching "${identifier}". Check the Supplier Directory for a full list.` }];
  }

  const riskAssessment = (await listRecords<RiskAssessment>('risk-assessment', { filters: { supplierId: supplier.id } }))[0];

  const summary = [
    `**${supplier.name}** (${supplier.id}) — Tier ${supplier.tier} supplier, ${supplier.country}.`,
    `Risk rating: **${supplier.riskRating}** | Performance score: ${supplier.performanceScore}/100`,
    `Spend (12 m): €${supplier.totalSpend12m.toLocaleString()} | Active contracts: ${supplier.activeContracts}`,
    `SRA status: **${supplier.sraStatus}**${supplier.sraExpiryDate ? ` (expires ${supplier.sraExpiryDate})` : ''}`,
    `Screening: ${supplier.screeningStatus}`,
    riskAssessment ? `Latest risk assessment: ${riskAssessment.riskLevel} risk — "${riskAssessment.summary}"` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return [
    { type: 'chat-answer', content: summary },
    {
      type: 'deep-link',
      label: `Vendor 360 — ${supplier.name}`,
      description: 'Full supplier profile, contracts, and risk history',
      path: `/suppliers/${supplier.id}`,
    },
  ];
}

async function lookupRequest(identifier: string): Promise<AssistantTurn[]> {
  const id = identifier.toUpperCase();
  const req = await getRecord<ProcurementRequest>('request', id);

  if (!req) {
    return [{ type: 'chat-answer', content: `No request found with ID ${identifier}. Check the Requests module for a full list.` }];
  }

  const summary = [
    `**${req.title}** (${req.id})`,
    `Status: **${req.status}** | Stage day ${req.daysInStage}${req.isOverdue ? ' ⚠️ OVERDUE' : ''}`,
    `Value: €${req.value.toLocaleString()} | Priority: ${req.priority}`,
    `Category: ${req.category} | Channel: ${req.buyingChannel}`,
    `Requestor: ${req.requestorId} | Owner: ${req.ownerId}`,
    `Delivery date: ${req.deliveryDate}`,
  ].join('\n');

  return [
    { type: 'chat-answer', content: summary },
    {
      type: 'deep-link',
      label: `Request Detail — ${req.id}`,
      description: 'Full request timeline, approvals, and documents',
      path: `/requests/${req.id}`,
    },
  ];
}

async function lookupContract(identifier: string): Promise<AssistantTurn[]> {
  const id = identifier.toUpperCase();
  const contract =
    (await getRecord<Contract>('contract', id)) ??
    (await listRecords<Contract>('contract', { search: identifier.toLowerCase() })).find((c) => c.supplierName.toLowerCase().includes(identifier.toLowerCase()));

  if (!contract) {
    return [{ type: 'chat-answer', content: `No contract found matching "${identifier}".` }];
  }

  const daysToExpiry = Math.ceil(
    (new Date(contract.endDate).getTime() - Date.now()) / 86_400_000
  );
  const expiryNote = daysToExpiry < 0 ? 'EXPIRED' : daysToExpiry < 90 ? `expires in ${daysToExpiry} days ⚠️` : `expires ${contract.endDate}`;

  const summary = [
    `**${contract.title}** (${contract.id})`,
    `Supplier: ${contract.supplierName} | Value: €${contract.value.toLocaleString()}`,
    `Status: **${contract.status}** | ${expiryNote}`,
    `Utilisation: ${contract.utilisationPercentage}% | Owner: ${contract.ownerName}`,
    `Department: ${contract.department}`,
  ].join('\n');

  return [
    { type: 'chat-answer', content: summary },
    {
      type: 'deep-link',
      label: `Contract Detail — ${contract.id}`,
      description: 'Full contract, amendments, and renewal history',
      path: `/contracts/${contract.id}`,
    },
  ];
}

async function lookupPO(identifier: string): Promise<AssistantTurn[]> {
  const id = identifier.toUpperCase();
  const po = await getRecord<PurchaseOrder>('po', id);

  if (!po) {
    return [{ type: 'chat-answer', content: `No PO found with ID ${identifier}.` }];
  }

  const summary = [
    `**PO ${po.id}** — ${po.supplierName}`,
    `Value: €${po.value.toLocaleString()} | Status: **${po.status}**`,
    `Delivery: ${po.deliveryDate} | Lines: ${po.lineItems.length}`,
  ].join('\n');

  return [
    { type: 'chat-answer', content: summary },
    {
      type: 'deep-link',
      label: `Purchase Order — ${po.id}`,
      description: 'PO lines, receipts, and invoice match status',
      path: `/purchasing/orders/${po.id}`,
    },
  ];
}

async function lookupInvoice(identifier: string): Promise<AssistantTurn[]> {
  const id = identifier.toUpperCase();
  const inv = await getRecord<Invoice>('invoice', id);

  if (!inv) {
    return [{ type: 'chat-answer', content: `No invoice found with ID ${identifier}.` }];
  }

  const summary = [
    `**Invoice ${inv.id}** — ${inv.supplierName}`,
    `Amount: €${inv.amount.toLocaleString()} | Status: **${inv.status}**`,
    `Due: ${inv.dueDate} | Match: ${inv.matchStatus}`,
    inv.matchVariance ? `Variance: €${inv.matchVariance.toLocaleString()}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const turns: AssistantTurn[] = [
    { type: 'chat-answer', content: summary },
    {
      type: 'deep-link',
      label: `Invoice — ${inv.id}`,
      description: 'Invoice detail, matching, and payment status',
      path: `/purchasing/invoices`,
    },
  ];

  return turns;
}

async function lookupRisk(identifier: string): Promise<AssistantTurn[]> {
  const id = identifier.toUpperCase();
  const ra = await getRecord<RiskAssessment>('risk-assessment', id);

  if (!ra) {
    return [{ type: 'chat-answer', content: `No risk assessment found with ID ${identifier}.` }];
  }

  const summary = [
    `**${ra.title}** (${ra.id})`,
    `Risk level: **${ra.riskLevel}** | Score: ${ra.score}/100`,
    `Status: ${ra.status} | Valid until: ${ra.validUntil}`,
    `Summary: ${ra.summary}`,
  ].join('\n');

  return [
    { type: 'chat-answer', content: summary },
    {
      type: 'deep-link',
      label: `Risk Assessment — ${ra.id}`,
      description: 'Full assessment, mitigations, and history',
      path: `/suppliers/risk`,
    },
  ];
}
