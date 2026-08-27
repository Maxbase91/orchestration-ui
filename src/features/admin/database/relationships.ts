// Declarative foreign-key graph for the database admin browser. Each entry
// lists where an entity points (`outgoing`, via its own FK field) and what
// points back at it (`incoming`, via the referencing entity's FK field).
// Drives the Related Items panel; not a database constraint.

import type { EntityKey } from '@/stores/database-admin-store';

export interface OutgoingRelation {
  to: EntityKey;
  via: string;
  label: string;
}

export interface IncomingRelation {
  from: EntityKey;
  via: string;
  label: string;
  arrayField?: boolean;
}

export interface EntityRelationships {
  outgoing: OutgoingRelation[];
  incoming: IncomingRelation[];
}

export const relationships: Record<EntityKey, EntityRelationships> = {
  supplier: {
    outgoing: [],
    incoming: [
      { from: 'contract', via: 'supplierId', label: 'Contracts with this supplier' },
      { from: 'purchaseOrder', via: 'supplierId', label: 'Purchase orders for this supplier' },
      { from: 'invoice', via: 'supplierId', label: 'Invoices from this supplier' },
      { from: 'riskAssessment', via: 'supplierId', label: 'Risk assessments' },
      { from: 'request', via: 'supplierId', label: 'Requests using this supplier' },
      { from: 'sourcingEvent', via: 'awardedSupplierId', label: 'Sourcing events awarded to this supplier' },
    ],
  },
  contract: {
    outgoing: [{ to: 'supplier', via: 'supplierId', label: 'Supplier' }],
    incoming: [
      { from: 'purchaseOrder', via: 'contractId', label: 'POs under this contract' },
      { from: 'request', via: 'contractId', label: 'Requests using this contract' },
      { from: 'riskAssessment', via: 'contractId', label: 'Risk assessments' },
    ],
  },
  riskAssessment: {
    outgoing: [
      { to: 'supplier', via: 'supplierId', label: 'Supplier' },
      { to: 'contract', via: 'contractId', label: 'Contract' },
    ],
    incoming: [],
  },
  purchaseOrder: {
    outgoing: [
      { to: 'supplier', via: 'supplierId', label: 'Supplier' },
      { to: 'contract', via: 'contractId', label: 'Contract' },
      { to: 'request', via: 'requestId', label: 'Originating request' },
    ],
    incoming: [{ from: 'invoice', via: 'poId', label: 'Invoices matched to this PO' }],
  },
  invoice: {
    outgoing: [
      { to: 'supplier', via: 'supplierId', label: 'Supplier' },
      { to: 'purchaseOrder', via: 'poId', label: 'Purchase order' },
    ],
    incoming: [],
  },
  request: {
    outgoing: [
      { to: 'supplier', via: 'supplierId', label: 'Supplier' },
      { to: 'contract', via: 'contractId', label: 'Contract' },
      { to: 'purchaseOrder', via: 'poId', label: 'Purchase order' },
    ],
    incoming: [
      { from: 'approval', via: 'requestId', label: 'Approval entries' },
      { from: 'sourcingEvent', via: 'requestId', label: 'Sourcing events raised from this request' },
    ],
  },
  approval: {
    outgoing: [{ to: 'request', via: 'requestId', label: 'Request' }],
    incoming: [],
  },
  workflow: {
    outgoing: [],
    incoming: [],
  },
  sourcingEvent: {
    outgoing: [
      { to: 'request', via: 'requestId', label: 'Originating request' },
      { to: 'supplier', via: 'awardedSupplierId', label: 'Awarded supplier' },
    ],
    // sourcing_responses is not an admin entity — its rows are invitations, not
    // records an admin edits, and the event page already shows them per event.
    incoming: [],
  },
};
