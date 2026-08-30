// Per-step guidance copy for the New Request wizard.
//
// The wizard drew a number and a title per step and nothing else: the
// `description` already defined on each STEPS entry was never rendered, and no
// screen said what it needed from the requester or what would happen once they
// left it. A requester could reach the determination without ever being told
// that the channel decided there is the difference between a two-day catalogue
// order and a multi-week sourcing exercise.
//
// One typed map, one home. This is deliberately code rather than a config table
// for now — the copy is product voice, not tenant policy, and a table would add
// a migration, an editor and a fetch for text that changes when the wizard
// changes. It is shaped to be lifted into the config plane later: a flat map
// keyed by step number, with no logic in the values.
//
// Ground rule 1 applies to every string here: no organisation or sector naming.

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

/** The full front-door path: classify → pre-check → describe → assess → decide. */
export const STEP_GUIDANCE: Record<number, StepGuidance> = {
  1: {
    purpose:
      'Describe what you need in plain language. The assistant classifies it and pulls out what it can — you do not pick a category.',
    youProvide: [
      'A sentence, pasted brief, or PDF/DOCX describing what you need',
      'A supplier or an approximate value, if you already know them',
    ],
    next: 'We check whether a catalogue item or an existing contract already covers this before any new demand is raised.',
  },
  2: {
    purpose:
      'What already exists is checked first: catalogue items you can order today, and active contracts that already cover this need.',
    youProvide: ['Nothing to supply — review the match and confirm or reject it'],
    next: 'Your buying channel and its indicative timeline are set here, and everything after this step follows from it.',
  },
  3: {
    purpose:
      'The assistant works through the questions a complete service description needs, one at a time, and writes the description from your answers.',
    youProvide: [
      'Only the missing scope, deliverables, exclusions, or acceptance details',
      'Value, timing and any constraints the assistant asks about',
    ],
    next: 'The description written here is reused downstream — in the risk assessment, in sourcing documents and in the contract request — so it is written once.',
  },
  4: {
    purpose:
      'Risk and materiality are assessed from what you have described, and any assessment already held for this supplier is reused rather than repeated.',
    youProvide: ['Answers to the risk questions that your category and value trigger'],
    next: 'The outcome sets which reviews the request needs before it can proceed.',
  },
  5: {
    purpose:
      'The determination brings it together: buying channel, contract position, sourcing approach and the supplier for this demand.',
    youProvide: ['Confirmation of the supplier, and any residual questions still open'],
    next: 'This is the endpoint of the front door — the determination is what the request carries into execution.',
  },
  6: {
    purpose: 'Where the request goes, who approves it, and in what order.',
    youProvide: ['Nothing to supply — review the routing before you submit'],
    next: 'Submitting hands the request to the approvers shown here.',
  },
  // No entry for step 7: the confirmation screen already carries its own
  // "What happens next?" list, and a panel above it would be the same
  // duplication this change removes from step 1.
};

/**
 * The catalogue path is a different journey, not a shortened one: it ends in an
 * order rather than a determination, so steps 3 and 7 say different things. Step
 * numbers are kept aligned with CATALOGUE_STEPS in new-request-page.tsx.
 */
export const CATALOGUE_STEP_GUIDANCE: Record<number, StepGuidance> = {
  1: STEP_GUIDANCE[1],
  2: {
    purpose: 'Catalogue items matching what you described, ready to order.',
    youProvide: ['Nothing to supply — review the matches'],
    next: 'Catalogue items are pre-approved and pre-priced, so the order goes straight through.',
  },
  3: {
    purpose: 'Pick your items, set quantities and place the order.',
    youProvide: ['Items and quantities', 'A delivery location and cost centre'],
    next: 'We validate the agreement, supplier risk and policy before creating the internal request; higher-value orders may need approval.',
  },
  // Step 7 is the confirmation screen — see the note on STEP_GUIDANCE.
};

/**
 * Guidance for a step on the path the requester is actually on.
 *
 * Returns `null` rather than a placeholder when a step has no entry: a panel
 * that renders empty copy is worse than no panel, and a missing entry is a
 * defect the guidance test catches rather than something to paper over here.
 */
export function stepGuidance(step: number, isCatalogue: boolean): StepGuidance | null {
  const map = isCatalogue ? CATALOGUE_STEP_GUIDANCE : STEP_GUIDANCE;
  return map[step] ?? null;
}
