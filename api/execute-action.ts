// Confirmed assistant actions: the endpoint that runs what the user agreed to.
//
// It used to run nothing. Every action type returned "Done — <read-back>" and
// wrote one audit row; the write named a `source` column that audit_entries
// does not have, so it failed with SQLSTATE 42703 and NeonCompatibleClient
// swallowed the error into an unread { error }. Verified against the live
// store: no row with object_type 'assistant' has ever been written. The user
// was told an approval delegate was set, a request reassigned, an escalation
// raised — and nothing happened, anywhere, with no trace that it hadn't.
//
// So: each action either performs a real write in the same transaction as its
// audit row, or says plainly that it cannot be done here. The two that cannot
// are refusals by design, not omissions — see planAction.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getNeonClient, queryRows } from './_neon.js';
import { getDbAdmin } from './_db-admin.js';
import { createTicketWith } from '../src/lib/db/tickets-core.js';
import { mergePreferences } from '../src/lib/db/user-preferences-core.js';

type Params = Record<string, unknown>;

/** What an action does, decided before anything is written. */
export type ActionPlan =
  | { kind: 'user-flag'; action: string; field: 'is_ooo' | 'delegate_id'; label: string }
  | { kind: 'reassign'; action: string }
  | { kind: 'ticket'; action: string; category: string; priority: string; subject: SubjectRef; noun: string; boundary: string }
  | { kind: 'unavailable'; action: string; message: string };

interface SubjectRef { table: string; column: string; key: string; label: string }

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Decide what an action means. Pure, and exported so the honesty suite can
 * assert on every message this endpoint can produce rather than on source text.
 *
 * Returns null for an unknown type — the validation the handler never had, so
 * any string the model invented produced `Action "<x>" completed.`
 */
export function planAction(actionType: string, params: Params): ActionPlan | null {
  switch (actionType) {
    case 'set_ooo':
      return { kind: 'user-flag', action: actionType, field: 'is_ooo', label: 'out-of-office' };
    case 'set_delegate':
      return { kind: 'user-flag', action: actionType, field: 'delegate_id', label: 'approval delegate' };
    case 'reassign_request':
      return { kind: 'reassign', action: actionType };
    case 'request_risk_reassessment':
      return {
        kind: 'ticket', action: actionType, category: 'risk', priority: 'high', noun: 'risk reassessment',
        subject: { table: 'suppliers', column: 'id', key: text(params.subjectId) || text(params.supplierId), label: 'supplier' },
        boundary: 'Nothing has been sent to an external risk provider.',
      };
    case 'request_contract_renewal':
      return {
        kind: 'ticket', action: actionType, category: 'contract', priority: 'medium', noun: 'contract renewal',
        subject: { table: 'contracts', column: 'id', key: text(params.contractId) || text(params.subjectId), label: 'contract' },
        boundary: 'Nothing has been sent to the contract system.',
      };
    case 'request_po_change':
      return {
        kind: 'ticket', action: actionType, category: 'purchasing', priority: 'medium', noun: 'purchase-order change',
        subject: { table: 'purchase_orders', column: 'id', key: text(params.poId) || text(params.subjectId), label: 'purchase order' },
        boundary: 'Nothing has been sent to the ERP.',
      };
    case 'raise_payment_escalation':
      return {
        kind: 'ticket', action: actionType, category: 'payment', priority: 'high', noun: 'payment escalation',
        subject: { table: 'invoices', column: 'id', key: text(params.invoiceId) || text(params.subjectId), label: 'invoice' },
        boundary: 'Nothing has been sent to the payment system.',
      };
    // The two with nowhere to write. Both could be half-implemented — a
    // prefs.watching list, an overwrite of approval_entries.approver_id — and
    // both would then need a reply ending "…but nothing will come of it",
    // which is the sentence tests/integration/assistant-honesty.mjs exists to
    // prevent. Overwriting the approver id would also destroy the record of
    // who was originally asked, which is the point of that column.
    case 'add_watcher':
      return {
        kind: 'unavailable', action: actionType,
        message: 'I can\'t add a watcher — there is no watcher list in the platform yet, so nothing would notify you and I have recorded nothing. Open the request and its timeline shows every status change.',
      };
    case 'approver_substitution':
      return {
        kind: 'unavailable', action: actionType,
        message: 'I can\'t substitute an approver — replacing the approver on the entry would erase the record of who was originally asked, and I have recorded nothing. Use Delegate on the approval card, which keeps both names.',
      };
    default:
      return null;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Action failed.';
}

/** A UUID for audit_entries.id, so a double-confirm collides instead of duplicating. */
function auditId(actionId: unknown): string | null {
  const value = text(actionId);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

function answer(res: VercelResponse, content: string): void {
  res.status(200).json({ turns: [{ type: 'chat-answer', content }] });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed', code: 'method_not_allowed' });
    return;
  }

  const { actionType, actionParams, userId, userName, actionId } = (req.body ?? {}) as {
    actionType?: unknown; actionParams?: unknown; userId?: unknown; userName?: unknown; actionId?: unknown;
  };

  const type = text(actionType);
  if (!type) {
    res.status(400).json({ error: 'actionType is required.', code: 'validation_error' });
    return;
  }
  const params: Params = (actionParams && typeof actionParams === 'object' && !Array.isArray(actionParams))
    ? actionParams as Params
    : {};
  const actor = text(userId) || 'unknown';
  // The caller sends a display name alongside the id, and the audit row used
  // to record it verbatim — so the trail named whoever the request claimed,
  // and two calls with the same id could be attributed to different people.
  // Resolve it from the directory instead and keep the claimed name only when
  // the id is unknown, so an audit row is never silently attributed to a
  // person who is not the one the id identifies.
  let actorName = text(userName) || 'Unknown User';
  if (actor !== 'unknown') {
    const [known] = await queryRows(getNeonClient(), 'SELECT name FROM users WHERE id = $1', [actor]);
    if (known?.name) actorName = String(known.name);
  }

  const plan = planAction(type, params);
  if (!plan) {
    res.status(400).json({ error: 'That action is not something I can carry out.', code: 'unsupported_action' });
    return;
  }
  // A refusal is a valid answer, not an error — and it writes no audit row,
  // because nothing happened to audit.
  if (plan.kind === 'unavailable') { answer(res, plan.message); return; }

  try {
    const sql = getNeonClient();
    const now = new Date().toISOString();
    const id = auditId(actionId);
    const queries: ReturnType<typeof sql.query>[] = [];
    let detail = '';
    let objectType = '';
    let objectId = '';
    let requestId: string | null = null;
    let reply = '';

    if (plan.kind === 'user-flag') {
      const targetId = text(params.delegateId) || text(params.userId) || actor;
      const targetName = text(params.delegateName) || text(params.userName);
      const until = text(params.until);
      if (plan.field === 'delegate_id') {
        const delegate = await queryRows(sql, 'SELECT id, name FROM users WHERE id = $1', [targetId]);
        if (!delegate[0]) {
          res.status(404).json({ error: 'I could not find that person, so nothing was changed.', code: 'subject_not_found' });
          return;
        }
        queries.push(sql.query('UPDATE users SET delegate_id = $1 WHERE id = $2', [targetId, actor]));
        detail = `Approval delegate set to ${String(delegate[0].name)}`;
        reply = `${String(delegate[0].name)} is now your approval delegate. While you are marked out-of-office, approvals assigned to you are routed to them.`;
      } else {
        queries.push(sql.query('UPDATE users SET is_ooo = true WHERE id = $1', [actor]));
        detail = until ? `Out-of-office set until ${until}` : 'Out-of-office set';
        reply = until
          ? `You are marked out-of-office until ${until}. Approvals assigned to you route to your delegate while it is set.`
          : 'You are marked out-of-office. Approvals assigned to you route to your delegate while it is set.';
      }
      objectType = 'users';
      objectId = actor;
      if (until) await mergePreferences(getDbAdmin(), actor, { outOfOfficeUntil: until });
      if (targetName && plan.field === 'delegate_id') {
        await mergePreferences(getDbAdmin(), actor, { approvalDelegateName: targetName });
      }
    } else if (plan.kind === 'reassign') {
      const target = text(params.requestId);
      const newOwner = text(params.ownerId) || text(params.assigneeId);
      const [request] = await queryRows(sql, 'SELECT id, status, owner_id FROM requests WHERE id = $1', [target]);
      const [owner] = await queryRows(sql, 'SELECT id, name FROM users WHERE id = $1', [newOwner]);
      if (!request || !owner) {
        res.status(404).json({ error: 'I could not find that request or that person, so nothing was changed.', code: 'subject_not_found' });
        return;
      }
      // Same shape as api/workflow-action.ts: close the open stage row before
      // opening its replacement, so the request never has two rows open.
      queries.push(sql.query('UPDATE requests SET owner_id = $1, updated_at = $2, days_in_stage = 0 WHERE id = $3', [newOwner, now, target]));
      queries.push(sql.query('UPDATE stage_history SET completed_at = $1 WHERE request_id = $2 AND completed_at IS NULL', [now, target]));
      queries.push(sql.query(
        'INSERT INTO stage_history (request_id, stage, entered_at, owner_id, action, notes) VALUES ($1, $2, $3, $4, $5, $6)',
        [target, String(request.status), now, newOwner, 'reassigned', `Reassigned by ${actorName} via the assistant.`],
      ));
      objectType = 'requests';
      objectId = target;
      requestId = target;
      detail = `Request ${target} reassigned to ${String(owner.name)}`;
      reply = `Request ${target} is now owned by ${String(owner.name)}. The change is on the request's timeline.`;
    } else {
      const { subject } = plan;
      if (!subject.key) {
        res.status(400).json({ error: `I need to know which ${subject.label} this is about; nothing was recorded.`, code: 'validation_error' });
        return;
      }
      const [found] = await queryRows(sql, `SELECT ${subject.column} FROM ${subject.table} WHERE ${subject.column} = $1`, [subject.key]);
      if (!found) {
        res.status(404).json({ error: `I could not find that ${subject.label}, so nothing was recorded.`, code: 'subject_not_found' });
        return;
      }
      // Through the shared core, so this ticket gets the same sequence id and
      // SLA due date a form-raised one does.
      const ticket = await createTicketWith(getDbAdmin(), {
        summary: `${plan.noun} requested for ${subject.key}`,
        context: `${actorName} requested a ${plan.noun} for ${subject.label} ${subject.key} through the assistant.`
          + (text(params.reason) ? ` Reason: ${text(params.reason)}` : ''),
        createdBy: actorName || actor,
        category: plan.category,
        priority: plan.priority,
        source: 'assistant',
      });
      objectType = 'tickets';
      objectId = String(ticket.id);
      detail = `${plan.noun} requested for ${subject.key} (${String(ticket.id)})`;
      reply = `Raised ${String(ticket.id)} — a ${plan.noun} for ${subject.key}, in the procurement support queue`
        + (ticket.due_at ? `, due by ${new Date(String(ticket.due_at)).toISOString().slice(0, 16).replace('T', ' ')}` : '')
        + `. ${plan.boundary}`;
    }

    // The audit row goes in the same transaction as the write it describes, so
    // there is no state where an action ran unaudited or was audited unrun.
    // No `source` column here — it does not exist, which is why the previous
    // insert failed silently on every call. `type: 'ai'` carries the origin.
    const auditColumns = ['type', 'action', 'object_type', 'object_id', 'user_id', 'user_name', 'detail', 'request_id'];
    const auditValues: unknown[] = ['ai', plan.action, objectType, objectId, actor, actorName, detail, requestId];
    if (id) { auditColumns.unshift('id'); auditValues.unshift(id); }
    queries.push(sql.query(
      `INSERT INTO audit_entries (${auditColumns.join(', ')}) VALUES (${auditValues.map((_, i) => `$${i + 1}`).join(', ')})`,
      auditValues,
    ));

    try {
      await sql.transaction(queries);
    } catch (error) {
      // A repeated confirmation collides on the audit id. The action already
      // ran the first time, so report what it did rather than an error.
      // A repeated confirmation collides on the audit id — but so does a
      // caller who supplies an id already in the table, and the whole batch
      // rolls back either way. Reporting success on the collision alone told
      // the user an action had run when nothing had. Confirm the existing row
      // is the same action by the same actor before saying so.
      if (id && /duplicate key|unique constraint/i.test(errorMessage(error))) {
        const [prior] = await queryRows(
          sql, 'SELECT action, object_id, user_id FROM audit_entries WHERE id = $1', [id],
        );
        if (prior && String(prior.action) === plan.action && String(prior.user_id) === actor
          && String(prior.object_id) === objectId) {
          answer(res, reply);
          return;
        }
        res.status(409).json({ error: 'That confirmation could not be recorded, so nothing was changed.', code: 'audit_conflict' });
        return;
      }
      throw error;
    }
    answer(res, reply);
  } catch (error) {
    console.error('[execute-action]', errorMessage(error));
    res.status(500).json({ error: 'I could not complete that action, and nothing was changed.', code: 'execute_action_failed' });
  }
}
