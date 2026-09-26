// A contract call-off's details, asked as a conversation.
//
// These are the fields the call-off form asked for (contract-call-off-checkout),
// with the same rules — the governed checkout needs every one — but filled from
// what is already known first: the words the requester used, their profile's
// cost centre and delivery location, and who they are buying for. What is left
// is asked, one at a time, in the order an approver reads a call-off. A choice
// between configured rows (where it is delivered, what it is charged to) is
// answered with buttons, never parsed out of prose.
//
// Pure and relative-imported, so a node test drives it.
import { parseDeliveryDate } from '../../../../lib/parse-delivery-date.js';
import { parseAmount } from '../../../../lib/procurement/policy-answers.js';

/** What a contract call-off needs: the requester-owned fields the governed checkout takes. */
export interface ContractCallOffDraft {
  title: string;
  value: number;
  needBy: string;
  serviceStartDate: string;
  serviceEndDate: string;
  deliveryLocation: string;
  recipient: string;
  purpose: string;
  costCentre: string;
}

export type CallOffFieldId = keyof ContractCallOffDraft;

export interface CallOffQuestion {
  field: CallOffFieldId;
  /** The panel's label. */
  label: string;
  /** What the assistant asks. */
  prompt: string;
  /** How the answer is given: typed, or picked from configured rows. */
  answer: 'text' | 'money' | 'date' | 'choice';
  /** Needed before the call-off can be placed. Service dates are asked but may stay open. */
  required: boolean;
  /**
   * A second field the same answer fills. For a service the start IS the
   * need-by date and the service start — the checkout reads both, and asking
   * twice for one date is how a form felt like a form.
   */
  alsoSets?: CallOffFieldId;
}

/**
 * Services are delivered over a period, so their start and end are asked; goods
 * are delivered by a date. The same rule the form applied.
 */
export function needsServiceDates(contractCategory: string | undefined): boolean {
  const category = (contractCategory ?? '').toLowerCase();
  return category.includes('service') || category.includes('consult');
}

/** The call-off's questions, in the order they are asked. */
export function callOffQuestions(contractCategory: string | undefined): CallOffQuestion[] {
  const services = needsServiceDates(contractCategory);
  return [
    { field: 'title', label: 'What', prompt: 'What is being called off, in a line?', answer: 'text', required: true },
    { field: 'value', label: 'Value', prompt: 'What is this call-off worth?', answer: 'money', required: true },
    services
      ? { field: 'needBy', label: 'Start', prompt: 'When should the work start?', answer: 'date', required: true, alsoSets: 'serviceStartDate' }
      : { field: 'needBy', label: 'Need by', prompt: 'When do you need it by?', answer: 'date', required: true },
    ...(services ? [{ field: 'serviceEndDate' as const, label: 'Service end', prompt: 'And when should the work end?', answer: 'date' as const, required: false }] : []),
    { field: 'recipient', label: 'For', prompt: 'Who is it for — a person or a team?', answer: 'text', required: true },
    { field: 'purpose', label: 'Business purpose', prompt: 'What is it for, in a sentence the approver will read?', answer: 'text', required: true },
    { field: 'deliveryLocation', label: 'Deliver to', prompt: 'Where should it be delivered?', answer: 'choice', required: true },
    { field: 'costCentre', label: 'Charged to', prompt: 'Which cost centre should it be charged to?', answer: 'choice', required: true },
  ];
}

export interface CallOffPrefill {
  title?: string;
  value?: number;
  needBy?: string;
  /** Whom the requester is buying for, when it is not themselves. */
  recipient?: string;
  costCentre?: string;
  deliveryLocation?: string;
}

/** A draft from what is already known — never an invented value. */
export function prefillCallOff(known: CallOffPrefill, contractCategory?: string): ContractCallOffDraft {
  const needBy = parseDeliveryDate(known.needBy ?? '') ?? '';
  return {
    title: known.title?.trim() ?? '',
    value: known.value && known.value > 0 ? known.value : 0,
    needBy,
    serviceStartDate: needsServiceDates(contractCategory) ? needBy : '',
    serviceEndDate: '',
    recipient: known.recipient?.trim() ?? '',
    purpose: '',
    costCentre: known.costCentre ?? '',
    deliveryLocation: known.deliveryLocation ?? '',
  };
}

function isAnswered(draft: ContractCallOffDraft, field: CallOffFieldId): boolean {
  const value = draft[field];
  return typeof value === 'number' ? value > 0 : Boolean(value && String(value).trim());
}

/**
 * The next question, or null when nothing is left to ask. `passed` holds the
 * optional ones the requester chose to leave open, so they are not asked again.
 */
export function nextCallOffQuestion(
  questions: CallOffQuestion[],
  draft: ContractCallOffDraft,
  passed: ReadonlySet<CallOffFieldId> = new Set(),
): CallOffQuestion | null {
  return questions.find((q) => !isAnswered(draft, q.field) && !passed.has(q.field)) ?? null;
}

/** The questions still to ask — how the call-off's opening counts what is left. */
export function callOffRemaining(questions: CallOffQuestion[], draft: ContractCallOffDraft): CallOffQuestion[] {
  return questions.filter((q) => !isAnswered(draft, q.field));
}

/** "N of M": the required details that are in. */
export function callOffProgress(questions: CallOffQuestion[], draft: ContractCallOffDraft): { known: number; required: number } {
  const required = questions.filter((q) => q.required);
  return { known: required.filter((q) => isAnswered(draft, q.field)).length, required: required.length };
}

/** What is still needed, in the panel's words. */
export function callOffMissing(questions: CallOffQuestion[], draft: ContractCallOffDraft): string[] {
  return questions.filter((q) => q.required && !isAnswered(draft, q.field)).map((q) => q.label.toLowerCase());
}

/** Answers that mean "I don't know yet" — an optional date is then left open. */
const NOT_KNOWN = /^(not (yet )?(known|sure|decided)( yet)?|don'?t know( yet)?|unknown|tbd|tbc|n\/?a|skip|no end( date)?|open[- ]ended)\.?$/i;

export type CallOffAnswer =
  | { ok: true; draft: ContractCallOffDraft; passed?: CallOffFieldId }
  /** `overLimit`: the amount needs a mini-competition — a new request, not a call-off. */
  | { ok: false; retry: string; overLimit?: true };

/**
 * Apply a typed answer to the question it answers.
 *
 * A date or an amount that does not parse is asked again with an example
 * rather than written — the checkout would refuse it later, and a date column
 * cannot hold prose. An optional date answered "not known" is left open. A
 * choice question is answered with its buttons, so typing is refused here.
 */
export function applyCallOffAnswer(
  question: CallOffQuestion,
  text: string,
  draft: ContractCallOffDraft,
  limits: { directCallOffLimit: number },
): CallOffAnswer {
  const answer = text.trim();
  if (!answer) return { ok: false, retry: question.prompt };
  switch (question.answer) {
    case 'choice':
      return { ok: false, retry: 'Pick one of the options above.' };
    case 'money': {
      const amount = parseAmount(answer) ?? (/^\s*€?\s*[\d][\d,.]*\s*$/.test(answer) ? Number(answer.replace(/[€,\s]/g, '')) : null);
      if (!amount || !Number.isFinite(amount) || amount <= 0) {
        return { ok: false, retry: 'Please give an amount, for example €20,000 or 20k.' };
      }
      // Above the direct call-off limit the award needs a mini-competition among
      // the contract's suppliers, and the checkout refuses it — said here, at the
      // value, not after submit.
      if (amount > limits.directCallOffLimit) {
        return { ok: false, retry: `€${amount.toLocaleString('en-GB')} is above the €${limits.directCallOffLimit.toLocaleString('en-GB')} direct call-off limit, so it needs a mini-competition among the contract's suppliers. Give a smaller amount, or raise it as a new request instead.`, overLimit: true };
      }
      return { ok: true, draft: { ...draft, value: amount } };
    }
    case 'date': {
      if (!question.required && NOT_KNOWN.test(answer)) return { ok: true, draft, passed: question.field };
      const parsed = parseDeliveryDate(answer);
      if (!parsed) return { ok: false, retry: 'Please give a date, for example 31 March 2027 or 2027-03-31.' };
      const next = { ...draft, [question.field]: parsed, ...(question.alsoSets ? { [question.alsoSets]: parsed } : {}) };
      // The end cannot come before the start — the form held it, so does this.
      if (question.field === 'serviceEndDate' && next.needBy && parsed < next.needBy) {
        return { ok: false, retry: `The end has to be on or after the start (${next.needBy}).` };
      }
      return { ok: true, draft: next };
    }
    case 'text':
      return { ok: true, draft: { ...draft, [question.field]: answer } };
  }
}
