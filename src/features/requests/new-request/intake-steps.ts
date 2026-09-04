// The intake's step order, gates and guidance — one source of truth.
//
// Step order used to be an emergent property of five places that had to be kept
// in sync by hand: a `STEPS` array for the progress bar, a `CATALOGUE_STEPS`
// array for the fast track, a `canProceed()` switch, `handleNext()`'s hardcoded
// `currentStep === 6` submit trigger and `Math.min(s + 1, 7)` cap, and a
// separate guidance map keyed by step number. Renumbering a step meant editing
// all five, and a miss showed up as a wizard that skipped its own submit.
//
// It also collapses seven steps into four, on one principle:
//
//     every question is asked before any conclusion is shown.
//
// The old order interleaved them. "Risk & assessment" was a stack of eight
// cards of which exactly one was a question; "Determination" and "Routing"
// were two screens of conclusions that had to be paged through separately. A
// requester could not tell what they were being asked for and what they were
// being told. So: Describe and Buy-route establish the demand, Details holds
// EVERY input, Review holds EVERY conclusion, and confirmation is an outcome
// screen rather than a numbered step nobody can navigate back to.
//
// One config, one journey. It takes no view or density argument, and
// `test:mode-equivalence` asserts that absence — the guard predates the removal
// of the Simple/Expert switch and outlives it, because the rule it enforces is
// that presentation may not reach into the step order or the gates.

import { requiredSlotsFilled, type DemandConversationContext, type DemandSlot } from '../../../lib/procurement/demand-conversation.js';
import type { IntakeFormData } from './intake-form-data.js';

/** Which fulfilment path the demand is on. Decides which steps apply. */
export type IntakeStepRoute = 'full-request' | 'catalogue' | 'contract';

export type IntakeStepId = 'describe' | 'buy-route' | 'details' | 'review' | 'confirmation';

export interface StepGuidance {
  /** One line: what this step is for, in the requester's terms. */
  purpose: string;
  /**
   * What the requester supplies here. Empty for steps that only present a
   * result — saying "nothing to supply" is itself useful, so the panel renders
   * the absence rather than hiding the row.
   */
  youProvide: string[];
  /** What happens once this step is done — the consequence, not the next label. */
  next: string;
}

/**
 * The slice of intake state a gate is allowed to read.
 *
 * Deliberately narrow and free of React: a gate is a pure predicate over
 * captured data, so it can be asserted in an integration test without mounting
 * anything.
 */
export interface IntakeGateState {
  data: IntakeFormData;
  /** True on the conversational service-description path. */
  isChatIntakePath: boolean;
  conversationCtx: DemandConversationContext;
  conversationSlots: DemandSlot[];
  /** Null while the determination is still resolving. */
  hasDetermination: boolean;
}

export interface IntakeStepDefinition {
  id: IntakeStepId;
  /** The stepper label. */
  label: string;
  /** The stepper's second line — what happens here. */
  description: string | Partial<Record<IntakeStepRoute, string>>;
  /** The routes this step appears on. */
  routes: readonly IntakeStepRoute[];
  guidance?: StepGuidance | Partial<Record<IntakeStepRoute, StepGuidance>>;
  /** Whether the requester may leave this step. */
  canProceed: (state: IntakeGateState) => boolean;
}

// Only the full-request route reaches a determination. Both fast tracks —
// catalogue and contract call-off — submit through the governed checkout on
// their Details step and go straight to confirmation, so a Review step on
// either is a step the stepper advertises and the requester can never reach.
const DETERMINED_ONLY = ['full-request'] as const;
const ALL_ROUTES = ['full-request', 'catalogue', 'contract'] as const;

export const INTAKE_STEPS: readonly IntakeStepDefinition[] = [
  {
    id: 'describe',
    label: 'Describe',
    description: 'What do you need?',
    routes: ALL_ROUTES,
    guidance: {
      purpose:
        'Describe what you need in plain language. The assistant classifies it and pulls out what it can — you do not pick a category.',
      youProvide: [
        'A sentence, pasted brief, or PDF/DOCX describing what you need',
        'A supplier or an approximate value, if you already know them',
      ],
      next: 'We check whether a catalogue item or an existing contract already covers this before any new demand is raised.',
    },
    canProceed: ({ data }) => !!data.category,
  },
  {
    id: 'buy-route',
    label: 'How you’ll buy',
    description: {
      'full-request': 'Catalogue, contract, or a new request',
      catalogue: 'Catalogue match',
      contract: 'Contract match',
    },
    routes: ALL_ROUTES,
    guidance: {
      purpose:
        'What already exists is checked first: catalogue items you can order today, and active contracts that already cover this need.',
      youProvide: ['Nothing to supply — review the match and confirm or reject it'],
      next: 'Your buying channel and its indicative timeline are set here, and everything after this step follows from it.',
    },
    // The requester must land somewhere explicit: order from the catalogue,
    // call off a contract, or say this is new demand. There is no default.
    canProceed: ({ data }) => !!data.preCheckOutcome,
  },
  {
    id: 'details',
    label: 'Details',
    description: {
      'full-request': 'Everything we need from you',
      catalogue: 'Pick items & place the order',
      contract: 'Confirm the call-off',
    },
    routes: ALL_ROUTES,
    guidance: {
      'full-request': {
        purpose:
          'Everything we need from you, in one place: the service description the assistant builds with you, and the few risk questions your description cannot answer.',
        youProvide: [
          'Only the missing scope, deliverables, exclusions, or acceptance details',
          'Answers to any risk question we could not infer',
          'The supplier, if you already have one in mind',
        ],
        next: 'Nothing after this asks you for anything — the next screen shows what we concluded and routes the request.',
      },
      catalogue: {
        purpose: 'Pick your items, set quantities and place the order.',
        youProvide: ['Items and quantities', 'A delivery location and cost centre'],
        next: 'We validate the agreement, supplier risk and policy before creating the internal request; higher-value orders may need approval.',
      },
      contract: {
        purpose: 'Confirm the value and timing of this call-off against the matched contract.',
        youProvide: ['The value and timing of this individual call-off', 'A delivery location and cost centre'],
        next: 'The call-off is validated against the contract before the internal record is created.',
      },
    },
    canProceed: ({ data, isChatIntakePath, conversationCtx, conversationSlots }) => {
      if (data.preCheckOutcome === 'catalogue' || data.category === 'catalogue') {
        return data.catalogueItems.length > 0;
      }
      if (data.preCheckOutcome === 'contract') return !!data.contractId;
      // The mandatory floor, not `title && value`. `requiredSlotsFilled` — the
      // guarantee the conversation engine defines to stop an LLM
      // short-circuiting the conversation — was computed inside the chat step
      // and never consulted at the gate, so a requester could leave with two
      // fields and no service description at all.
      //
      // Only on the chat path: the contract-renewal and supplier-onboarding
      // paths render a plain form that never captures the description
      // sections, so holding them to the same floor would block them forever.
      return isChatIntakePath
        ? requiredSlotsFilled(conversationCtx, conversationSlots)
        : !!data.title && data.estimatedValue > 0;
    },
  },
  {
    id: 'review',
    label: 'Review & submit',
    description: 'What we determined',
    // The fast tracks end at their own governed checkout: a pre-approved
    // catalogue item and a call-off under an existing contract reach no
    // determination, and manufacturing one so the step counts match would be
    // inventing governance that did not happen.
    routes: DETERMINED_ONLY,
    guidance: {
      purpose:
        'What we concluded, before you submit: how this will be bought and how long that takes, what the risk read found, who approves it, and which checks ran.',
      youProvide: ['Nothing to supply — read the determination and submit'],
      next: 'Submitting creates the internal record and hands it to the approvers shown here.',
    },
    // A governed record must never be written without a determination behind
    // it; the submit button stays disabled until the checks have resolved.
    canProceed: ({ hasDetermination }) => hasDetermination,
  },
  {
    id: 'confirmation',
    label: 'Confirmation',
    description: {
      'full-request': 'Submitted',
      catalogue: 'Order placed',
      contract: 'Call-off submitted',
    },
    routes: ALL_ROUTES,
    // The confirmation screen carries its own "what happens next" list; a
    // guidance panel above it would be the duplication this config removes.
    canProceed: () => false,
  },
];

const byId = new Map(INTAKE_STEPS.map((step) => [step.id, step]));

export function stepById(id: IntakeStepId): IntakeStepDefinition {
  const step = byId.get(id);
  if (!step) throw new Error(`Unknown intake step: ${id}`);
  return step;
}

/** The ordered steps for a route. */
export function stepsForRoute(route: IntakeStepRoute): IntakeStepDefinition[] {
  return INTAKE_STEPS.filter((step) => step.routes.includes(route));
}

/** The numbered steps shown in the progress bar — confirmation is an outcome. */
export function progressStepsForRoute(route: IntakeStepRoute): IntakeStepDefinition[] {
  return stepsForRoute(route).filter((step) => step.id !== 'confirmation');
}

/** The step whose primary action submits, rather than advancing. */
export function submitStepFor(route: IntakeStepRoute): IntakeStepId {
  const steps = progressStepsForRoute(route);
  return steps[steps.length - 1].id;
}

/**
 * The next step on this route, or `'submit'` when the current one is the last
 * before confirmation. Replaces `Math.min(currentStep + 1, 7)`, which could
 * only ever be right by coincidence once a route skipped steps.
 */
export function nextStep(id: IntakeStepId, route: IntakeStepRoute): IntakeStepId | 'submit' {
  if (id === submitStepFor(route)) return 'submit';
  const steps = stepsForRoute(route);
  const index = steps.findIndex((step) => step.id === id);
  return steps[Math.min(index + 1, steps.length - 1)].id;
}

/** The previous step on this route, or null at the start. */
export function previousStep(id: IntakeStepId, route: IntakeStepRoute): IntakeStepId | null {
  const steps = stepsForRoute(route);
  const index = steps.findIndex((step) => step.id === id);
  return index > 0 ? steps[index - 1].id : null;
}

/** 1-based position for the progress bar; 0 when the step is not numbered. */
export function stepNumber(id: IntakeStepId, route: IntakeStepRoute): number {
  return progressStepsForRoute(route).findIndex((step) => step.id === id) + 1;
}

function pickForRoute<T>(value: T | Partial<Record<IntakeStepRoute, T>> | undefined, route: IntakeStepRoute): T | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'object' && value !== null && !Array.isArray(value)
    && ('full-request' in value || 'catalogue' in value || 'contract' in value)) {
    return (value as Partial<Record<IntakeStepRoute, T>>)[route];
  }
  return value as T;
}

export function stepDescription(id: IntakeStepId, route: IntakeStepRoute): string {
  return pickForRoute(stepById(id).description, route) ?? '';
}

export function stepGuidance(id: IntakeStepId, route: IntakeStepRoute): StepGuidance | undefined {
  return pickForRoute(stepById(id).guidance, route);
}

/**
 * The route a demand is on, from what the buy-route step settled.
 *
 * A route, not a category: keying the journey off `category === 'catalogue'`
 * is what let a classifier answering "catalogue" for a paper-and-toner demand
 * put the whole wizard on the fast track before the funnel had run.
 */
export function routeFromOutcome(outcome: IntakeFormData['preCheckOutcome']): IntakeStepRoute {
  if (outcome === 'catalogue') return 'catalogue';
  if (outcome === 'contract') return 'contract';
  return 'full-request';
}
