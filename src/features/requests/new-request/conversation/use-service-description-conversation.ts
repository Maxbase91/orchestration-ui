// The service-description conversation, without its screen: the engine that
// decides which question comes next, what counts as an answer, when to push
// back once and offer a drafted one, when to give up on a date or a budget, the
// risk questions as its tail, and composing the description when it is done.
//
// It was the body of step-chat-intake.tsx. It moved here unchanged so the
// conversation page (the Intake Prototype's one page for describe, how you'll
// buy and details) can run the same engine in its own transcript — every rule
// below was written against a defect, and a second copy would be a second set
// of defects. The screen is the caller's; this owns no DOM.
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSuppliers } from '@/lib/db/hooks/use-suppliers';
import { useServiceDescriptionTemplate } from '@/lib/db/hooks/use-service-description-templates';
import { computeDemandSignals } from '@/lib/procurement/demand-signals';
import type { DemandSlot } from '@/lib/procurement/demand-conversation';
import { resolveCategoryCode } from '@/lib/procurement/category-code';
import { useCommodityCodeBook } from '@/lib/db/hooks/use-procurement-categories';
import { usePreferredSupplierIds } from '@/lib/db/hooks/use-category-preferred-suppliers';
import { formatCurrency } from '@/lib/format';
import { assessAnswer, type AnswerVerdict } from '@/lib/procurement/answer-quality';
import { parseDeliveryDate } from '@/lib/parse-delivery-date';
import { EXTRACTABLE_FIELDS } from '../extractable-fields';
import { riskSlotsFor } from '@/lib/procurement/residual-question-slots';
import type { MiniIrqField, ResidualQuestion } from '@/lib/procurement/residual-questions';
import {
  applicableSlots,
  conversationProgress,
  determineNextQuestion,
  isConversationComplete,
  resolveSlots,
  type DemandConversationContext,
} from '@/lib/procurement/demand-conversation';
import { DEFAULT_SECTIONS } from '@/lib/procurement/service-description-defaults';
import { conversationComplete, conversationContext } from './conversation-rules';
import type {
  MiniIrqAnswers,
  ServiceDescription,
  ServiceDescriptionSectionKey,
  SectionCapture,
} from '../intake-form-data';


/** What the conversation reads from the request it is describing. */
export interface ConversationData {
  title: string;
  supplier: string;
  supplierId: string;
  estimatedValue: number;
  currency: string;
  businessJustification: string;
  deliveryDate: string;
  isUrgent: boolean;
  costCentre: string;
  commodityCode: string;
  commodityCodeLabel: string;
  serviceDescription?: ServiceDescription | null;
}

export interface ServiceDescriptionConversationInput {
  category: string;
  data: ConversationData;
  onUpdate: (data: Record<string, unknown>) => void;
  /**
   * The criteria-driven risk questions this demand triggers, from the
   * determination. They are asked as the tail of the conversation rather than
   * as a card of switches below it — a requester answering questions should not
   * have to notice that two of them live somewhere else.
   */
  riskQuestions?: readonly ResidualQuestion[];
  /** Answers so far. An absent key means the question has not been answered. */
  riskAnswers?: MiniIrqAnswers;
  /**
   * Whether the conversation has started. The conversation page holds the
   * engine from the start, before it knows the demand is a new request; nothing
   * is asked or composed until this turns true.
   */
  enabled?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /**
   * The "asked because…" line for a conditional question, kept ON the message
   * rather than in a single piece of state so it stays attached to the question
   * it explains when the requester scrolls back.
   */
  why?: string;
  /**
   * A worked example for the question, rendered as a distinct hint rather than
   * glued onto the sentence — appended, it read as the assistant answering its
   * own question with an unrelated project.
   *
   * Only carried when the question is the ENGINE's canned wording. When the
   * assistant has phrased the question against what the requester actually
   * described, a generic example adds nothing and is left off.
   */
  example?: string;
  /**
   * A drafted answer offered after a challenge, which the requester can accept
   * as their own. Present only on a challenge message, and only when the
   * assistant could ground a draft in what they had already said.
   */
  draft?: { slotId: string; text: string };
  /**
   * A yes/no governance question, answered by pressing a button.
   *
   * Never by typing: the answer is recorded as evidence, and a model that
   * extracted it from prose would be answering on the requester's behalf.
   */
  choice?: { slotId: string; field: MiniIrqField };
}


// Stable identities for the optional props: an inline `= []` default would be a
// new reference each render and destabilise every memo that depends on it.
const EMPTY_RISK_QUESTIONS: readonly ResidualQuestion[] = [];
const EMPTY_RISK_ANSWERS: MiniIrqAnswers = {};

/**
 * The `choice` payload for a question, when it is a yes/no one.
 *
 * Every site that appends the next question goes through this. A risk question
 * rendered without it would leave the requester a disabled input and no way to
 * answer — the text box is disabled precisely because the buttons are the only
 * legitimate way in.
 */
function choiceFor(slot: DemandSlot | undefined): { choice: { slotId: string; field: MiniIrqField } } | Record<string, never> {
  if (!slot || slot.answerType !== 'yes-no' || slot.target.kind !== 'risk') return {};
  return { choice: { slotId: slot.id, field: slot.target.field } };
}



// The service-description components come from the resolved template, not from
// a list in this file. A hardcoded nine was a second source of truth: since the
// conversation began running off the configured template, the panel and the
// conversation could disagree about which sections exist — the same drift as
// the three narrative composers and the duplicate classifier.



/**
 * Deterministic fallback used only when the LLM endpoint is unavailable. Writes
 * the user's answer into whichever slot the engine is currently asking for, then
 * asks the engine for the next one — so the same adaptive, carry-forward flow
 * runs offline. Mandatory SOW still holds (completeness = engine agenda empty).
 */
function localFallbackResponse(
  userText: string,
  category: string,
  data: ConversationData,
  svcDesc: Partial<ServiceDescription>,
  slots: DemandSlot[],
  risk: MiniIrqAnswers,
): {
  extracted: Record<string, unknown>;
  sow: Partial<ServiceDescription>;
  nextQuestion: string;
  warning?: string;
  /** The rationale for `nextQuestion`, when it is a conditional slot. */
  why?: string;
  /** A worked example for `nextQuestion`, shown as a hint beneath it. */
  example?: string;
  /**
   * The slot `nextQuestion` belongs to.
   *
   * Returned so the caller can tell a yes/no governance question from a prose
   * one and render the choice. Without it the question arrived as bare text and
   * the requester got a disabled input with no buttons to press.
   */
  nextSlot?: DemandSlot;
  complete: boolean;
} {
  const extracted: Record<string, unknown> = {};
  const sowUpdate: Partial<ServiceDescription> = {};
  let warning: string | undefined;

  // Which slot is the user answering right now?
  const answering = determineNextQuestion(conversationContext(category, data, svcDesc, risk), undefined, slots)?.slot;
  if (answering) {
    if (answering.target.kind === 'request') {
      if (answering.target.field === 'estimatedValue') {
        const m = userText.match(/[\d,]+[kK]|\d[\d,.]+/);
        if (m) {
          let val = m[0].replace(/,/g, '');
          if (val.toLowerCase().endsWith('k')) val = String(Number(val.slice(0, -1)) * 1000);
          const num = Number(val);
          if (num > 0) extracted.estimatedValue = num;
        }
        // No number in the answer ("not known", "TBD"). Flagged the same way
        // an unreadable date is, so the caller can give up after a second
        // attempt instead of re-asking the same question forever.
        if (extracted.estimatedValue === undefined) {
          warning = 'Please give an approximate figure, or say it is not known yet.';
        }
      } else {
        if (answering.target.field === 'deliveryDate') {
          // A date slot must carry a real date forward. Keeping a prose answer
          // here made the review appear complete and later persisted unusable
          // text into a DATE column.
          // Leave the field absent rather than writing '' when the answer is
          // not a date — the LLM path already deletes the key, and an empty
          // string reaches the DATE column as a value Postgres cannot parse.
          const parsed = parseDeliveryDate(userText);
          if (parsed) extracted.deliveryDate = parsed;
          else warning = 'Please enter a specific need-by date, for example 2026-12-31.';
        } else extracted[answering.target.field] = userText.slice(0, 200);
      }
    } else if (answering.target.kind === 'sow') {
      sowUpdate[answering.target.field] = userText;
    }
    // A `risk` slot is never answered here. It is answered by pressing Yes or
    // No, and the text input is disabled while one is pending — a governance
    // answer must come from the requester, not from parsing their prose.
  }

  // Recompute against the just-captured answer to get the next question.
  const nextData = { ...data, ...(extracted as Partial<ConversationData>) };
  const nextSow = { ...svcDesc, ...sowUpdate };
  const ctx = conversationContext(category, nextData, nextSow, risk);
  const complete = isConversationComplete(ctx, undefined, slots);

  if (complete) {
    // NO narrative offline.
    //
    // This used to join the raw answers with a "drafted without AI polishing"
    // disclaimer and present the result as the service description — which,
    // when the answers were short, rendered as a bare list of them. A service
    // description is either written by the assistant or it does not exist yet;
    // an unpolished join is not a third thing worth showing.
    //
    // The captured sections are the real content and are all displayed. The
    // narrative and the business justification are written when generation
    // runs, which is also where the quality score comes from.
    return { extracted, sow: sowUpdate, nextQuestion: buildCompletionMessage(ctx, slots), ...(warning ? { warning } : {}), complete: true };
  }

  const next = determineNextQuestion(ctx, undefined, slots);
  return {
    extracted,
    sow: sowUpdate,
    nextQuestion: next?.prompt ?? '',
    nextSlot: next?.slot,
    why: next?.why,
    // Offline the wording is always the engine's, so the example earns its place.
    example: next?.example,
    ...(warning ? { warning } : {}), complete: false,
  };
}

/**
 * What the assistant says when the agenda empties.
 *
 * The conversation used to end on a green chip and, in the offline path, a
 * one-line "click Next". Nothing told the requester what had actually been
 * captured or what would be done with it — so the step that produces the
 * document reused by risk, sourcing and contracting ended more quietly than a
 * form submission.
 */
function buildCompletionMessage(
  ctx: DemandConversationContext,
  slots: DemandSlot[],
): string {
  // No field list: the conversation page's panel shows every answer beside the
  // transcript, so naming them here said the same thing twice.
  const asked = applicableSlots(ctx, undefined, slots).length;
  return [
    `That covers the service description — ${asked} ${asked === 1 ? 'answer' : 'answers'}.`,
    'I am writing it up from what you said. The risk assessment and any sourcing event read it, so you will not be asked for any of it again.',
  ].join('\n');
}

/**
 * The text sections of a service description, without the provenance map.
 *
 * `captureFlags` is an object living alongside string sections, so anything
 * that walks the values — the signal read, the generator payload, the risk
 * summary — has to be handed the text only. One helper, used at every such
 * boundary, rather than each caller remembering.
 */
function sectionsOnly(sd: Partial<ServiceDescription>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(sd).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

/**
 * The assistant's verdict on the last answer, when it returned a usable one.
 *
 * Returns undefined — meaning "no verdict, fall back to the deterministic
 * judge" — for anything malformed, so a model that omits the field or returns
 * the wrong shape degrades to the offline behaviour instead of silently
 * approving everything.
 */
function readVerdict(raw: unknown): AnswerVerdict | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const v = raw as { addresses?: unknown; reason?: unknown };
  if (typeof v.addresses !== 'boolean') return undefined;
  return {
    addresses: v.addresses,
    reason: typeof v.reason === 'string' && v.reason.trim() ? v.reason.trim() : undefined,
  };
}

/**
 * What the assistant says when it pushes back.
 *
 * Names the gap, then either offers the draft or re-asks. Deliberately short
 * and non-scolding: the requester is doing their job, not taking a test.
 */
function buildChallenge(reason: string | undefined, slot: DemandSlot, suggested: string): string {
  const gap = reason ?? 'that does not tell me enough';
  return suggested
    ? `Sorry — ${gap}. Based on what you've told me so far, I'd put it like this:\n\n“${suggested}”\n\nUse that, or write your own?`
    : `Sorry — ${gap}. ${slot.prompt}`;
}

/**
 * Is the model's phrasing usable as the next question?
 *
 * The endpoint instructs it to ask exactly the engine's question, rephrased
 * only for tone. This checks it came back looking like that — one short
 * question — rather than trusting it blindly: a model that returns a paragraph,
 * an empty string, or a statement would otherwise replace a question the
 * requester has to answer.
 */
function usableQuestion(text: unknown): string | undefined {
  if (typeof text !== 'string') return undefined;
  const t = text.trim();
  if (t.length < 8 || t.length > 320) return undefined;
  if (!t.includes('?')) return undefined;
  return t;
}

export function useServiceDescriptionConversation({ category, data, onUpdate, riskQuestions = EMPTY_RISK_QUESTIONS, riskAnswers = EMPTY_RISK_ANSWERS, enabled = true }: ServiceDescriptionConversationInput) {
  const { data: suppliers = [] } = useSuppliers();
  const codeBook = useCommodityCodeBook();
  const preferredSupplierIds = usePreferredSupplierIds(category);
  // Which questions get asked, and which sections compose the compact narrative,
  // are admin config (/admin/service-description). Resolution is category-first
  // with a `default` row and the built-in template beneath, so an empty table
  // behaves exactly as the hardcoded slot set did.
  const { data: sdTemplate } = useServiceDescriptionTemplate(category);
  // The sections the panel lists, from the resolved template. `asked: false`
  // sections (today, `location`) are GENERATED, never captured — listing them
  // as outstanding was the progress bar's biggest lie.
  const sections = sdTemplate?.sections ?? DEFAULT_SECTIONS;
  // The sections come with the slots: a section the template's rules make
  // mandatory for this demand makes the question that fills it asked and
  // required, so the conversation and the Channel page count one set.
  const configuredSlots = useMemo(() => resolveSlots(sdTemplate?.slots, sections), [sdTemplate, sections]);
  /**
   * Slots the requester could not answer, dropped from the agenda.
   *
   * The need-by date has a parser behind it, so an answer it cannot read is
   * rejected before it is written — which meant the same question came back
   * forever. A requester who does not yet know the date had no way past it, and
   * the conversation could not reach the sections that actually matter.
   *
   * This is the same rule the rest of the conversation already follows: push
   * back once, then take what you are given. Asking a third time is not
   * diligence, it is a loop.
   */
  const [skippedSlots, setSkippedSlots] = useState<Set<string>>(() => new Set());
  // The description slots, then the risk questions. `buildAgenda` preserves
  // order, so the risk phase falls out as the tail of the same agenda — one
  // completeness rule, one progress count, no second state machine.
  const descriptionSlots = useMemo(
    () => configuredSlots.filter((slot) => !skippedSlots.has(slot.id)),
    [configuredSlots, skippedSlots],
  );
  const slots = useMemo(
    () => [...descriptionSlots, ...riskSlotsFor(riskQuestions)],
    [descriptionSlots, riskQuestions],
  );
  /** Unreadable answers so far, per slot — today the need-by date and the budget. */
  const unresolvedAttemptsRef = useRef<Record<string, number>>({});

  /**
   * One rule for both paths and both fields: prompt once more, then take
   * "not known" for an answer and move on.
   *
   * Originally date-only. The budget slot hit the identical failure mode: a
   * requester who does not yet know the figure ("not known", "TBD") has no
   * extractable number, so with nothing to give up on the engine kept
   * re-asking the same question forever. This covers both rather than
   * growing a second copy of the same logic.
   */
  const noteUnresolvedAttempt = useCallback((
    field: 'deliveryDate' | 'value',
    invalid: boolean,
  ): { hint: string; skipped: boolean } => {
    if (!invalid) { unresolvedAttemptsRef.current[field] = 0; return { hint: '', skipped: false }; }
    const attempts = (unresolvedAttemptsRef.current[field] ?? 0) + 1;
    unresolvedAttemptsRef.current[field] = attempts;
    if (attempts >= 2) {
      setSkippedSlots((prev) => new Set(prev).add(field));
      unresolvedAttemptsRef.current[field] = 0;
      return {
        hint: field === 'deliveryDate'
          ? 'No problem — add the need-by date on the right once you know it. It is needed before you can submit.\n\n'
          : 'No problem — we will leave the budget open and you can add it once it is known.\n\n',
        skipped: true,
      };
    }
    return {
      hint: field === 'deliveryDate'
        ? 'Please enter a specific need-by date, for example 2026-12-31.\n\n'
        : 'Please give an approximate figure, for example €50,000 or 150k — or say it is not known yet.\n\n',
      skipped: false,
    };
  }, []);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState(false);
  // Long paste/document extraction can pre-populate sections before the chat
  // mounts. Start from that confirmed context so the engine asks only for the
  // remaining delta instead of repeating questions the requester already
  // answered.
  const [svcDesc, setSvcDesc] = useState<Partial<ServiceDescription>>(() => data.serviceDescription ?? {});
  /**
   * Slots already challenged once.
   *
   * The rule the user asked for: push back ONCE, offer a drafted answer, and
   * then take what you are given. A requester who cannot articulate a scope
   * must never be trapped in a loop arguing with a validator — the second
   * answer is accepted and flagged instead, so the thinness is visible
   * downstream rather than blocking the request.
   */
  const [challenged, setChallenged] = useState<Set<string>>(() => new Set());
  const [generating, setGenerating] = useState(false);
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const [qualityChecks, setQualityChecks] = useState<{ section: string; passed: boolean; issue: string | null }[]>([]);
  const [showQuality, setShowQuality] = useState(false);


  /**
   * Open with the engine's next question, once, when the conversation starts.
   *
   * No invitation first: the conversation page has already asked what the
   * requester needs, in their own words, and said a new request is next — a
   * second "tell me about it" would ask them to repeat themselves. `openedRef`
   * keeps StrictMode's second run from asking twice.
   */
  const openedRef = useRef(false);
  useEffect(() => {
    if (openedRef.current || !enabled) return;
    openedRef.current = true;
    const next = determineNextQuestion(progressCtx, undefined, slots);
    if (next) {
      setMessages([{ role: 'assistant', content: next.prompt, why: next.why, example: next.example, ...choiceFor(next.slot) }]);
    }
    // Once, when the conversation starts: re-running would restart it under the
    // requester.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Progress against the questions THIS demand is actually asked.
  //
  // The denominator was a fixed 14 — five key facts plus nine hardcoded
  // sections — while the conversation asks between six and ten slots depending
  // on category and value. A requester who had answered everything was told
  // they were 57% done and shown five items that were never going to be asked.
  const progressCtx = useMemo(
    () => conversationContext(category, data, svcDesc, riskAnswers),
    [category, data, svcDesc, riskAnswers],
  );
  const { total: unifiedTotal, captured: unifiedDone, pct: unifiedPct } = useMemo(
    () => conversationProgress(progressCtx, undefined, slots),
    [progressCtx, slots],
  );

  /**
   * Complete when the agenda is empty and the mandatory floor is met.
   *
   * Derived, not latched. This was a `useState` set once when the last question
   * was answered, which cannot represent a question that appears *later*:
   * selecting a high-risk supplier triggers the critical-service question after
   * the conversation was already marked done. Reading the agenda every render
   * re-opens the conversation instead of leaving an unanswered governance
   * question behind a "complete" banner. It cannot oscillate — the criteria in
   * `determineResidualQuestions` never read the answers.
   */
  const isComplete = useMemo(() => conversationComplete(progressCtx, slots), [progressCtx, slots]);
  /**
   * The description alone. Generation depends on the description, not on the
   * risk answers, so the SOW composes as soon as the prose is captured rather
   * than waiting for two yes/no questions that contribute nothing to it.
   */
  const descriptionComplete = useMemo(
    () => conversationComplete(progressCtx, descriptionSlots),
    [progressCtx, descriptionSlots],
  );

  const getFieldValue = (key: string): string => {
    // The "Commodity Code" key-fact shows the specific UNSPSC code + label (the
    // meaningful classification), falling back to the high-level category.
    if (key === 'category') {
      return data.commodityCode
        ? `${data.commodityCode} — ${data.commodityCodeLabel}`
        : 'Pending specific classification';
    }
    if (key === 'estimatedValue') return data.estimatedValue > 0 ? formatCurrency(data.estimatedValue) : '';
    return String((data as unknown as Record<string, unknown>)[key] ?? '');
  };

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isTyping) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInputValue('');
    setIsTyping(true);
    setError(false);

    try {
      const response = await fetch('/api/chat-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
          category,
          extractedSoFar: {
            title: data.title || undefined,
            supplier: data.supplier || undefined,
            estimatedValue: data.estimatedValue || undefined,
            deliveryDate: data.deliveryDate || undefined,
            serviceDescription: svcDesc,
          },
        }),
      });

      if (!response.ok) throw new Error('API error');

      const result = await response.json();

      // ── Does the answer address the question? ────────────────────────────
      //
      // The assistant judges when it is available — it is the only thing that
      // can tell a fluent but off-topic reply from a real one. Offline the
      // deterministic floor judges instead, so the offline path is not a free
      // pass for "bla".
      //
      // A failing answer is NOT written into the slot: the engine still has
      // that slot on the agenda, so the requester is asked again rather than
      // moved on with junk recorded. But only once — see `challenged`.
      const askedSlot = determineNextQuestion(
        conversationContext(category, data, svcDesc, riskAnswers), undefined, slots,
      )?.slot;
      const verdict = readVerdict(result.answerVerdict)
        ?? assessAnswer(text, askedSlot);

      if (askedSlot && !verdict.addresses && !challenged.has(askedSlot.id)) {
        setChallenged((prev) => new Set(prev).add(askedSlot.id));
        const suggested = typeof result.answerVerdict?.suggested === 'string'
          ? result.answerVerdict.suggested.trim()
          : '';
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: buildChallenge(verdict.reason, askedSlot, suggested),
            ...(suggested ? { draft: { slotId: askedSlot.id, text: suggested } } : {}),
          },
        ]);
        setIsTyping(false);
        return;
      }

      // Second time round: take what was given, and record that it is thin so a
      // reviewer can see it. Never a hard block.
      const acceptedWeak = Boolean(askedSlot && !verdict.addresses);

      // Merge extracted request fields (LLM does the extraction).
      const updates: Record<string, unknown> = {};
      let invalidDateAnswer = false;
      let invalidValueAnswer = false;
      if (result.extracted) {
        for (const [key, value] of Object.entries(result.extracted)) {
          // Only these fields may come from the model. The loop used to copy
          // every key it was handed straight into the wizard's form state, so a
          // response naming `preCheckOutcome`, `costCentre` or `miniIrq` would
          // set it with nothing in the way — a governance answer nobody gave.
          // The prompt asks the model not to; this is what stops it.
          if (!EXTRACTABLE_FIELDS.has(key)) continue;
          if (value !== undefined && value !== null && value !== '' && value !== 0) {
            updates[key] = value;
          }
        }
        if (typeof updates.deliveryDate === 'string') {
          updates.deliveryDate = parseDeliveryDate(updates.deliveryDate) ?? '';
          if (!updates.deliveryDate) { delete updates.deliveryDate; invalidDateAnswer = true; }
        }
        // The question just asked was the budget and no figure came back
        // ("not known", "TBD") — flagged the same way an unreadable date is.
        // Gated on `askedSlot` because every OTHER question also leaves
        // `estimatedValue` unextracted; only the budget question itself makes
        // that absence meaningful.
        if (askedSlot?.id === 'value' && updates.estimatedValue === undefined) {
          invalidValueAnswer = true;
        }
        // Match supplier against directory
        if (updates.supplier && typeof updates.supplier === 'string') {
          const matched = suppliers.find((s) =>
            s.name.toLowerCase().includes((updates.supplier as string).toLowerCase()) ||
            (updates.supplier as string).toLowerCase().includes(s.name.toLowerCase())
          );
          if (matched) {
            updates.supplierId = matched.id;
            updates.supplier = matched.name;
            updates.supplierProvenance = 'named';
          }
        }
        // Auto-derive commodity code from title/description
        if (updates.title && typeof updates.title === 'string') {
          const commodity = resolveCategoryCode({ text: updates.title, category }, codeBook);
          if (commodity) {
            updates.commodityCode = commodity.code;
            updates.commodityCodeLabel = commodity.label;
          }
        }
        if (Object.keys(updates).length > 0) onUpdate(updates);
      }

      // Merge SOW sections.
      let mergedSow: Partial<ServiceDescription> = svcDesc;
      if (result.serviceDescription) {
        const merged: Partial<ServiceDescription> = { ...svcDesc };
        for (const [key, value] of Object.entries(result.serviceDescription)) {
          // `captureFlags` is provenance this component owns; a model returning
          // that key must not be able to overwrite it with prose.
          if (key === 'captureFlags') continue;
          if (value && typeof value === 'string' && value.trim()) {
            merged[key as ServiceDescriptionSectionKey] = value;
          }
        }
        if (acceptedWeak && askedSlot?.target.kind === 'sow') {
          merged.captureFlags = { ...merged.captureFlags, [askedSlot.target.field]: 'weak' };
        }
        mergedSow = merged;
        setSvcDesc(merged);
        onUpdate({ serviceDescription: merged });
      }

      // The ENGINE — not the LLM — owns the next question and completeness,
      // computed from the just-merged state. So the flow is adaptive, carries
      // everything forward, and never re-asks or short-circuits the mandatory
      // SOW (regardless of what the LLM returns for nextQuestion/complete).
      const mergedData = {
        ...data,
        title: (updates.title as string) || data.title,
        estimatedValue: (updates.estimatedValue as number) || data.estimatedValue,
        deliveryDate: (updates.deliveryDate as string) || data.deliveryDate,
      };
      const ctx = conversationContext(category, mergedData, mergedSow, riskAnswers);

      if (conversationComplete(ctx, slots)) {
        setSummary(result.summary ?? 'Service description captured. Ready for supplier identification and compliance.');
        // The deterministic close, not the model's — what was captured and what
        // is done with it are facts the engine holds, so they are stated the
        // same way whether or not the LLM is up.
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: buildCompletionMessage(ctx, slots) },
        ]);
      } else {
        // Applied before the next question is chosen: saying "we'll leave the
        // date/budget open" and then asking for it again is worse than either.
        const dateOutcome = noteUnresolvedAttempt('deliveryDate', invalidDateAnswer);
        const valueOutcome = noteUnresolvedAttempt('value', invalidValueAnswer);
        const remainingSlots = slots.filter((slot) =>
          !(dateOutcome.skipped && slot.id === 'deliveryDate')
          && !(valueOutcome.skipped && slot.id === 'value'));
        const next = determineNextQuestion(ctx, undefined, remainingSlots);
        const hint = dateOutcome.hint || valueOutcome.hint;
        if (!next) {
          // Giving up on the last open question ends the description; say so,
          // rather than leave the answer with no reply at all.
          setMessages((prev) => [...prev, { role: 'assistant', content: `${hint}${buildCompletionMessage(ctx, remainingSlots)}` }]);
        } else {
          // The ENGINE chooses WHICH slot is asked and when the conversation is
          // done. The assistant chooses the WORDS. Both halves matter: the
          // guarantees are the engine's, but the endpoint already asks the model
          // to put the engine's question in the context of what the requester
          // described, and that phrasing used to be generated and then thrown
          // away — which is why every question read the same canned way even
          // with the LLM up.
          //
          // Guarded: the model's line is used only if it is a plausible single
          // question. Anything else falls back to the canned wording.
          const phrased = usableQuestion(result.nextQuestion);
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: `${hint}${phrased ?? next.prompt}`,
              why: next.why,
              // A generic example only helps when the wording is generic too.
              example: phrased ? undefined : next.example,
              ...choiceFor(next.slot),
            },
          ]);
        }
      }
    } catch {
      // LLM unavailable — the engine still drives the same adaptive, carry-
      // forward flow (mandatory SOW preserved) using a lightweight extraction.
      //
      // The deterministic judge applies here too, with the same challenge-once
      // rule. There is no drafted recommendation offline: a suggestion has to be
      // grounded in what the requester said, and nothing here can write one, so
      // the challenge names the gap and re-asks instead of inventing prose.
      const offlineSlot = determineNextQuestion(
        conversationContext(category, data, svcDesc, riskAnswers), undefined, slots,
      )?.slot;
      const offlineVerdict = assessAnswer(text, offlineSlot);
      if (offlineSlot && !offlineVerdict.addresses && !challenged.has(offlineSlot.id)) {
        setChallenged((prev) => new Set(prev).add(offlineSlot.id));
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: buildChallenge(offlineVerdict.reason, offlineSlot, '') },
        ]);
        setIsTyping(false);
        return;
      }
      const offlineWeak = Boolean(offlineSlot && !offlineVerdict.addresses);

      const fallback = localFallbackResponse(text, category, data, svcDesc, slots, riskAnswers);

      if (Object.keys(fallback.extracted).length > 0) {
        onUpdate(fallback.extracted);
      }
      if (Object.keys(fallback.sow).length > 0) {
        // BOTH, always: local state renders the panel, `onUpdate` is what the
        // step-3 gate reads. This branch used to set only the local copy, so on
        // the offline path every answer showed in the panel while
        // `formData.serviceDescription` stayed empty — the gate saw nothing
        // captured and **Next could never enable**. The LLM path and
        // `handleSowEdit` had always done both; this one was the odd one out.
        const merged: Partial<ServiceDescription> = { ...svcDesc, ...fallback.sow };
        if (offlineWeak && offlineSlot?.target.kind === 'sow') {
          merged.captureFlags = {
            ...merged.captureFlags,
            [offlineSlot.target.field]: 'weak' as SectionCapture,
          };
        }
        setSvcDesc(merged);
        onUpdate({ serviceDescription: merged });
      }

      // Same give-up rule as the LLM path: the offline extractor rejects an
      // unreadable date or budget too, and looping there was no better.
      const offlineField: 'deliveryDate' | 'value' | undefined =
        offlineSlot?.id === 'deliveryDate' || offlineSlot?.id === 'value' ? offlineSlot.id : undefined;
      const offlineOutcome = offlineField
        ? noteUnresolvedAttempt(offlineField, Boolean(fallback.warning))
        : { hint: '', skipped: false };
      // When the slot is given up on, the question that follows must be the
      // NEXT one, not the one just abandoned — read against this answer, which
      // may have filled others. With nothing left, that is the end of the
      // description, and it says so: falling back to the engine's own next
      // question here asked for the date it had just given up on.
      const remainingSlots = offlineOutcome.skipped ? slots.filter((slot) => slot.id !== offlineField) : slots;
      const afterAnswer = conversationContext(
        category, { ...data, ...(fallback.extracted as Partial<ConversationData>) }, { ...svcDesc, ...fallback.sow }, riskAnswers,
      );
      const offlineNext = offlineOutcome.skipped ? determineNextQuestion(afterAnswer, undefined, remainingSlots) : null;
      setMessages((prev) => [
        ...prev,
        offlineOutcome.skipped && !offlineNext
          ? { role: 'assistant', content: `${offlineOutcome.hint}${buildCompletionMessage(afterAnswer, remainingSlots)}` }
          : {
              role: 'assistant',
              content: `${offlineOutcome.hint}${offlineNext?.prompt ?? fallback.nextQuestion}`,
              why: offlineNext?.why ?? fallback.why,
              example: offlineNext?.example ?? fallback.example,
              ...choiceFor(offlineNext?.slot ?? fallback.nextSlot),
            },
      ]);

      if (fallback.complete) {
        setSummary('Service description captured. Ready for supplier identification and compliance.');
      }
    } finally {
      setIsTyping(false);
    }
  }, [inputValue, isTyping, messages, category, data, svcDesc, riskAnswers, onUpdate, suppliers, codeBook, slots, challenged, noteUnresolvedAttempt]);

  /**
   * True while the conversation is waiting on a yes/no governance answer.
   *
   * Disabling the text box rather than hiding it keeps the layout still and
   * makes the required action obvious — and it is what makes "a model can never
   * fill a risk slot" structural rather than a prompt instruction: there is no
   * free-text path into one.
   */
  const awaitingChoice = useMemo(() => {
    const next = determineNextQuestion(progressCtx, undefined, slots);
    return next?.slot.answerType === 'yes-no';
  }, [progressCtx, slots]);


  // The service description is composed automatically once the conversation has
  // captured all required components — there is no manual "generate" action.
  // This polishes the captured answers into the full set of sections + a
  // narrative; if the endpoint is unavailable it stays graceful (the
  // conversation has already composed a working narrative) and shows no error.
  const generateServiceDescription = useCallback(async () => {
    setGenerating(true);
    // Computed once and both sent and stored, so the description records the
    // exact read it was generated against rather than one recomputed later.
    const signals = computeDemandSignals({
      category,
      value: data.estimatedValue,
      supplier: suppliers.find((sup) => sup.id === data.supplierId) ?? null,
      // Only the captured text. `captureFlags` is provenance, not content, and
      // feeding it to the signal read is what produced "v?.trim is not a
      // function" — the classification is about what was described, not about
      // how it came to be recorded.
      sow: sectionsOnly(svcDesc),
      preferredSupplierIds,
    });
    try {
      const res = await fetch('/api/generate-sow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          title: data.title,
          value: data.estimatedValue,
          supplier: data.supplier,
          timeline: data.deliveryDate,
          // The capture-time governance read. Without it the generator could not
          // tell a material, competitively-sourced engagement from a stationery
          // order, and wrote the same document for both.
          signals,
          // Only the captured text — `captureFlags` is provenance, not an answer,
          // and must not be sent to the generator as if it were one.
          capturedAnswers: sectionsOnly(svcDesc),
          commodityCode: data.commodityCode,
        }),
      });

      if (!res.ok) throw new Error('generate-sow API error');
      const result = await res.json() as {
        sections: Partial<ServiceDescription>;
        narrative: string;
        qualityScore: number;
        qualityChecks: { section: string; passed: boolean; issue: string | null }[];
      };

      const merged = { ...result.sections, narrative: result.narrative };
      setSvcDesc(merged as Partial<ServiceDescription>);
      // The business need IS the service description — so the narrative becomes
      // the request's justification, on this path as well as the offline one.
      // Only the offline fallback did this, so on the LLM path the justification
      // stayed whatever step 1 had seeded and never reflected what the
      // requester actually described.
      // Keep the detailed description separate from the legacy justification
      // column; requesters should confirm one coherent document, not duplicate it.
      onUpdate({ serviceDescription: merged });
      setQualityScore(result.qualityScore);
      // Persisted at submit. These columns have existed since R6 and were null
      // on every live row, so the quality badge tab-overview renders had never
      // once appeared.
      // The sections this demand must cover are not taken from generation's
      // reply: the page computes them from the request as it stands
      // (`requiredSectionIds`), the same set this conversation requires.
      onUpdate({
        sowQualityScore: result.qualityScore,
        sowQualityChecks: result.qualityChecks,
        sowSignals: signals,
      });
      setQualityChecks(result.qualityChecks);
      setShowQuality(true);
    } catch (e) {
      // Automatic step — degrade gracefully, no user-facing error.
      console.error('[generate-sow]', e);
    } finally {
      setGenerating(false);
    }
  }, [category, data, svcDesc, onUpdate, suppliers, preferredSupplierIds]);

  // Auto-compose the service description the moment the conversation is complete
  // (all components captured). Runs once; no button required.
  const autoGeneratedRef = useRef(false);
  useEffect(() => {
    if (enabled && descriptionComplete && !autoGeneratedRef.current) {
      autoGeneratedRef.current = true;
      generateServiceDescription();
    }
  }, [enabled, descriptionComplete, generateServiceDescription]);

  /**
   * Ask whatever the engine says is next, when it is not already being asked.
   *
   * For a question that appears after the conversation had finished: the risk
   * questions, which the conversation page puts after the supplier question
   * because the supplier decides them. Never asks twice.
   */
  const askNext = useCallback(() => {
    const next = determineNextQuestion(progressCtx, undefined, slots);
    if (!next) return;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === 'assistant' && last.content === next.prompt) return prev;
      return [...prev, { role: 'assistant', content: next.prompt, why: next.why, example: next.example, ...choiceFor(next.slot) }];
    });
  }, [progressCtx, slots]);

  /**
   * Accept a drafted answer as the requester's own.
   *
   * The words are the assistant's and the requester approved them, so the
   * section is flagged `assistant-drafted` — not passed off as something they
   * wrote. Fills the slot and lets the engine move on to the next question.
   */
  const acceptDraft = useCallback((slotId: string, textValue: string) => {
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return;

    if (slot.target.kind === 'sow') {
      const merged: Partial<ServiceDescription> = {
        ...svcDesc,
        [slot.target.field]: textValue,
        captureFlags: { ...svcDesc.captureFlags, [slot.target.field]: 'assistant-drafted' as SectionCapture },
      };
      setSvcDesc(merged);
      onUpdate({ serviceDescription: merged });
    } else {
      onUpdate({ [slot.target.field]: textValue });
    }

    const nextCtx = conversationContext(
      category,
      slot.target.kind === 'request'
        ? { ...data, [slot.target.field]: textValue }
        : data,
      slot.target.kind === 'sow' ? { ...svcDesc, [slot.target.field]: textValue } : svcDesc,
    );
    const next = determineNextQuestion(nextCtx, undefined, slots);
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: textValue },
      ...(next
        ? [{ role: 'assistant' as const, content: next.prompt, why: next.why, example: next.example, ...choiceFor(next.slot) }]
        : [{ role: 'assistant' as const, content: buildCompletionMessage(nextCtx, slots) }]),
    ]);
  }, [slots, svcDesc, onUpdate, category, data]);

  /**
   * Record a risk answer and move the conversation on.
   *
   * Mirrors `acceptDraft`: write through `onUpdate`, append the exchange, and
   * ask whatever the engine says is next. No endpoint call — the wording comes
   * from `residual-questions.ts` and there is nothing for a model to add to a
   * yes/no question except the opportunity to get it wrong.
   */
  const answerRiskQuestion = useCallback((field: MiniIrqField, value: boolean, label: string) => {
    const nextRisk = { ...riskAnswers, [field]: value };
    onUpdate({ miniIrq: nextRisk });
    const nextCtx = conversationContext(category, data, svcDesc, nextRisk);
    const next = determineNextQuestion(nextCtx, undefined, slots);
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: label },
      ...(next
        ? [{
            role: 'assistant' as const,
            content: next.prompt,
            why: next.why,
            example: next.example,
            ...choiceFor(next.slot),
          }]
        // The last risk answer completes the request, and the page says so with
        // its "Buying channel confirmed" card — a second completion message
        // before it would be the same news twice.
        : []),
    ]);
  }, [riskAnswers, onUpdate, category, data, svcDesc, slots]);

  const handleSowEdit = useCallback((key: string, value: string) => {
    const updated = {
      ...svcDesc,
      [key]: value,
      captureFlags: { ...svcDesc.captureFlags, [key]: 'reviewer-edited' as SectionCapture },
    };
    setSvcDesc(updated);
    onUpdate({ serviceDescription: updated });
  }, [svcDesc, onUpdate]);

  return {
    messages, inputValue, setInputValue, isTyping, summary, error, svcDesc,
    generating, qualityScore, qualityChecks, showQuality, setShowQuality,
    unifiedTotal, unifiedDone, unifiedPct, isComplete, descriptionComplete,
    sections, getFieldValue, handleSend, awaitingChoice, acceptDraft,
    answerRiskQuestion, handleSowEdit, askNext,
    /** What the page's panel reads: the agenda, its context, and what was given up on. */
    slots, progressCtx, leftOpen: skippedSlots,
  };
}
