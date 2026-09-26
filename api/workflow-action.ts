// The request page's hand-made moves — refer back, reassign, cancel — made on
// the server, each under its own rule, with the stage history kept honest. A
// stage's exit is not one of them: it belongs to the stage action and the
// workflow engine (see ACTIONS).
//
// The request update and both stage_history writes commit in a single Neon
// transaction. They used to be three independent statements whose error was
// never read, so a failure after the status update returned 200 with the
// request sitting in a new stage and no record of how it got there — the audit
// trail silently diverging from the lifecycle it is supposed to explain.
//
// Cancelling is one of these moves, and closes what waits on the request —
// its undecided approvals and its workflow instance — in the same transaction.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getNeonClient, queryRows } from './_neon.js';
import { nodeIdForStatus } from '../src/lib/workflow/node-config.js';
import { slaDeadlineFor } from '../src/lib/workflow/business-days.js';
import { channelStageMapFromTemplates, referBackTargets } from '../src/lib/workflow/channel-stages.js';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Workflow action failed.';
}

/**
 * The stages a request can be moved to. Mirrors RequestStatus in
 * src/data/types.ts — duplicated rather than imported because that module
 * pulls the whole domain-type graph into a serverless cold start.
 *
 * The endpoint used to write any non-empty string straight into
 * requests.status, so a typo — or a caller inventing one — left a request in a
 * stage no screen knows how to render and no transition can leave. The
 * client's stage machine (src/lib/workflow) has never had a server
 * counterpart; this is the minimum half of it, and it is a validity check, not
 * a legality check: it says the stage exists, not that this request may go
 * there next. See the security assessment for the rest.
 */
const REQUEST_STATUSES = new Set([
  'draft', 'intake', 'validation', 'approval', 'risk', 'onboarding', 'sourcing',
  'contracting', 'po', 'receipt', 'invoice', 'payment', 'completed', 'cancelled',
  'referred-back',
]);

/**
 * Stages a request does not leave. A completed or cancelled request is closed:
 * nothing here moves it on, whatever the caller asks — a drag on the board, a
 * replayed call, a refer-back of a request that is over.
 */
const CLOSED_STATUSES = new Set(['completed', 'cancelled']);

/**
 * The moves this endpoint makes. Stage exits — a gate cleared, the last
 * approval in, a goods receipt — belong to the request's stage action and the
 * workflow engine, which check role, blocking forms, onboarding gates and
 * approvals first. This endpoint took any action label to any existing stage,
 * so the Active Workflows board moved requests past all of that (found
 * 2026-09-26; the board is view-only now). It takes the three moves the request
 * page makes through it, each with its own rule:
 *   referred-back — to an earlier rework stage of the request's own lifecycle
 *   reassigned    — a new owner, the same stage
 *   cancelled     — to cancelled, with a reason
 */
const ACTIONS = new Set(['referred-back', 'reassigned', 'cancelled']);

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed', code: 'method_not_allowed' });
    return;
  }

  const { requestId, action, newStatus, ownerId, notes } = (req.body ?? {}) as {
    requestId?: unknown; action?: unknown; newStatus?: unknown; ownerId?: unknown; notes?: unknown;
  };

  if (typeof requestId !== 'string' || typeof action !== 'string' || typeof newStatus !== 'string'
    || !requestId.trim() || !action.trim() || !newStatus.trim()) {
    res.status(400).json({ error: 'requestId, action and newStatus are required.', code: 'validation_error' });
    return;
  }
  // Trimmed once, and every rule and write below reads these: a padded label
  // must not pass one check as one move and slip past another.
  const move = action.trim();
  const target = newStatus.trim();
  if (!REQUEST_STATUSES.has(target)) {
    res.status(400).json({ error: 'That is not a stage a request can be in.', code: 'unknown_stage' });
    return;
  }
  if (!ACTIONS.has(move)) {
    res.status(400).json({ error: 'A stage moves on the request page, through its stage action.', code: 'unsupported_action' });
    return;
  }
  // Cancel and only Cancel reaches cancelled.
  if ((move === 'cancelled') !== (target === 'cancelled')) {
    res.status(400).json({ error: 'Only cancelling moves a request to cancelled.', code: 'invalid_move' });
    return;
  }
  // Cancelling ends the request for everyone waiting on it, so it says why.
  // The reason is the stage history's note — the record of the decision.
  const cancelling = target === 'cancelled';
  if (cancelling && (typeof notes !== 'string' || !notes.trim())) {
    res.status(400).json({ error: 'Say why the request is being cancelled.', code: 'reason_required' });
    return;
  }

  try {
    const sql = getNeonClient();
    // Read before the transaction: the previous stage decides which history row
    // to close, and Neon's HTTP transaction takes a prepared list of statements
    // rather than an open session we could read inside.
    const existing = await queryRows(
      sql,
      'SELECT status, owner_id, refer_back_count, workflow_template_id, buying_channel FROM requests WHERE id = $1',
      [requestId],
    );
    if (!existing[0]) {
      res.status(404).json({ error: 'Request not found.', code: 'request_not_found' });
      return;
    }

    const oldStatus = String(existing[0].status);
    if (CLOSED_STATUSES.has(oldStatus) && oldStatus !== target) {
      res.status(409).json({ error: 'This request is closed, so it cannot move to another stage.', code: 'request_closed' });
      return;
    }
    // A reassignment keeps the stage; moving it is not a reassignment.
    if (move === 'reassigned' && (target !== oldStatus || typeof ownerId !== 'string' || !ownerId)) {
      res.status(400).json({ error: 'A reassignment names a new owner and keeps the stage.', code: 'invalid_move' });
      return;
    }
    // Back, never forward: an earlier rework stage of the request's own
    // lifecycle, read from the stored templates as the stepper reads them.
    if (move === 'referred-back') {
      const templates = await queryRows(sql, 'SELECT id, channels, nodes, edges FROM workflow_templates', []);
      const targets = referBackTargets(
        channelStageMapFromTemplates(templates as unknown as Parameters<typeof channelStageMapFromTemplates>[0]),
        (existing[0].buying_channel as string | null) ?? undefined,
        oldStatus,
      );
      if (!targets.includes(target as (typeof targets)[number])) {
        res.status(400).json({ error: 'A request is referred back only to an earlier stage it has been through.', code: 'invalid_move' });
        return;
      }
    }
    const now = new Date().toISOString();
    const historyOwner = (typeof ownerId === 'string' && ownerId) || existing[0].owner_id || null;
    const noteText = typeof notes === 'string' ? notes : null;

    // The new stage's clock, from the template node the request is moving into.
    //
    // This endpoint changed `status` and left `sla_deadline` alone, so a request
    // carried the *previous* stage's deadline forward: move out of a 1-day
    // Intake into a 20-day Sourcing and the countdown stayed on the intake
    // deadline, went red the next morning, and put the request in the Stuck and
    // bottleneck views for the remaining nineteen days. The browser path
    // (transition.ts) has always recomputed it; this one is the server half.
    //
    // Written on every stage change, including as NULL: a stage whose node sets
    // no `slaDays` has no deadline, and keeping the old one is exactly the bug.
    const templateId = existing[0].workflow_template_id as string | null;
    const templateNodes = templateId
      ? (await queryRows(sql, 'SELECT nodes FROM workflow_templates WHERE id = $1', [templateId]))[0]?.nodes
      : null;
    const stageNodes = Array.isArray(templateNodes)
      ? templateNodes as Array<{ id: string; type?: string; label?: string; slaDays?: number }>
      : [];
    const stageNodeId = nodeIdForStatus(stageNodes, target);
    const slaDeadline = slaDeadlineFor(
      new Date(now),
      stageNodes.find((n) => n.id === stageNodeId)?.slaDays,
    );

    const updates: string[] = ['status = $1', 'updated_at = $2', 'days_in_stage = 0'];
    const values: unknown[] = [target, now];
    if (oldStatus !== target) {
      values.push(slaDeadline);
      updates.push(`sla_deadline = $${values.length}`);
    }
    if (typeof ownerId === 'string' && ownerId) {
      values.push(ownerId);
      updates.push(`owner_id = $${values.length}`);
    }
    if (move === 'referred-back') {
      values.push(Number(existing[0].refer_back_count ?? 0) + 1);
      updates.push(`refer_back_count = $${values.length}`);
    }
    values.push(requestId);

    const queries = [
      sql.query(`UPDATE requests SET ${updates.join(', ')} WHERE id = $${values.length}`, values),
    ];

    // A reassignment keeps the stage, so a plain `oldStatus !== target` test
    // never fired for it and the owner change was recorded nowhere. An owner
    // change is a history event in its own right — but only when the owner
    // actually changed: writing a row for a call that changed nothing would
    // record a handover that never happened.
    const ownerChanged = typeof ownerId === 'string' && ownerId !== '' && ownerId !== existing[0].owner_id;
    if (oldStatus !== target || ownerChanged) {
      // Close whatever is currently open for this request before opening the
      // next row — including on the same-stage path. Two rows with a null
      // completed_at for one stage make "the current stage row" ambiguous, and
      // every consumer that reads it would get an arbitrary one of the two.
      queries.push(sql.query(
        'UPDATE stage_history SET completed_at = $1 WHERE request_id = $2 AND completed_at IS NULL',
        [now, requestId],
      ));
      queries.push(sql.query(
        'INSERT INTO stage_history (request_id, stage, entered_at, owner_id, action, notes) VALUES ($1, $2, $3, $4, $5, $6)',
        [requestId, target, now, historyOwner, move, noteText],
      ));
    }

    // Cancelling, in the same transaction. Cancel used to hand the outcome to
    // the workflow engine, which had no branch for it: with an instance it took
    // the stage's default edge and moved the request ON, and without one it did
    // nothing while the page said "Request cancelled". Now the request stops
    // here, and so does everything waiting on it: undecided approvals are
    // withdrawn — not rejected, which nobody did — so they leave every queue,
    // and the workflow instance stops, so the engine never advances it again.
    if (cancelling && oldStatus !== 'cancelled') {
      queries.push(sql.query(
        `UPDATE approval_entries SET status = 'withdrawn', responded_at = $1
         WHERE request_id = $2 AND status IN ('pending', 'info-requested', 'delegated')`,
        [now, requestId],
      ));
      queries.push(sql.query(
        `UPDATE workflow_instances SET status = 'cancelled', current_node_ids = '[]'::jsonb, updated_at = $1
         WHERE request_id = $2 AND status <> 'completed'`,
        [now, requestId],
      ));
    }

    await sql.transaction(queries);

    const saved = await queryRows(sql, 'SELECT * FROM requests WHERE id = $1', [requestId]);
    res.status(200).json(saved[0] ?? null);
  } catch (error) {
    // The message can name columns and constraints; log it, return a code.
    console.error('[workflow-action]', errorMessage(error));
    res.status(500).json({ error: 'Could not complete the workflow action.', code: 'workflow_action_failed' });
  }
}
