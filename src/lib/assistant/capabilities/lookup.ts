import { requireConnector, type SourceObject } from '@/lib/integrations';
import type { AssistantTurn, RiskAssessment } from '@/data/types';
import { useAuthStore } from '@/stores/auth-store';
import { STATUS_OBJECT_META, type StatusObject } from '../status-config';
import { answerStatusQuestion } from '../status-lookup';
import type { StatusAnswer } from '../status-answer';

type ObjectType = 'request' | 'supplier' | 'contract' | 'po' | 'invoice' | 'risk-assessment';

// The assistant's record lookups. Requests, POs, invoices, contracts and
// suppliers are status questions, answered through the Status Answers agent's
// configuration (status-lookup.ts). Risk assessments are read here, through the
// connector ports like every upstream object; reads are wrapped so a source
// outage degrades gracefully rather than throwing.
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

/** The assistant's object types → the status agent's. Risk assessments are not a status object. */
const STATUS_TYPE: Partial<Record<ObjectType, StatusObject>> = {
  request: 'request',
  po: 'purchase-order',
  invoice: 'invoice',
  contract: 'contract',
  supplier: 'supplier',
};

/** A status answer as the assistant's turns: the facts, then a link to the record. */
function statusTurns(answer: StatusAnswer | null): AssistantTurn[] {
  if (!answer) return [{ type: 'chat-answer', content: 'I could not look that up.' }];
  if (answer.kind === 'record') {
    const { item } = answer;
    return [
      { type: 'chat-answer', content: [`**${item.title}**`, ...item.facts.map((f) => `${f.label}: ${f.value}`)].join('\n') },
      { type: 'deep-link', label: item.title, description: 'Open the full record', path: item.link },
    ];
  }
  if (answer.kind === 'list') {
    return [{ type: 'chat-answer', content: answer.items.length
      ? [answer.heading, ...answer.items.map((i) => `• ${i.title}${i.facts.length ? ` — ${i.facts.map((f) => `${f.label}: ${f.value}`).join(', ')}` : ''}`)].join('\n')
      : `${answer.heading}: none.` }];
  }
  return [{ type: 'chat-answer', content: answer.message }];
}

export async function lookupObject(type: ObjectType | null, identifier: string): Promise<AssistantTurn[]> {
  const resolvedType = type ?? detectType(identifier);

  if (!resolvedType || !identifier) {
    return [
      {
        type: 'chat-answer',
        content: "I need a specific ID or name to look that up. Try:\n• A request ID — REQ-2024-0001\n• A supplier name\n• A contract ID — CON-003\n• A PO or invoice ID — PO-001, INV-001",
      },
    ];
  }

  if (resolvedType === 'risk-assessment') return lookupRisk(identifier);

  // Everything else is a status question, answered through the Status Answers
  // agent: which attributes, for whose records. This file used to compose its
  // own summary per type — its own column list, readable by anyone.
  const object = STATUS_TYPE[resolvedType] ?? 'supplier';
  const idPattern = STATUS_OBJECT_META[object].idPattern;
  const question = idPattern?.test(identifier)
    ? { object, id: identifier.toUpperCase(), text: identifier }
    : { object, name: identifier, text: identifier };
  const { currentUser, currentRole } = useAuthStore.getState();
  return statusTurns(await answerStatusQuestion(identifier, { userId: currentUser.id, role: currentRole }, question));
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
