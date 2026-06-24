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
// (api/chat-intake.ts) and the offline fallback (step-chat-intake.tsx) consume
// this so the conversation behaves identically whether or not the LLM is up.
//
// Requester location and beneficiary are NEVER slots here — they are derived
// from the requester's profile / a UI control, so the conversation never asks
// for them.

import { getActivePolicyConfig, type PolicyConfig } from './policy-config';

export type DemandSlotId =
  | 'title'
  | 'value'
  | 'deliveryDate'
  | 'objective'
  | 'scope'
  | 'deliverables'
  | 'resources'
  | 'timeline'
  | 'acceptanceCriteria'
  | 'pricingModel'
  | 'dependencies';

/** The service-description elements a slot can fill (subset of the full SOW). */
export interface ServiceDescriptionSlots {
  objective?: string;
  scope?: string;
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
  | { kind: 'sow'; field: keyof ServiceDescriptionSlots };

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
}

export interface DemandSlot {
  id: DemandSlotId;
  target: DemandSlotTarget;
  /** Required slots are the mandatory minimum (today's title + value + 4 SOW). */
  required: boolean;
  /** Base question; the LLM may rephrase, the offline fallback uses it verbatim. */
  prompt: string;
  /** A short, category-specific example appended to the prompt. */
  example?: (ctx: DemandConversationContext) => string;
  /** Slot is part of the agenda only when this returns true (absent ⇒ always). */
  appliesWhen?: (ctx: DemandConversationContext, config: PolicyConfig) => boolean;
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
  return `(e.g. ${byCategory[ctx.category] ?? fallback})`;
}

/**
 * The canonical slot order. Required slots reproduce the previous fixed
 * sequence (title → value → objective → scope → deliverables → resources);
 * the conditional slots enrich it and only appear when their trigger fires.
 */
const ALL_SLOTS: DemandSlot[] = [
  {
    id: 'title',
    target: { kind: 'request', field: 'title' },
    required: true,
    prompt: "What do you need? Describe what you're looking to procure.",
    example: (ctx) => ex(ctx, {
      'contingent-labour': '3 senior Java developers for 6 months',
      software: '200 CRM licences with a service module',
      consulting: 'consultants to run a 2-day promptathon',
      goods: '50 height-adjustable desks for the new office',
    }, 'market-research study for APAC expansion'),
  },
  {
    id: 'value',
    target: { kind: 'request', field: 'estimatedValue' },
    required: true,
    prompt: "What's the estimated budget for this?",
    example: () => '(e.g. €50,000 or 150k)',
  },
  {
    id: 'deliveryDate',
    target: { kind: 'request', field: 'deliveryDate' },
    required: false,
    prompt: 'When do you need this delivered or started by?',
    example: () => '(e.g. by end of Q3, or a specific date)',
  },
  {
    id: 'objective',
    target: { kind: 'sow', field: 'objective' },
    required: true,
    prompt: "What's the primary objective of this engagement?",
    example: (ctx) => ex(ctx, {
      consulting: 'run a promptathon to upskill 40 staff on AI tooling',
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
    prompt: 'What should be in scope — and anything explicitly out of scope?',
    example: (ctx) => ex(ctx, {
      consulting: 'in: facilitation, materials & coaching; out: tooling licences',
      software: 'in: Sales & Service modules + migration; out: custom reports',
    }, "what's included — and anything explicitly out of scope"),
  },
  {
    id: 'deliverables',
    target: { kind: 'sow', field: 'deliverables' },
    required: true,
    prompt: 'What are the key deliverables?',
    example: (ctx) => ex(ctx, {
      consulting: 'agenda, run-of-show, facilitated sessions, write-up',
      software: 'the configured modules, migrated data and trained users',
      goods: 'the items delivered and installed',
    }, 'the reports, milestones or outputs expected'),
  },
  {
    id: 'resources',
    target: { kind: 'sow', field: 'resources' },
    required: true,
    prompt: 'What resources, skills or team size does this need?',
    example: (ctx) => ex(ctx, {
      'contingent-labour': 'role, seniority and headcount',
      consulting: 'a lead facilitator and 2 AI specialists',
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
      consulting: 'a 2-day event in September, prep 3 weeks before',
      'contingent-labour': '6-month engagement starting October',
    }, '12 weeks, kickoff in September, readout at week 8'),
    appliesWhen: (ctx) => TIME_BASED_CATEGORIES.has(ctx.category),
  },
  {
    id: 'acceptanceCriteria',
    target: { kind: 'sow', field: 'acceptanceCriteria' },
    required: false,
    prompt: 'How will success be measured — what are the acceptance criteria?',
    example: (ctx) => ex(ctx, {
      consulting: '40 staff trained, >80% satisfaction, 3 prototypes built',
      software: 'UAT passed, <2% error rate, go-live sign-off',
    }, 'sign-off criteria / how success is measured'),
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
    // High-value demands warrant capturing the commercial model up front.
    appliesWhen: (ctx, config) => (ctx.estimatedValue ?? 0) >= config.criticalServiceThreshold,
  },
  {
    id: 'dependencies',
    target: { kind: 'sow', field: 'dependencies' },
    required: false,
    prompt: 'Are there key dependencies or systems this relies on?',
    example: () => '(e.g. systems, data, venues or teams this relies on)',
    // Large engagements carry continuity-relevant dependencies worth surfacing.
    appliesWhen: (ctx, config) => (ctx.estimatedValue ?? 0) >= config.continuityThreshold,
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

function isSlotFilled(slot: DemandSlot, ctx: DemandConversationContext): boolean {
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
): DemandSlot[] {
  return ALL_SLOTS.filter((slot) => {
    if (isSlotFilled(slot, ctx)) return false;
    if (slot.appliesWhen && !slot.appliesWhen(ctx, config)) return false;
    return true;
  });
}

/** The single next slot to ask plus its resolved prompt, or null when complete. */
export function determineNextQuestion(
  ctx: DemandConversationContext,
  config: PolicyConfig = getActivePolicyConfig(),
): { slot: DemandSlot; prompt: string } | null {
  const agenda = buildAgenda(ctx, config);
  if (agenda.length === 0) return null;
  const slot = agenda[0];
  const example = slot.example?.(ctx);
  return { slot, prompt: example ? `${slot.prompt} ${example}` : slot.prompt };
}

/** Complete when nothing applicable is left to ask (required + triggered). */
export function isConversationComplete(
  ctx: DemandConversationContext,
  config: PolicyConfig = getActivePolicyConfig(),
): boolean {
  return buildAgenda(ctx, config).length === 0;
}

/**
 * The mandatory-SOW guarantee, independent of the optional/conditional slots:
 * title + value + the four core SOW elements. Used to stop an LLM from
 * short-circuiting the conversation before the essentials are captured.
 */
export function requiredSlotsFilled(ctx: DemandConversationContext): boolean {
  return ALL_SLOTS.filter((s) => REQUIRED_SLOT_IDS.includes(s.id)).every((s) =>
    isSlotFilled(s, ctx),
  );
}
