// Workflow stage transitions: the one server-side path that moves a request
// between lifecycle stages and keeps its stage history honest.
//
// The request update and both stage_history writes commit in a single Neon
// transaction. They used to be three independent statements whose error was
// never read, so a failure after the status update returned 200 with the
// request sitting in a new stage and no record of how it got there — the audit
// trail silently diverging from the lifecycle it is supposed to explain.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getNeonClient, queryRows } from './_neon.js';
import { nodeIdForStatus } from '../src/lib/workflow/node-config.js';
import { slaDeadlineFor } from '../src/lib/workflow/business-days.js';

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
  if (!REQUEST_STATUSES.has(newStatus.trim())) {
    res.status(400).json({ error: 'That is not a stage a request can be in.', code: 'unknown_stage' });
    return;
  }

  try {
    const sql = getNeonClient();
    // Read before the transaction: the previous stage decides which history row
    // to close, and Neon's HTTP transaction takes a prepared list of statements
    // rather than an open session we could read inside.
    const existing = await queryRows(
      sql,
      'SELECT status, owner_id, refer_back_count, workflow_template_id FROM requests WHERE id = $1',
      [requestId],
    );
    if (!existing[0]) {
      res.status(404).json({ error: 'Request not found.', code: 'request_not_found' });
      return;
    }

    const oldStatus = String(existing[0].status);
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
    const stageNodeId = nodeIdForStatus(stageNodes, newStatus);
    const slaDeadline = slaDeadlineFor(
      new Date(now),
      stageNodes.find((n) => n.id === stageNodeId)?.slaDays,
    );

    const updates: string[] = ['status = $1', 'updated_at = $2', 'days_in_stage = 0'];
    const values: unknown[] = [newStatus, now];
    if (oldStatus !== newStatus) {
      values.push(slaDeadline);
      updates.push(`sla_deadline = $${values.length}`);
    }
    if (typeof ownerId === 'string' && ownerId) {
      values.push(ownerId);
      updates.push(`owner_id = $${values.length}`);
    }
    if (action === 'referred-back') {
      values.push(Number(existing[0].refer_back_count ?? 0) + 1);
      updates.push(`refer_back_count = $${values.length}`);
    }
    values.push(requestId);

    const queries = [
      sql.query(`UPDATE requests SET ${updates.join(', ')} WHERE id = $${values.length}`, values),
    ];

    // A reassignment keeps the stage, so a plain `oldStatus !== newStatus` test
    // never fired for it and the owner change was recorded nowhere. An owner
    // change is a history event in its own right — but only when the owner
    // actually changed: writing a row for a call that changed nothing would
    // record a handover that never happened.
    const ownerChanged = typeof ownerId === 'string' && ownerId !== '' && ownerId !== existing[0].owner_id;
    if (oldStatus !== newStatus || ownerChanged) {
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
        [requestId, newStatus, now, historyOwner, action, noteText],
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
