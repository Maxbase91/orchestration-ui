// The built-in service-description template.
//
// This is a faithful serialisation of what the platform does today: the eleven
// slots from demand-conversation.ts `ALL_SLOTS` with their closures expressed as
// conditions, the nine generated sections, and the prompt from api/generate-sow.ts.
//
// It exists so the config table can be empty and everything still behaves
// exactly as it did. A row only overrides what an admin has actually changed;
// nothing about the migration is a behaviour change on its own.

import type {
  ConfiguredSection,
  ConfiguredSlot,
  ServiceDescriptionTemplate,
} from './service-description-config';

/**
 * The nine sections generate-sow produces.
 *
 * `location` is marked `asked: false` because no slot has ever asked for it —
 * it is inferred by the model and then displayed next to captured answers with
 * nothing distinguishing the two. Marking it is the minimum honest fix.
 */
/**
 * `requiredWhen` encodes what governance actually demands of a description, as
 * config rather than as rules buried in a prompt string. All conditions on a
 * section must hold for it to be mandatory; a section with none is generated
 * when there is something to say and never demanded.
 *
 * These defaults are deliberately conservative — they make mandatory only what a
 * procurement reviewer would refuse to sign without:
 *   • a material engagement must state measurable acceptance criteria and what
 *     is in scope, because that is what the approval is actually against;
 *   • anything competitively sourced must state deliverables and acceptance
 *     criteria, because those become the evaluation basis for bidders;
 *   • high or critical data sensitivity must state resources and dependencies —
 *     who touches the data and what it connects to.
 */
export const DEFAULT_SECTIONS: ConfiguredSection[] = [
  { id: 'objective', label: 'Objective', asked: true },
  {
    id: 'scope', label: 'Scope', asked: true,
    requiredWhen: [{ field: 'materiality', operator: 'in', value: 'important,critical' }],
  },
  {
    id: 'deliverables', label: 'Deliverables', asked: true,
    requiredWhen: [{ field: 'sourcingType', operator: '==', value: 'competitive' }],
  },
  { id: 'timeline', label: 'Timeline', asked: true },
  {
    id: 'resources', label: 'Resources', asked: true,
    requiredWhen: [{ field: 'dataSensitivity', operator: 'in', value: 'high,critical' }],
  },
  {
    id: 'acceptanceCriteria', label: 'Acceptance Criteria', asked: true,
    requiredWhen: [{ field: 'materiality', operator: 'in', value: 'important,critical' }],
  },
  { id: 'pricingModel', label: 'Pricing Model', asked: true },
  { id: 'location', label: 'Location', asked: false },
  {
    id: 'dependencies', label: 'Dependencies', asked: true,
    requiredWhen: [{ field: 'dataSensitivity', operator: 'in', value: 'high,critical' }],
  },
];

/** Categories that get a timeline question — mirrors TIME_BASED_CATEGORIES. */
const TIME_BASED = 'services,consulting,contingent-labour';
/** Categories that get an acceptance-criteria question — mirrors OUTCOME_CATEGORIES. */
const OUTCOME_BASED = 'services,consulting,software';

export const DEFAULT_SLOTS: ConfiguredSlot[] = [
  {
    id: 'title', targetKind: 'request', targetField: 'title', required: true,
    prompt: "What do you need? Describe what you're looking to procure.",
    examples: {
      'contingent-labour': '3 senior Java developers for 6 months',
      software: '200 CRM licences with a service module',
      consulting: 'consultants to run a 2-day promptathon',
      goods: '50 height-adjustable desks for the new office',
      default: 'market-research study for APAC expansion',
    },
  },
  {
    id: 'value', targetKind: 'request', targetField: 'estimatedValue', required: true,
    prompt: "What's the estimated budget for this?",
    examples: { default: '€50,000 or 150k' },
  },
  {
    id: 'deliveryDate', targetKind: 'request', targetField: 'deliveryDate', required: false,
    prompt: 'When do you need this delivered or started by?',
    examples: { default: 'by end of Q3, or a specific date' },
  },
  {
    id: 'objective', targetKind: 'sow', targetField: 'objective', required: true,
    prompt: "What's the primary objective of this engagement?",
    examples: {
      consulting: 'run a promptathon to upskill 40 staff on AI tooling',
      software: 'roll out a new CRM to 200 sales users',
      services: 'stand up a managed support service for EMEA',
      'contingent-labour': 'augment the platform team to hit the Q3 release',
      goods: 'equip the new office with workstations',
      default: 'the outcome this should achieve',
    },
  },
  {
    id: 'scope', targetKind: 'sow', targetField: 'scope', required: true,
    prompt: 'What should be in scope — and anything explicitly out of scope?',
  },
  {
    id: 'deliverables', targetKind: 'sow', targetField: 'deliverables', required: true,
    prompt: 'What are the key deliverables?',
  },
  {
    id: 'resources', targetKind: 'sow', targetField: 'resources', required: true,
    prompt: 'What resources, skills or team size does this need?',
  },
  {
    id: 'timeline', targetKind: 'sow', targetField: 'timeline', required: false,
    prompt: 'What is the timeline or key milestones?',
    conditions: [{ field: 'category', operator: 'in', value: TIME_BASED }],
  },
  {
    id: 'acceptanceCriteria', targetKind: 'sow', targetField: 'acceptanceCriteria', required: false,
    prompt: 'How will success be measured — what are the acceptance criteria?',
    conditions: [{ field: 'category', operator: 'in', value: OUTCOME_BASED }],
  },
  {
    id: 'pricingModel', targetKind: 'sow', targetField: 'pricingModel', required: false,
    prompt: 'What pricing or commercial model applies?',
    // Deferred to the governed threshold rather than pinned to €100k, so
    // /admin/thresholds still moves it.
    conditions: [{ field: 'value', operator: '>=', value: 'policy:criticalServiceThreshold' }],
  },
  {
    id: 'dependencies', targetKind: 'sow', targetField: 'dependencies', required: false,
    prompt: 'Are there key dependencies or systems this relies on?',
    conditions: [{ field: 'value', operator: '>=', value: 'policy:continuityThreshold' }],
  },
];

/** Which sections compose the compact narrative — matches the API's composer. */
export const DEFAULT_NARRATIVE_SECTIONS = [
  'objective', 'scope', 'deliverables', 'timeline',
  'resources', 'acceptanceCriteria', 'pricingModel',
];

/**
 * Which sections seed a sourcing event's requirements.
 *
 * Scope, deliverables and acceptance criteria are what a supplier actually has
 * to respond to; objective is context and pricing is commercial, so neither
 * belongs in the requirement list a bid is scored against.
 */
export const DEFAULT_SOURCING_REQUIREMENT_SECTIONS = [
  'scope', 'deliverables', 'acceptanceCriteria',
];

/** Starting criteria for a sourcing event — the New Event wizard's current four. */
export const DEFAULT_SOURCING_CRITERIA = [
  { id: 'c1', label: 'Technical Capability', weight: 40 },
  { id: 'c2', label: 'Price', weight: 30 },
  { id: 'c3', label: 'Experience', weight: 20 },
  { id: 'c4', label: 'Sustainability', weight: 10 },
];

/** The prompt generate-sow has always used, with `${guidance}` as the slot. */
export const DEFAULT_SYSTEM_PROMPT = `You are an expert procurement category manager drafting a professional Statement of Work (SOW).

TASK: Generate a complete, detailed, professional SOW JSON for the request described below.

CATEGORY-SPECIFIC GUIDANCE:
{{guidance}}

GOVERNANCE CONTEXT FOR THIS DEMAND:
{{signals}}

RULES:
1. Each section must be MULTI-SENTENCE and SPECIFIC — never echo the user's exact words verbatim. Expand, enrich, and make professional.
2. Infer sensible defaults for any section not explicitly covered in the captured answers — clearly note AI-drafted content.
3. Write in third person, formal English, present tense.
4. Deliverables MUST be a numbered list.
5. Acceptance Criteria MUST include at least 2 measurable conditions (% targets, KPIs, sign-off gates).
6. Timeline MUST name phases with approximate durations.
7. Any section listed as MUST COVER above is mandatory and must be substantive — this demand cannot be approved or put out to market without it.
8. Output ONLY valid JSON — no markdown, no commentary outside the JSON.

OUTPUT FORMAT (JSON only):
{{outputFormat}}`;

export const DEFAULT_TEMPLATE: ServiceDescriptionTemplate = {
  category: 'default',
  label: 'Default',
  active: true,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  categoryGuidance: '',
  temperature: 0.5,
  maxTokens: 3000,
  slots: DEFAULT_SLOTS,
  sections: DEFAULT_SECTIONS,
  narrativeSections: DEFAULT_NARRATIVE_SECTIONS,
  sourcingRequirementSections: DEFAULT_SOURCING_REQUIREMENT_SECTIONS,
  defaultCriteria: DEFAULT_SOURCING_CRITERIA,
};

/**
 * Build the OUTPUT FORMAT block from the configured sections, so adding or
 * removing a section in Admin actually changes what the model is asked for
 * rather than leaving the prompt naming nine fixed keys.
 */
export function buildOutputFormat(sections: ConfiguredSection[]): string {
  const lines = sections.map((s) => `    "${s.id}": "..."`).join(',\n');
  return `{\n  "sections": {\n${lines}\n  },\n  "narrative": "<3–4 paragraph executive summary synthesising the full SOW>"\n}`;
}

/** Interpolate the guidance and output format into a template's system prompt. */
export function renderSystemPrompt(
  template: ServiceDescriptionTemplate,
  signalsBlock = '',
): string {
  return template.systemPrompt
    .replace('{{guidance}}', template.categoryGuidance || '(no category-specific guidance configured)')
    // Empty when the caller has no signals — an admin template that omits the
    // placeholder still renders, and a template that includes it never shows a
    // raw `{{signals}}` to the model.
    .replace('{{signals}}', signalsBlock || '(not yet determined)')
    .replace('{{outputFormat}}', buildOutputFormat(template.sections));
}
