// What a proposed assistant action will actually do, described by the server.
//
// The confirm-before-act card is the only thing standing between a model's
// suggestion and a real write, and it used to render `read_back` — free text
// the model wrote in the same tool call that chose `action_type` and `params`.
// Nothing compared the two. Untrusted content reaches the model every turn
// (knowledge-base bodies, request titles, supplier names, and up to 50k
// characters of uploaded document text), so a poisoned record could get the
// model to propose `set_delegate` while writing a read-back about something
// harmless, and the user would confirm the sentence they were shown.
//
// So the sentence above the Confirm button is built here, from the action type
// and its parameters, with ids resolved to names by the caller. The model's
// wording is not used. Every action this endpoint can run has a template; an
// action with no template is not proposable.
export type ActionParams = Record<string, unknown>;

/** A record an action names, which the caller resolves to a display name. */
export interface ActionSubject {
  /** Allowlisted relation to read. */
  table: 'users' | 'requests' | 'suppliers' | 'contracts' | 'purchase_orders' | 'invoices';
  column: 'id';
  key: string;
  /** Slot the resolved name fills in the template. */
  role: 'person' | 'request' | 'owner' | 'record';
}

export interface ActionDescription {
  /** The sentence shown above Confirm. Built here, never by the model. */
  summary: string;
  /** The machine action, shown so the prose is not the only thing on the card. */
  action: string;
  /** Named values behind the sentence, so a wrong target is visible. */
  facts: Array<{ label: string; value: string }>;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** The person or record an action targets, for the caller to look up. */
export function actionSubjects(actionType: string, params: ActionParams): ActionSubject[] {
  switch (actionType) {
    case 'set_delegate': {
      const key = text(params.delegateId) || text(params.userId);
      return key ? [{ table: 'users', column: 'id', key, role: 'person' }] : [];
    }
    case 'reassign_request': {
      const request = text(params.requestId);
      const owner = text(params.ownerId) || text(params.assigneeId);
      return [
        ...(request ? [{ table: 'requests' as const, column: 'id' as const, key: request, role: 'request' as const }] : []),
        ...(owner ? [{ table: 'users' as const, column: 'id' as const, key: owner, role: 'owner' as const }] : []),
      ];
    }
    case 'request_risk_reassessment': {
      const key = text(params.subjectId) || text(params.supplierId);
      return key ? [{ table: 'suppliers', column: 'id', key, role: 'record' }] : [];
    }
    case 'request_contract_renewal': {
      const key = text(params.contractId) || text(params.subjectId);
      return key ? [{ table: 'contracts', column: 'id', key, role: 'record' }] : [];
    }
    case 'request_po_change': {
      const key = text(params.poId) || text(params.subjectId);
      return key ? [{ table: 'purchase_orders', column: 'id', key, role: 'record' }] : [];
    }
    case 'raise_payment_escalation': {
      const key = text(params.invoiceId) || text(params.subjectId);
      return key ? [{ table: 'invoices', column: 'id', key, role: 'record' }] : [];
    }
    default:
      return [];
  }
}

/** Show the name when it resolved, and the bare id when it did not. */
function named(key: string, names: Record<string, string>): string {
  const name = text(names[key]);
  return name ? `${name} (${key})` : key;
}

/**
 * Build the confirmation text. `names` maps a subject key to the display name
 * the caller read from the store; an unresolved key falls back to the id, so a
 * lookup failure degrades to a less friendly sentence rather than a wrong one.
 *
 * Returns null for an action with no template — the caller must then not show
 * a confirm card at all.
 */
export function describeAction(
  actionType: string,
  params: ActionParams,
  names: Record<string, string> = {},
): ActionDescription | null {
  const facts: Array<{ label: string; value: string }> = [];
  switch (actionType) {
    case 'set_ooo': {
      const until = text(params.until);
      if (until) facts.push({ label: 'Until', value: until });
      return {
        action: actionType,
        summary: until
          ? `Mark you out-of-office until ${until}. Approvals assigned to you route to your delegate while it is set.`
          : 'Mark you out-of-office. Approvals assigned to you route to your delegate while it is set.',
        facts,
      };
    }
    case 'set_delegate': {
      const key = text(params.delegateId) || text(params.userId);
      if (!key) return null;
      facts.push({ label: 'Delegate', value: named(key, names) });
      return {
        action: actionType,
        summary: `Set ${named(key, names)} as your approval delegate. While you are out-of-office, approvals assigned to you are routed to them.`,
        facts,
      };
    }
    case 'reassign_request': {
      const request = text(params.requestId);
      const owner = text(params.ownerId) || text(params.assigneeId);
      if (!request || !owner) return null;
      facts.push({ label: 'Request', value: named(request, names) });
      facts.push({ label: 'New owner', value: named(owner, names) });
      return {
        action: actionType,
        summary: `Reassign request ${request} to ${named(owner, names)}. The handover is recorded on the request's timeline.`,
        facts,
      };
    }
    case 'request_risk_reassessment':
    case 'request_contract_renewal':
    case 'request_po_change':
    case 'raise_payment_escalation': {
      const [subject] = actionSubjects(actionType, params);
      if (!subject) return null;
      const noun = {
        request_risk_reassessment: 'risk reassessment',
        request_contract_renewal: 'contract renewal',
        request_po_change: 'purchase-order change',
        raise_payment_escalation: 'payment escalation',
      }[actionType] as string;
      const boundary = {
        request_risk_reassessment: 'Nothing is sent to an external risk provider.',
        request_contract_renewal: 'Nothing is sent to the contract system.',
        request_po_change: 'Nothing is sent to the ERP.',
        raise_payment_escalation: 'Nothing is sent to the payment system.',
      }[actionType] as string;
      const labels: Record<ActionSubject['table'], string> = {
        users: 'Person', requests: 'Request', suppliers: 'Supplier',
        contracts: 'Contract', purchase_orders: 'Purchase order', invoices: 'Invoice',
      };
      const label = labels[subject.table];
      facts.push({ label, value: named(subject.key, names) });
      const reason = text(params.reason);
      if (reason) facts.push({ label: 'Reason', value: reason });
      return {
        action: actionType,
        summary: `Raise a ${noun} ticket for ${named(subject.key, names)} in the procurement support queue. ${boundary}`,
        facts,
      };
    }
    // add_watcher and approver_substitution are refusals in planAction — they
    // never reach a confirm card, so they deliberately have no template.
    default:
      return null;
  }
}
