// Dynamic demand conversation engine (INT-03 / INT-10).
//
// The front-door intake is answer-driven, not a fixed script. Given everything
// captured so far, this module computes the NEXT question to ask — skipping any
// slot already answered (carry-forward) and only surfacing the slots that apply
// to this demand (branching on category, value and prior answers). A simple
// low-value catalogue-style demand is asked the essentials and finishes; a
// high-value or specialist engagement is asked the extra slots that matter.
//
// Pure + deterministic (no React, no LLM): both the LLM intake endpoint
// (api/chat-intake.ts) and the conversation's offline fallback
// (use-service-description-conversation.ts) consume this, so it behaves
// identically whether or not the LLM is up.
//
// Requester location and beneficiary are NEVER slots here — they are derived
// from the requester's profile / a UI control, so the conversation never asks
// for them.

import { getActivePolicyConfig, type PolicyConfig } from './policy-config.js';
import {
  slotApplies, evaluateSlotCondition, requiredSectionsFor,
  type ConfiguredSection, type ConfiguredSlot, type SlotCondition, type SlotConditionContext,
} from './service-description-config.js';
import { computeDemandSignals } from './demand-signals.js';
import type { MiniIrqField, ResidualQuestionId } from './residual-questions.js';

export type DemandSlotId =
  | 'title'
  | 'value'
  | 'deliveryDate'
  | 'objective'
  | 'scope'
  | 'exclusions'
  | 'deliverables'
  | 'resources'
  | 'timeline'
  | 'acceptanceCriteria'
  | 'pricingModel'
  | 'dependencies'
  // The criteria-driven risk questions, appended to the agenda at runtime from
  // `determineResidualQuestions`. They are NOT in `ALL_SLOTS` and never in a
  // stored template — see `residual-question-slots.ts` for why.
  | ResidualQuestionId;

/** The service-description elements a slot can fill (subset of the full SOW). */
export interface ServiceDescriptionSlots {
  objective?: string;
  scope?: string;
  exclusions?: string;
  deliverables?: string;
  resources?: string;
  timeline?: string;
  acceptanceCriteria?: string;
  pricingModel?: string;
  dependencies?: string;
}

/** Where a captured answer lands — a top-level request field or a SOW element. */
export type DemandSlotTarget =
  | { kind: 'request'; field: 'title' | 'estimatedValue' | 'deliveryDate' }
  | { kind: 'sow'; field: keyof ServiceDescriptionSlots }
  // A yes/no governance answer. Kept distinct from the prose targets because
  // `false` is a real answer here, not an empty slot — see `isSlotFilled`.
  | { kind: 'risk'; field: MiniIrqField };

/** Everything the engine reads to decide the next question + carry-forward. */
export interface DemandConversationContext {
  category: string;
  // Known request facts (carry-forward sources):
  title?: string;
  estimatedValue?: number; // 0 / undefined ⇒ unknown
  deliveryDate?: string;
  // SOW elements captured so far:
  sow: ServiceDescriptionSlots;
  // Auto-derived context that is never asked (no slot targets these — present
  // only to document that they are already known):
  requesterCountry?: string;
  beneficiaryName?: string;
  /**
   * Answers to the criteria-driven risk questions.
   *
   * Tri-state BY ABSENCE: a key that is not present was never answered. Never
   * default these to `false` — "not asked" and "answered no" are different
   * governance facts, and recording the second when the first is true is the
   * unearned evidence this codebase forbids.
   */
  risk?: { privilegedAccess?: boolean; criticalService?: boolean };
}

export interface DemandSlot {
  id: DemandSlotId;
  target: DemandSlotTarget;
  /** Required slots are the mandatory minimum (today's title + value + 4 SOW). */
  required: boolean;
  /** Base question; the LLM may rephrase, the offline fallback uses it verbatim. */
  prompt: string;
  /**
   * How the answer is given. Absent means free text, so every built-in slot is
   * unchanged. `yes-no` renders a choice and disables the text input: a
   * governance question must be answered by the requester, never extracted from
   * their prose by a model.
   */
  answerType?: 'text' | 'yes-no';
  /** A short, category-specific example appended to the prompt. */
  example?: (ctx: DemandConversationContext) => string;
  /**
   * Slot is part of the agenda only when this returns true (absent ⇒ always).
   *
   * `signals` is the capture-time governance read, computed once per agenda
   * build rather than per slot. It is passed in because a configured slot's
   * conditions may name `materiality`, `riskTier`, `dataSensitivity` or
   * `sourcingType`: four of the six fields `SlotConditionField` declares. They
   * reached SECTIONS (api/generate-sow.ts builds the full context) and never
   * reached slots — `fromConfiguredSlot` supplied `{category, value}` only — so
   * a condition on any of them silently never matched, and the half that worked
   * is why it looked fine in testing.
   */
  appliesWhen?: (
    ctx: DemandConversationContext,
    config: PolicyConfig,
    signals: SlotConditionContext,
  ) => boolean;
  /**
   * Conditions under which an ANSWER is mandatory, beyond the slot being asked.
   *
   * Carried from the configured slot. It was declared on `ConfiguredSlot`,
   * edited on `/admin/service-description`, persisted — and read by nothing:
   * `fromConfiguredSlot` dropped it, so "a material engagement must state its
   * exit provisions" saved successfully and governed nothing.
   */
  requiredWhen?: SlotCondition[];
  /**
   * The rule under which the service-description SECTION this slot fills is
   * mandatory — the template's `ConfiguredSection.requiredWhen`, which is also
   * what generation is told it MUST cover and what the Channel page checks.
   *
   * When it holds for this demand the question is asked, whatever `appliesWhen`
   * says, and its answer is required. The two used to be separate: the
   * conversation counted its own required questions and the Channel page the
   * sections generation required, so a material demand read "4 of 4 required"
   * in one and "1 of 1 required sections" in the other, and could be confirmed
   * while the determination still found a section missing (2026-09-26).
   */
  sectionRequiredWhen?: SlotCondition[];
  /** That section's label, for the line saying why the section rule asks it. */
  sectionLabel?: string;
  /**
   * Why this demand is being asked this question, shown to the requester.
   *
   * Only meaningful on CONDITIONAL slots: a question that appears for some
   * demands and not others is the one that reads as arbitrary, so it has to
   * justify itself. The six mandatory slots need no rationale — everything is
   * asked them — and carrying an unused string on each would invite copy that
   * says nothing.
   */
  why?: string;
}

/** Categories whose work is time-phased enough that a timeline is worth asking. */
const TIME_BASED_CATEGORIES = new Set(['services', 'consulting', 'contingent-labour']);
/** Categories that are outcome-based, where acceptance criteria matter. */
const OUTCOME_CATEGORIES = new Set(['services', 'consulting', 'software']);

/** A category-specific example, wrapped as "(e.g. …)", falling back to generic. */
function ex(
  ctx: DemandConversationContext,
  byCategory: Partial<Record<string, string>>,
  fallback: string,
): string {
  return byCategory[ctx.category] ?? fallback;
}

/**
 * The canonical slot order. What is being bought is captured first — the
 * title, then the description that goes to suppliers — with budget and the
 * delivery date asked LAST, once the requester has already described the
 * work.
 *
 * Budget used to be slot #2, straight after the title, so the conversation's
 * second-ever question was "What's the estimated budget for this?" before the
 * requester had said anything about what they actually needed. It also meant
 * a requester who did not yet know the figure hit that question immediately
 * and had no way past it — see `unresolvedAttemptsRef` in step-chat-intake.tsx
 * for where "not known" is now accepted rather than re-asked forever.
 */
export const ALL_SLOTS: DemandSlot[] = [
  {
    id: 'title',
    target: { kind: 'request', field: 'title' },
    required: true,
    prompt: "What do you need? Describe what you're looking to procure.",
    why: 'Asked because this one line names the request everywhere it appears afterwards — in approvals, in sourcing and on the record.',
    example: (ctx) => ex(ctx, {
      'contingent-labour': '3 senior Java developers for 6 months',
      software: '200 CRM licences with a service module',
      consulting: 'consultants to design a target operating model',
      goods: '50 height-adjustable desks for the new office',
    }, 'market-research study for APAC expansion'),
  },
  {
    id: 'objective',
    target: { kind: 'sow', field: 'objective' },
    required: true,
    prompt: "What's the primary objective of this engagement?",
    why: 'Asked because the objective opens the service description that goes to suppliers — it is what they price against.',
    example: (ctx) => ex(ctx, {
      consulting: 'define a target operating model for the finance function',
      software: 'roll out a new CRM to 200 sales users',
      services: 'stand up a managed support service for EMEA',
      'contingent-labour': 'augment the platform team to hit the Q3 release',
      goods: 'equip the new office with workstations',
    }, 'the outcome this should achieve'),
  },
  {
    id: 'scope',
    target: { kind: 'sow', field: 'scope' },
    required: true,
    prompt: 'What is included in the work or purchase?',
    why: 'Asked because scope is what the risk assessment reads to judge data handling and access, and what a supplier is held to later.',
    example: (ctx) => ex(ctx, {
      consulting: 'current-state assessment, design and roadmap',
      software: 'Sales & Service modules and data migration',
    }, "the work, items or capabilities included"),
  },
  {
    id: 'exclusions',
    target: { kind: 'sow', field: 'exclusions' },
    required: false,
    prompt: 'Is anything explicitly excluded or not required?',
    why: 'Asked because what is out of scope is the half suppliers price optimistically and argue about at delivery.',
    example: (ctx) => ex(ctx, {
      consulting: 'implementation and ongoing managed support',
      software: 'custom reporting beyond the standard modules',
    }, 'anything the supplier should not provide'),
  },
  {
    id: 'deliverables',
    target: { kind: 'sow', field: 'deliverables' },
    required: true,
    prompt: 'What are the key deliverables?',
    why: 'Asked because deliverables become the acceptance list — nothing can be signed off against a description that has none.',
    example: (ctx) => ex(ctx, {
      consulting: 'assessment report, target-state design and an implementation roadmap',
      software: 'the configured modules, migrated data and trained users',
      goods: 'the items delivered and installed',
    }, 'the reports, milestones or outputs expected'),
  },
  {
    id: 'resources',
    target: { kind: 'sow', field: 'resources' },
    required: true,
    prompt: 'What resources, skills or team size does this need?',
    why: 'Asked because who does the work drives the risk read: supplier staff needing system access is assessed differently from work done off-site.',
    example: (ctx) => ex(ctx, {
      'contingent-labour': 'role, seniority and headcount',
      consulting: 'an engagement lead and two senior consultants',
      software: 'an implementation lead and a data engineer',
    }, 'the skills or roles required'),
  },
  // ── Conditional enrichment slots (answer-driven) ──────────────────────────
  {
    id: 'timeline',
    target: { kind: 'sow', field: 'timeline' },
    required: false,
    prompt: 'What is the timeline or key milestones?',
    example: (ctx) => ex(ctx, {
      consulting: 'a 10-week engagement with a readout at week 6',
      'contingent-labour': '6-month engagement starting October',
    }, '12 weeks, kickoff in September, readout at week 8'),
    why: 'Asked because work in this category is delivered over time — the milestones have to be in the description before anyone can hold a supplier to them.',
    appliesWhen: (ctx) => TIME_BASED_CATEGORIES.has(ctx.category),
  },
  {
    id: 'acceptanceCriteria',
    target: { kind: 'sow', field: 'acceptanceCriteria' },
    required: false,
    prompt: 'How will success be measured — what are the acceptance criteria?',
    example: (ctx) => ex(ctx, {
      consulting: 'design signed off by the steering group; roadmap accepted',
      software: 'UAT passed, <2% error rate, go-live sign-off',
    }, 'sign-off criteria / how success is measured'),
    why: 'Asked because this category is bought on an outcome — what counts as done has to be written down now, not argued about at sign-off.',
    appliesWhen: (ctx) => OUTCOME_CATEGORIES.has(ctx.category),
  },
  {
    id: 'pricingModel',
    target: { kind: 'sow', field: 'pricingModel' },
    required: false,
    prompt: 'What pricing or commercial model applies?',
    example: (ctx) => ex(ctx, {
      software: 'per-user annual subscription',
      'contingent-labour': 'day rate per resource',
    }, 'fixed price, time & materials, or milestone-based'),
    why: 'Asked because this demand is above the value where the commercial model is agreed up front rather than at contract.',
    // High-value demands warrant capturing the commercial model up front.
    appliesWhen: (ctx, config) => (ctx.estimatedValue ?? 0) >= config.criticalServiceThreshold,
  },
  {
    id: 'dependencies',
    target: { kind: 'sow', field: 'dependencies' },
    required: false,
    prompt: 'Are there key dependencies or systems this relies on?',
    example: () => 'systems, data, venues or teams this relies on',
    why: 'Asked because at this value what the engagement relies on has to be visible — a dependency nobody recorded is a continuity risk nobody can plan for.',
    // Large engagements carry continuity-relevant dependencies worth surfacing.
    appliesWhen: (ctx, config) => (ctx.estimatedValue ?? 0) >= config.continuityThreshold,
  },
  // ── Budget and timing — asked last, once the work itself is described ────
  {
    id: 'value',
    target: { kind: 'request', field: 'estimatedValue' },
    required: true,
    prompt: "What's the estimated budget for this?",
    why: 'Asked because the value sets the buying channel, who approves it, and how long it takes — it is the single biggest driver of your route.',
    example: () => '€50,000 or 150k',
  },
  {
    id: 'deliveryDate',
    target: { kind: 'request', field: 'deliveryDate' },
    required: false,
    prompt: 'When do you need this delivered or started by?',
    why: 'Asked because the date decides whether the standard route can make it, and whether an urgent path is worth opening.',
    example: () => 'by end of Q3, or a specific date',
  },
];

/** The mandatory minimum — the conversation is not valid until these are filled. */
export const REQUIRED_SLOT_IDS: DemandSlotId[] = [
  'title',
  'value',
  'objective',
  'scope',
  'deliverables',
  'resources',
];

/**
 * Turn an admin-configured slot into the runtime shape.
 *
 * The two differ in exactly one way that matters: `appliesWhen` is a closure in
 * the built-in set and a serialised `{field, operator, value}` condition in the
 * stored one — because a closure cannot be persisted. `slotApplies` already
 * evaluates the serialised form (and resolves `policy:<key>` through the
 * governed thresholds), so this wraps it rather than adding a second evaluator.
 *
 * The example is a per-category string map instead of a function, so a template
 * with no entry for the demand's category simply omits the example rather than
 * inventing one.
 */
export function fromConfiguredSlot(slot: ConfiguredSlot): DemandSlot {
  return {
    id: slot.id as DemandSlotId,
    target:
      slot.targetKind === 'request'
        ? ({ kind: 'request', field: slot.targetField } as DemandSlotTarget)
        : ({ kind: 'sow', field: slot.targetField } as DemandSlotTarget),
    required: slot.required,
    requiredWhen: slot.requiredWhen,
    prompt: slot.prompt,
    // Plain text, like the built-in set: the "(e.g. …)" wrapper lived only in
    // `ex()`, so configured slots rendered bare and built-in ones wrapped —
    // visibly inconsistent within one conversation.
    example: slot.examples
      ? (ctx) => slot.examples?.[ctx.category] ?? slot.examples?.default ?? ''
      : undefined,
    // Empty config string means "no rationale" — an admin blanking the field
    // removes the line rather than rendering an empty one.
    why: slot.why?.trim() || undefined,
    appliesWhen: (_ctx, config, signals) => slotApplies(slot, signals, config),
  };
}

/**
 * The slot set a conversation runs on.
 *
 * Defaults to the built-in `ALL_SLOTS` so every existing caller — and
 * `test:demand-conversation` — behaves exactly as before. Passing a template's
 * slots is what makes *what is asked* configurable; until R6's table has a row,
 * resolution falls back to the built-in template, which serialises this same
 * set, so the two agree by construction. `test:service-description-config`
 * asserts that agreement across every category × value combination.
 */
export function resolveSlots(configured?: ConfiguredSlot[], sections?: ConfiguredSection[]): DemandSlot[] {
  const base = !configured || configured.length === 0 ? ALL_SLOTS : configured.map(fromConfiguredSlot);
  return sections?.length ? withSectionRules(base, sections) : base;
}

/**
 * Carry each section's mandatory rule onto the slot that asks for it.
 *
 * On the slot rather than passed alongside, so every function that decides
 * what is asked and what is required — the agenda, `requiredSlots`, the gate,
 * progress, and the server's copy in api/chat-intake.ts — reads the same rule
 * without a second argument to forget.
 */
export function withSectionRules(slots: DemandSlot[], sections: ConfiguredSection[]): DemandSlot[] {
  return slots.map((slot) => {
    if (slot.target.kind !== 'sow') return slot;
    const section = sections.find((s) => s.id === slot.target.field);
    if (!section?.requiredWhen?.length) return slot;
    return { ...slot, sectionRequiredWhen: section.requiredWhen, sectionLabel: section.label };
  });
}

/** Does the section rule make this slot's answer mandatory for this demand? */
function sectionRequires(slot: DemandSlot, signals: SlotConditionContext, config: PolicyConfig): boolean {
  return Boolean(slot.sectionRequiredWhen?.length)
    && slot.sectionRequiredWhen!.every((c) => evaluateSlotCondition(c, signals, config));
}

/** The demand's own reading of a signal, in words, for the "asked because" line. */
function signalPhrase(field: SlotCondition['field'], signals: SlotConditionContext): string | null {
  const value = signals[field];
  if (value === undefined || value === '') return null;
  switch (field) {
    case 'materiality': return `its materiality is ${value}`;
    case 'riskTier': return `its inherent risk is ${value}`;
    case 'dataSensitivity': return `its data sensitivity is ${value}`;
    case 'sourcingType': return `it goes to ${value} sourcing`;
    case 'category': return `it is ${value}`;
    case 'value': return `its value is €${Number(value).toLocaleString('en-IE')}`;
    default: return null;
  }
}

/**
 * Why a question is asked. When the section rule is what makes it mandatory,
 * that is the reason given — "the description must cover Acceptance Criteria
 * for this demand: its materiality is important" — because a question that
 * appears for some demands and not others has to say why, and a configured
 * `why` explains the slot's own condition, not the section's.
 */
export function slotWhy(
  slot: DemandSlot,
  ctx: DemandConversationContext,
  config: PolicyConfig = getActivePolicyConfig(),
): string | undefined {
  const signals = slotConditionContext(ctx, config);
  if (!sectionRequires(slot, signals, config)) return slot.why;
  const label = (slot.sectionLabel ?? String(slot.target.field)).toLowerCase();
  const reasons = [...new Set((slot.sectionRequiredWhen ?? [])
    .map((c) => signalPhrase(c.field, signals))
    .filter((r): r is string => Boolean(r)))];
  return reasons.length
    ? `Asked because the description must cover ${label} for this demand: ${reasons.join(' and ')}.`
    : `Asked because the description must cover ${label} for this demand.`;
}

function isSlotFilled(slot: DemandSlot, ctx: DemandConversationContext): boolean {
  // Presence, not truthiness: `false` is an answer. Every other branch below
  // keeps its `!!value.trim()` semantics, so no existing slot changes.
  if (slot.target.kind === 'risk') return ctx.risk?.[slot.target.field] !== undefined;
  if (slot.target.kind === 'request') {
    if (slot.target.field === 'estimatedValue') return (ctx.estimatedValue ?? 0) > 0;
    if (slot.target.field === 'title') return !!ctx.title?.trim();
    return !!ctx.deliveryDate?.trim();
  }
  return !!ctx.sow[slot.target.field]?.trim();
}

/**
 * The ordered list of slots still worth asking, given what is already known
 * (filled slots dropped — carry-forward) and which slots apply to this demand
 * (branching). An empty agenda means the conversation is complete.
 */
export function buildAgenda(
  ctx: DemandConversationContext,
  config: PolicyConfig = getActivePolicyConfig(),
  slots: DemandSlot[] = ALL_SLOTS,
): DemandSlot[] {
  return applicableSlots(ctx, config, slots).filter((slot) => !isSlotFilled(slot, ctx));
}

/**
 * Every slot this demand will be asked, whether answered yet or not.
 *
 * The agenda's denominator. It is deliberately recomputed from the current
 * context rather than fixed at the start: two of the conditional slots branch
 * on value, so answering "€400k" genuinely adds questions. A denominator frozen
 * before the value was known would be a different lie from the fixed 14 it
 * replaces, not a fix for it.
 */
export function applicableSlots(
  ctx: DemandConversationContext,
  config: PolicyConfig = getActivePolicyConfig(),
  slots: DemandSlot[] = ALL_SLOTS,
): DemandSlot[] {
  const signals = slotConditionContext(ctx, config);
  // A section the signals make mandatory is asked for, whether or not the
  // slot's own condition would have asked it: a requirement nobody is asked to
  // meet is only discovered as a gap after the channel was confirmed.
  return slots.filter((slot) => !slot.appliesWhen
    || slot.appliesWhen(ctx, config, signals)
    || sectionRequires(slot, signals, config));
}

/**
 * The full context a configured slot's conditions are evaluated against.
 *
 * Computed here, once per agenda build, from what the conversation already
 * holds: `computeDemandSignals` needs only category, value and the description
 * so far, all of which are on the context. So the four governance fields were
 * never unavailable to slots — they were simply not passed.
 *
 * It is the capture-time read, deliberately: the determination has not run, and
 * `computeDemandSignals` is the module that exists to say what is known now
 * without guessing the rest.
 */
export function slotConditionContext(
  ctx: DemandConversationContext,
  config: PolicyConfig = getActivePolicyConfig(),
): SlotConditionContext {
  const signals = computeDemandSignals(
    { category: ctx.category, value: ctx.estimatedValue ?? 0, sow: ctx.sow },
    config,
  );
  return {
    category: ctx.category,
    value: ctx.estimatedValue,
    materiality: signals.materiality,
    riskTier: signals.inherentRiskTier,
    dataSensitivity: signals.dataSensitivity,
    sourcingType: signals.sourcingTypeHint,
  };
}

/**
 * How far through the conversation this demand is.
 *
 * Measured against the questions THIS demand is asked, so a requester who has
 * answered everything reads 100%. The previous denominator was a fixed 14 (five
 * key facts plus nine hardcoded sections) while the conversation asks between
 * six and ten slots, so a finished conversation topped out between 57% and 86%
 * and left items showing as outstanding that were never going to be asked.
 *
 * Lives here rather than in the component so the panel and the engine cannot
 * disagree about what "done" means.
 */
export function conversationProgress(
  ctx: DemandConversationContext,
  config: PolicyConfig = getActivePolicyConfig(),
  slots: DemandSlot[] = ALL_SLOTS,
): { total: number; captured: number; pct: number } {
  const total = applicableSlots(ctx, config, slots).length;
  const remaining = buildAgenda(ctx, config, slots).length;
  const captured = total - remaining;
  // A demand with no applicable slots is complete, not undefined — guard the
  // divide rather than rendering NaN%.
  return { total, captured, pct: total === 0 ? 100 : Math.round((captured / total) * 100) };
}

/**
 * The single next slot to ask, its question, and any worked example — or null
 * when the conversation is complete.
 *
 * The example is returned SEPARATELY from the question and carries no "(e.g. …)"
 * wrapper. It used to be concatenated onto the prompt, which produced
 *
 *     "What's the primary objective of this engagement? run a promptathon to
 *      upskill 40 staff on AI tooling"
 *
 * — reading as if the assistant had answered its own question, with a topic
 * belonging to some other project. Worse, only ONE of the two slot sources
 * added the wrapper: the built-in set did, and `fromConfiguredSlot` — the path
 * that actually runs — did not, so the same conversation mixed both styles.
 * Keeping the example as plain data and letting the UI present it removes both
 * problems at the source.
 */
export function determineNextQuestion(
  ctx: DemandConversationContext,
  config: PolicyConfig = getActivePolicyConfig(),
  slots: DemandSlot[] = ALL_SLOTS,
): { slot: DemandSlot; prompt: string; example?: string; why?: string } | null {
  const agenda = buildAgenda(ctx, config, slots);
  if (agenda.length === 0) return null;
  const slot = agenda[0];
  return { slot, prompt: slot.prompt, example: slot.example?.(ctx)?.trim() || undefined, why: slotWhy(slot, ctx, config) };
}

/** Complete when nothing applicable is left to ask (required + triggered). */
export function isConversationComplete(
  ctx: DemandConversationContext,
  config: PolicyConfig = getActivePolicyConfig(),
  slots: DemandSlot[] = ALL_SLOTS,
): boolean {
  return buildAgenda(ctx, config, slots).length === 0;
}

/**
 * The mandatory-SOW guarantee, independent of the optional/conditional slots:
 * title + value + the four core SOW elements. Used to stop an LLM from
 * short-circuiting the conversation before the essentials are captured.
 */
/**
 * Which mandatory slots are still empty.
 *
 * The gate has to be able to SAY what is outstanding, not merely refuse. Same
 * floor as `requiredSlotsFilled` — that function is this one being empty — so
 * the two cannot drift into disagreeing about what is required.
 */
/**
 * Every mandatory slot this demand is asked, answered or not — the M in the
 * conversation page's "N of M known". The same rule as `outstandingRequiredSlots`,
 * which is this filtered to the unanswered ones.
 */
export function requiredSlots(
  ctx: DemandConversationContext,
  slots: DemandSlot[] = ALL_SLOTS,
  config: PolicyConfig = getActivePolicyConfig(),
): DemandSlot[] {
  const signals = slotConditionContext(ctx, config);
  // A slot is mandatory if the code floor says so, OR the template marks it
  // required, OR its `requiredWhen` conditions hold for this demand. The last
  // two were the half of "a template CAN add requirements" that had no
  // implementation: `required` reached only the admin page's own toggle and
  // `requiredWhen` reached nothing at all. The floor is unchanged and still
  // cannot be lowered — for the built-in set the second clause is a no-op,
  // because its `required: true` slots ARE REQUIRED_SLOT_IDS.
  //
  // Only among the slots that apply: demanding an answer to a question this
  // demand is never asked would be an unsatisfiable gate.
  const applicable = new Set(applicableSlots(ctx, config, slots).map((s) => s.id));
  return slots
    .filter((s) => applicable.has(s.id))
    .filter((s) => REQUIRED_SLOT_IDS.includes(s.id)
      || s.required
      || (s.requiredWhen?.length
        ? s.requiredWhen.every((c) => evaluateSlotCondition(c, signals, config))
        : false)
      // The section rule: what generation must cover and the Channel page
      // checks is also what the conversation requires before confirming.
      || sectionRequires(s, signals, config));
}

/**
 * The service-description sections this demand must cover — one set, read by
 * the conversation's panel, the Channel page and the request it submits.
 *
 * The sections its required questions fill, plus any section the template's
 * rules make mandatory that no question asks (an `asked: false` section, which
 * generation writes and the Channel page checks). The panel used to count the
 * first half and the Channel page the second, from different sources.
 */
export function requiredSectionIds(
  ctx: DemandConversationContext,
  slots: DemandSlot[],
  sections: ConfiguredSection[],
  config: PolicyConfig = getActivePolicyConfig(),
): string[] {
  const asked = requiredSlots(ctx, slots, config)
    .filter((s) => s.target.kind === 'sow')
    .map((s) => String(s.target.field));
  // The same rule generation's MUST COVER list is built from.
  const byRule = requiredSectionsFor(sections, slotConditionContext(ctx, config), config);
  // In template order, so every screen lists them the same way round.
  const wanted = new Set([...asked, ...byRule]);
  return [
    ...sections.map((s) => s.id).filter((id) => wanted.has(id)),
    ...[...wanted].filter((id) => !sections.some((s) => s.id === id)),
  ];
}

export function outstandingRequiredSlots(
  ctx: DemandConversationContext,
  slots: DemandSlot[] = ALL_SLOTS,
  config: PolicyConfig = getActivePolicyConfig(),
): DemandSlot[] {
  // One rule for "mandatory": `requiredSlots`, reused rather than restated.
  return requiredSlots(ctx, slots, config).filter((s) => !isSlotFilled(s, ctx));
}

export function requiredSlotsFilled(
  ctx: DemandConversationContext,
  slots: DemandSlot[] = ALL_SLOTS,
  config: PolicyConfig = getActivePolicyConfig(),
): boolean {
  // REQUIRED_SLOT_IDS is the mandatory floor that stops an LLM short-circuiting
  // the conversation, and a template that forgot to mark a slot required must
  // not be able to lower it. A template CAN add requirements; it cannot remove
  // these. `outstandingRequiredSlots` is the one place that rule lives, so the
  // two cannot drift into disagreeing about what is required.
  return outstandingRequiredSlots(ctx, slots, config).length === 0;
}
