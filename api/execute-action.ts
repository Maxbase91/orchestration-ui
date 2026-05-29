import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

const ACTION_LABELS: Record<string, string> = {
  add_watcher: 'Add Watcher',
  set_delegate: 'Set Delegate',
  set_ooo: 'Set Out-of-Office',
  reassign_request: 'Reassign Request',
  request_risk_reassessment: 'Request Risk Reassessment',
  request_contract_renewal: 'Request Contract Renewal',
  request_po_change: 'Request PO Change',
  raise_payment_escalation: 'Raise Payment Escalation',
  approver_substitution: 'Approver Substitution',
};

function buildReadBack(actionType: string, params: Record<string, unknown>): string {
  switch (actionType) {
    case 'add_watcher':
      return `Added as watcher to ${params.requestId ?? 'the request'}.`;
    case 'set_delegate':
      return `Approval delegate set to ${params.delegateName ?? 'the specified person'}.`;
    case 'set_ooo':
      return params.until
        ? `Out-of-office activated until ${params.until}.`
        : 'Out-of-office activated.';
    case 'reassign_request':
      return `Request ${params.requestId ?? ''} reassigned.`;
    case 'request_risk_reassessment':
      return `Risk reassessment requested for ${params.subjectId ?? 'the supplier'}.`;
    case 'request_contract_renewal':
      return `Contract renewal request submitted for ${params.contractId ?? 'the contract'}.`;
    case 'request_po_change':
      return `PO change request submitted for ${params.poId ?? 'the purchase order'}.`;
    case 'raise_payment_escalation':
      return `Payment escalation raised for invoice ${params.invoiceId ?? ''}.`;
    case 'approver_substitution':
      return `Approver substitution recorded.`;
    default:
      return `Action "${ACTION_LABELS[actionType] ?? actionType}" completed.`;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { actionType, actionParams, userId, userName } = req.body as {
    actionType: string;
    actionParams: Record<string, unknown>;
    userId: string;
    userName: string;
    role: string;
  };

  if (!actionType) {
    return res.status(400).json({ error: 'actionType required' });
  }

  const detail = buildReadBack(actionType, actionParams ?? {});

  // Write to audit_entries
  await supabase.from('audit_entries').insert({
    type: 'ai',
    action: actionType,
    object_type: 'assistant',
    object_id: `AI-${Date.now()}`,
    user_id: userId ?? 'unknown',
    user_name: userName ?? 'Unknown User',
    detail,
    source: 'assistant',
  });

  return res.status(200).json({
    turns: [
      {
        type: 'chat-answer',
        content: `Done — ${detail} You can track activity in the audit log.`,
      },
    ],
  });
}
