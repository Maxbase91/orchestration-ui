// The configurable shape of a service description: the generation prompt, which
// components are asked, and what is generated.
//
// Pure and dependency-light on purpose — the serverless routes (api/generate-sow,
// api/chat-intake) import it as well as the browser, so it must not reach for
// React, Supabase or anything that only exists in one of those worlds.
//
// The key design point is that `appliesWhen` stops being a closure. A closure
// cannot be stored, which is the single reason `ALL_SLOTS` in
// demand-conversation.ts had to be a code constant. It becomes a
// {field, operator, value} condition — the same shape routing_rules and
// form_templates.trigger_conditions already use, so there is one condition
// vocabulary across the platform rather than a third.

import type { PolicyConfig } from './policy-config';

/** Operators a slot condition may use. Matches evaluate-routing-rules. */
export type SlotConditionOperator = '>=' | '>' | '<=' | '<' | '==' | '!=' | 'in';

/**
 * The fields a condition can address.
 *
 * `category` and `value` are known from the first keystroke. The four governance
 * fields come from the capture-time read (`demand-signals.ts`) and are what make
 * "a material engagement must specify exit provisions" expressible as config
 * rather than a constant buried in the prompt.
 */
export type SlotConditionField =
  | 'category'
  | 'value'
  | 'materiality'
  | 'riskTier'
  | 'dataSensitivity'
  | 'sourcingType';

export interface SlotCondition {
  field: SlotConditionField;
  operator: SlotConditionOperator;
  /**
   * A literal, a comma-separated list for `in`, or `policy:<key>` to defer to a
   * governed threshold. The indirection matters: the two value-based branches
   * today read `criticalServiceThreshold` and `continuityThreshold`, both
   * editable at /admin/thresholds, and hardcoding the number here would quietly
   * detach them from that screen.
   */
  value: string;
}

/** Where a captured answer lands. */
export type SlotTargetKind = 'request' | 'sow';

export interface ConfiguredSlot {
  id: string;
  targetKind: SlotTargetKind;
  /** Column on the request, or section id on the service description. */
  targetField: string;
  required: boolean;
  /** The question put to the requester. */
  prompt: string;
  /** Optional worked example appended to the prompt, per category. */
  examples?: Record<string, string>;
  /** All must hold for the slot to be asked. Empty means always. */
  conditions?: SlotCondition[];
  /**
   * Why this demand is being asked this question, shown beneath the prompt.
   *
   * Only worth setting on a CONDITIONAL slot: a question that appears for some
   * demands and not others is the one that reads as arbitrary. Empty or absent
   * means no rationale line — an admin can reword or remove it here, in the
   * same template the prompts already live in.
   */
  why?: string;
  /** Conditions under which an answer is mandatory rather than merely asked. */
  requiredWhen?: SlotCondition[];
}

export interface ConfiguredSection {
  id: string;
  label: string;
  /**
   * Conditions under which this section is MANDATORY, beyond being generated.
   * All must hold. Empty or absent means the section is optional — generated
   * when there is something to say, never demanded.
   */
  requiredWhen?: SlotCondition[];
  /**
   * False for a section the platform infers rather than asks for.
   *
   * `location` is exactly this case: it is one of the nine generated sections
   * and no slot has ever asked for it, so it has always been invented by the
   * model and presented alongside captured answers with nothing marking the
   * difference.
   */
  asked: boolean;
}

export interface ServiceDescriptionTemplate {
  category: string;
  label: string;
  active: boolean;
  systemPrompt: string;
  categoryGuidance: string;
  temperature: number;
  maxTokens: number;
  slots: ConfiguredSlot[];
  sections: ConfiguredSection[];
  /** Which sections compose the compact narrative, in order. */
  narrativeSections: string[];
  /** Which sections seed a sourcing event's requirements. */
  sourcingRequirementSections: string[];
  /** Starting evaluation criteria for a sourcing event raised from this demand. */
  defaultCriteria: { id: string; label: string; weight: number }[];
  updatedAt?: string;
  updatedBy?: string;
}

/** Resolve `policy:<key>` indirection against the governed thresholds. */
function resolveConditionValue(raw: string, config: PolicyConfig): string | number {
  if (raw.startsWith('policy:')) {
    const key = raw.slice('policy:'.length) as keyof PolicyConfig;
    const v = config[key];
    return typeof v === 'number' ? v : raw;
  }
  return raw;
}

/**
 * Evaluate one slot condition against the intake context.
 *
 * Numeric comparison when both sides parse as numbers, string comparison
 * otherwise — the same coercion `evalCondition` in evaluate-routing-rules.ts
 * applies, so a rule written in one place behaves the same in the other.
 */
export interface SlotConditionContext {
  category?: string;
  value?: number;
  /** Present only once the capture-time signals have been computed. */
  materiality?: string;
  riskTier?: string;
  dataSensitivity?: string;
  sourcingType?: string;
}

export function evaluateSlotCondition(
  condition: SlotCondition,
  ctx: SlotConditionContext,
  config: PolicyConfig,
): boolean {
  // An unknown signal makes the condition false rather than throwing or
  // defaulting to true: a section is required because a signal SAYS so, and
  // "we don't know yet" is not that signal.
  const lhsRaw = ctx[condition.field];
  const rhsRaw = resolveConditionValue(condition.value, config);

  if (condition.operator === 'in') {
    const list = String(rhsRaw).split(',').map((s) => s.trim().toLowerCase());
    return list.includes(String(lhsRaw ?? '').toLowerCase());
  }

  const lhsNum = typeof lhsRaw === 'number' ? lhsRaw : Number.parseFloat(String(lhsRaw ?? ''));
  const rhsNum = typeof rhsRaw === 'number' ? rhsRaw : Number.parseFloat(String(rhsRaw));
  const numeric = Number.isFinite(lhsNum) && Number.isFinite(rhsNum);

  const l: string | number = numeric ? lhsNum : String(lhsRaw ?? '').toLowerCase();
  const r: string | number = numeric ? rhsNum : String(rhsRaw).toLowerCase();

  switch (condition.operator) {
    case '>=': return l >= r;
    case '>': return l > r;
    case '<=': return l <= r;
    case '<': return l < r;
    case '==': return l === r;
    case '!=': return l !== r;
    default: return true;
  }
}

/** Is this slot asked for this demand? All conditions must hold. */
export function slotApplies(
  slot: ConfiguredSlot,
  ctx: SlotConditionContext,
  config: PolicyConfig,
): boolean {
  if (!slot.conditions || slot.conditions.length === 0) return true;
  return slot.conditions.every((c) => evaluateSlotCondition(c, ctx, config));
}

/**
 * The sections the signals make mandatory for this demand.
 *
 * Drives two things that must not disagree: what the generation prompt tells the
 * model it MUST cover, and what the determination screen reports as missing.
 * Both read this, so a section cannot be demanded by one and ignored by the
 * other — the class of drift that produced three different narrative composers.
 */
export function requiredSectionsFor(
  sections: ConfiguredSection[],
  ctx: SlotConditionContext,
  config: PolicyConfig,
): string[] {
  return sections
    .filter((s) => s.requiredWhen?.length && s.requiredWhen.every((c) => evaluateSlotCondition(c, ctx, config)))
    .map((s) => s.id);
}

/**
 * Compose the compact narrative from the sections the template nominates.
 *
 * One composer, replacing two that had silently drifted: the API's
 * `composeNarrative` joined six-plus fields with an opening sentence while the
 * offline fallback in step-chat-intake.tsx joined four, and a docstring claimed
 * they were in step.
 */
export function composeNarrativeFromSections(
  sections: Record<string, string>,
  narrativeSections: string[],
  meta: { title?: string; category?: string; value?: number; unpolished?: boolean },
): string {
  const parts = narrativeSections
    .map((id) => sections[id]?.trim())
    .filter((t): t is string => Boolean(t));

  if (parts.length === 0) return '';

  const opener = meta.title
    ? `${meta.title}${meta.category ? ` (${meta.category})` : ''}${
        meta.value ? ` — estimated value €${meta.value.toLocaleString()}` : ''
      }.`
    : '';

  const body = [opener, ...parts].filter(Boolean).join('\n\n');
  return meta.unpolished
    ? `${body}\n\nDrafted directly from the captured intake answers without AI polishing.`
    : body;
}
