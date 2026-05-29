import { requests } from '@/data/requests';
import { suppliers } from '@/data/suppliers';
import { contracts } from '@/data/contracts';
import { purchaseOrders } from '@/data/purchase-orders';
import { invoices } from '@/data/invoices';
import { riskAssessments } from '@/data/risk-assessments';
import type { AssistantTurn } from '@/data/types';

type ObjectType = 'request' | 'supplier' | 'contract' | 'po' | 'invoice' | 'risk-assessment';

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

export function lookupObject(type: ObjectType | null, identifier: string): AssistantTurn[] {
  const resolvedType = type ?? detectType(identifier);

  if (resolvedType === 'supplier' || (!resolvedType && !identifier.toUpperCase().startsWith('REQ-'))) {
    return lookupSupplier(identifier);
  }
  if (resolvedType === 'request') return lookupRequest(identifier);
  if (resolvedType === 'contract') return lookupContract(identifier);
  if (resolvedType === 'po') return lookupPO(identifier);
  if (resolvedType === 'invoice') return lookupInvoice(identifier);
  if (resolvedType === 'risk-assessment') return lookupRisk(identifier);

  // Fall back to name-based search across all types
  return lookupSupplier(identifier);
}

function lookupSupplier(identifier: string): AssistantTurn[] {
  const id = identifier.toUpperCase();
  const name = identifier.toLowerCase();
  const supplier =
    suppliers.find((s) => s.id === id) ??
    suppliers.find((s) => s.name.toLowerCase().includes(name));

  if (!supplier) {
    return [{ type: 'chat-answer', content: `No supplier found matching "${identifier}". Check the Supplier Directory for a full list.` }];
  }

  const riskAssessment = riskAssessments.find((r) => r.supplierId === supplier.id);

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

  const turns: AssistantTurn[] = [
    { type: 'chat-answer', content: summary },
    {
      type: 'deep-link',
      label: `Vendor 360 — ${supplier.name}`,
      description: 'Full supplier profile, contracts, and risk history',
      path: `/suppliers/${supplier.id}`,
    },
  ];

  // Forward steps
  const chips: Array<{ label: string; prompt: string }> = [];
  if (supplier.sraStatus === 'expired' || supplier.sraStatus === 'expiring') {
    chips.push({ label: 'Request risk reassessment', prompt: `Request a risk reassessment for ${supplier.name}` });
  }
  if (supplier.activeContracts > 0) {
    chips.push({ label: 'View contracts', prompt: `Show contracts for ${supplier.name}` });
  }
  chips.push({ label: 'Compare bids', prompt: 'I want to compare bids for a sourcing event' });

  if (chips.length > 0) turns.push({ type: 'suggestion-chips', chips });

  return turns;
}

function lookupRequest(identifier: string): AssistantTurn[] {
  const id = identifier.toUpperCase();
  const req = requests.find((r) => r.id === id);

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

  const turns: AssistantTurn[] = [
    { type: 'chat-answer', content: summary },
    {
      type: 'deep-link',
      label: `Request Detail — ${req.id}`,
      description: 'Full request timeline, approvals, and documents',
      path: `/requests/${req.id}`,
    },
  ];

  const chips: Array<{ label: string; prompt: string }> = [
    { label: 'Add me as watcher', prompt: `Add me as a watcher to ${req.id}` },
  ];
  if (req.status === 'approval') {
    chips.push({ label: 'Reassign request', prompt: `Reassign ${req.id} to another owner` });
  }
  turns.push({ type: 'suggestion-chips', chips });

  return turns;
}

function lookupContract(identifier: string): AssistantTurn[] {
  const id = identifier.toUpperCase();
  const contract =
    contracts.find((c) => c.id === id) ??
    contracts.find((c) => c.supplierName.toLowerCase().includes(identifier.toLowerCase()));

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

  const turns: AssistantTurn[] = [
    { type: 'chat-answer', content: summary },
    {
      type: 'deep-link',
      label: `Contract Detail — ${contract.id}`,
      description: 'Full contract, amendments, and renewal history',
      path: `/contracts/${contract.id}`,
    },
  ];

  const chips: Array<{ label: string; prompt: string }> = [];
  if (daysToExpiry < 90) {
    chips.push({ label: 'Request renewal', prompt: `Request contract renewal for ${contract.id}` });
  }
  chips.push({ label: 'View supplier', prompt: `Show supplier profile for ${contract.supplierName}` });
  turns.push({ type: 'suggestion-chips', chips });

  return turns;
}

function lookupPO(identifier: string): AssistantTurn[] {
  const id = identifier.toUpperCase();
  const po = purchaseOrders.find((p) => p.id === id);

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
    {
      type: 'suggestion-chips',
      chips: [{ label: 'Request PO change', prompt: `Request a change to PO ${po.id}` }],
    },
  ];
}

function lookupInvoice(identifier: string): AssistantTurn[] {
  const id = identifier.toUpperCase();
  const inv = invoices.find((i) => i.id === id);

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

  if (inv.status === 'disputed' || inv.matchStatus === 'variance') {
    turns.push({
      type: 'suggestion-chips',
      chips: [{ label: 'Raise payment escalation', prompt: `Raise a payment escalation for invoice ${inv.id}` }],
    });
  }

  return turns;
}

function lookupRisk(identifier: string): AssistantTurn[] {
  const id = identifier.toUpperCase();
  const ra = riskAssessments.find((r) => r.id === id);

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
