import type { AssistantTurn, ConfirmTurn } from '@/data/types';
import type { ProviderContext } from '../provider';

// In-memory activity log — Phase 2 will write to Supabase audit_entries.
interface ActivityEntry {
  id: string;
  actionType: string;
  description: string;
  performedBy: string;
  timestamp: string;
  params: Record<string, unknown>;
}

const activityLog: ActivityEntry[] = [];

export function getActivityLog(): ActivityEntry[] {
  return activityLog;
}

function appendActivity(ctx: ProviderContext, actionType: string, description: string, params: Record<string, unknown>): void {
  activityLog.push({
    id: `ACT-${Date.now()}`,
    actionType,
    description,
    performedBy: ctx.currentUser.name,
    timestamp: new Date().toISOString(),
    params,
  });
}

// In-memory watcher lists — keyed by requestId.
const watcherMap = new Map<string, string[]>();

// Pending proposed actions awaiting user confirmation.
const pendingActions = new Map<string, { actionType: string; params: Record<string, unknown> }>();

// User settings stored in-memory (Phase 2 → Supabase users table).
interface UserSettings {
  delegateId?: string;
  delegateName?: string;
  isOOO: boolean;
  oooUntil?: string;
}

const userSettings = new Map<string, UserSettings>();

function getUserSettings(userId: string): UserSettings {
  if (!userSettings.has(userId)) {
    userSettings.set(userId, { isOOO: false });
  }
  return userSettings.get(userId)!;
}

// ─── propose ────────────────────────────────────────────────────────────────

export function proposeAction(
  actionType: string,
  params: Record<string, unknown>,
  ctx: ProviderContext
): AssistantTurn[] {
  const actionId = `pa-${Date.now()}`;
  pendingActions.set(actionId, { actionType, params });

  const readBack = buildReadBack(actionType, params, ctx);
  if (!readBack) {
    return [{ type: 'chat-answer', content: `I don't recognise the action "${actionType}". Please rephrase your request.` }];
  }

  const confirmTurn: ConfirmTurn = {
    type: 'confirm',
    readBack,
    actionType,
    actionParams: params,
    actionId,
  };

  return [confirmTurn];
}

function buildReadBack(actionType: string, params: Record<string, unknown>, ctx: ProviderContext): string | null {
  switch (actionType) {
    case 'add_watcher':
      return `Add **${ctx.currentUser.name}** as a watcher to request **${params.requestId ?? '(request ID required)'}**.`;
    case 'set_delegate':
      return `Set your approval delegate to **${params.delegateName ?? params.delegateId ?? '(delegate required)'}**${params.until ? ` until ${params.until}` : ''}.`;
    case 'set_ooo':
      return `Mark **${ctx.currentUser.name}** as out-of-office${params.until ? ` until ${params.until}` : ''}.`;
    case 'approver_substitution':
      return `Substitute approver **${params.originalApprover}** with **${params.substituteApprover}** on request **${params.requestId}**.`;
    case 'reassign_request':
      return `Reassign request **${params.requestId}** to **${params.newOwner}**.`;
    case 'request_risk_reassessment':
      return `Request a risk reassessment for supplier/contract **${params.subjectId}**. A task will be routed to the Vendor Management team.`;
    case 'request_contract_renewal':
      return `Raise a contract renewal request for **${params.contractId}**. The contract owner will be notified.`;
    case 'request_po_change':
      return `Raise a PO change request for **${params.poId}** — ${params.changeDescription ?? 'no description provided'}.`;
    case 'raise_payment_escalation':
      return `Raise a payment-status escalation for invoice **${params.invoiceId}**. Procurement Operations will be notified.`;
    default:
      return null;
  }
}

// ─── execute ────────────────────────────────────────────────────────────────

export function executeAction(turn: ConfirmTurn, ctx: ProviderContext): AssistantTurn[] {
  const pending = pendingActions.get(turn.actionId);
  if (!pending) {
    return [{ type: 'chat-answer', content: 'This action has already been executed or has expired.' }];
  }
  pendingActions.delete(turn.actionId);

  const { actionType, params } = pending;

  switch (actionType) {
    case 'add_watcher': {
      const reqId = String(params.requestId ?? '');
      const watchers = watcherMap.get(reqId) ?? [];
      if (!watchers.includes(ctx.currentUser.id)) {
        watchers.push(ctx.currentUser.id);
        watcherMap.set(reqId, watchers);
      }
      appendActivity(ctx, actionType, `${ctx.currentUser.name} added as watcher to ${reqId}`, params);
      return [
        {
          type: 'chat-answer',
          content: `Done — you're now watching **${reqId}**. You'll receive notifications when the status changes.`,
        },
      ];
    }

    case 'set_delegate': {
      const settings = getUserSettings(ctx.currentUser.id);
      settings.delegateId = String(params.delegateId ?? params.delegateName ?? '');
      settings.delegateName = String(params.delegateName ?? params.delegateId ?? '');
      settings.oooUntil = params.until ? String(params.until) : undefined;
      appendActivity(ctx, actionType, `${ctx.currentUser.name} set delegate to ${settings.delegateName}`, params);
      return [
        {
          type: 'chat-answer',
          content: `Done — approvals will be delegated to **${settings.delegateName}**${params.until ? ` until ${params.until}` : ''}. Reference: ACT-${Date.now()}.`,
        },
      ];
    }

    case 'set_ooo': {
      const settings = getUserSettings(ctx.currentUser.id);
      settings.isOOO = true;
      settings.oooUntil = params.until ? String(params.until) : undefined;
      appendActivity(ctx, actionType, `${ctx.currentUser.name} set out-of-office`, params);
      return [
        {
          type: 'chat-answer',
          content: `Done — **${ctx.currentUser.name}** is marked as out-of-office${params.until ? ` until ${params.until}` : ''}. Any pending approvals will escalate after 2 business days.`,
        },
      ];
    }

    case 'approver_substitution':
    case 'reassign_request':
    case 'request_risk_reassessment':
    case 'request_contract_renewal':
    case 'request_po_change':
    case 'raise_payment_escalation': {
      appendActivity(ctx, actionType, buildReadBack(actionType, params, ctx) ?? actionType, params);
      const refId = `ACT-${Date.now()}`;
      return [
        {
          type: 'chat-answer',
          content: `Task created and routed to the relevant team. Reference: **${refId}**. You'll be notified when they respond.`,
        },
      ];
    }

    default:
      return [{ type: 'chat-answer', content: 'Unknown action type — no changes were made.' }];
  }
}
