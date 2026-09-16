// A form that cannot fire must look broken, not merely quiet.
//
// This is the same argument `diagnoseRule` makes for routing rules, applied to
// the surface that had none. Routing rules got diagnostics after RR-001 sat
// active and dead for months; form templates kept the original failure mode —
// a condition on a misspelled field falls to `undefined`, `evalCondition`
// returns false, and with `.every()` the whole form silently never renders.
// Identical symptom, no message anywhere.
//
// Worse here than for rules, because a form can also BLOCK a stage. A blocking
// template whose conditions can never be true holds the stage shut for the
// requests it does apply to, while never showing them the form.
import type { FormTemplate } from '../../data/form-templates.js';
import type { PolicyConfig } from '../procurement/policy-config.js';
import {
  SUPPORTED_FIELDS, SUPPORTED_OPERATORS,
} from '../routing/evaluate-routing-rules.js';
import { resolvePolicyList } from '../procurement/policy-tokens.js';

/**
 * Fields the routing vocabulary supports that the FORM trigger context does
 * not supply.
 *
 * `useFormTriggerContext` builds seven of the ten: a request record carries no
 * risk rating, materiality flag or region. A condition on one of those is
 * permanently false, and permanently false is exactly what this file exists to
 * make visible. Remove an entry here the moment the context starts supplying
 * it, or the diagnostic becomes the false alarm instead.
 */
const UNSUPPLIED_FIELDS: readonly string[] = ['riskRating', 'material', 'region'];

export interface FormDiagnostic {
  templateId: string;
  templateName: string;
  problems: string[];
}

export interface DiagnoseFormContext {
  /** Stages a form may trigger on — the lifecycle, not a restated list. */
  stages: readonly string[];
  config: PolicyConfig;
}

export function diagnoseFormTemplate(
  template: FormTemplate,
  ctx: DiagnoseFormContext,
): string[] {
  const problems: string[] = [];

  if (template.triggerStages.length === 0) {
    problems.push('No trigger stage, so this form is never asked for.');
  }
  for (const stage of template.triggerStages) {
    if (!ctx.stages.includes(stage)) {
      problems.push(`"${stage}" is not a stage any channel traverses, so this form can never appear.`);
    }
  }

  for (const cond of template.triggerConditions ?? []) {
    if (!cond.field) {
      problems.push('A condition has no field, so it can never be true.');
      continue;
    }
    if (!(SUPPORTED_FIELDS as readonly string[]).includes(cond.field)) {
      problems.push(`Unknown field "${cond.field}" — this condition can never be true.`);
    } else if (UNSUPPLIED_FIELDS.includes(cond.field)) {
      problems.push(`Nothing supplies "${cond.field}" to a form, so this condition can never be true.`);
    }
    if (!(SUPPORTED_OPERATORS as readonly string[]).includes(cond.operator)) {
      problems.push(`Unsupported operator "${cond.operator}" on "${cond.field}".`);
    }
    const resolved = resolvePolicyList(cond.value, ctx.config);
    if (resolved.unresolved) {
      problems.push(`Unknown governed threshold "${cond.value}" — this condition can never be true.`);
    }
    if (cond.operator === 'between' && resolved.value.split(',').length !== 2) {
      problems.push(`"${cond.field} between ${cond.value}" needs two comma-separated bounds.`);
    }
  }

  // A blocking form that cannot fire is the worst case: it holds the stage
  // shut for the requests it does apply to while never showing them the form.
  if (template.blocking && problems.length > 0) {
    problems.push('This form blocks its stage, so a condition that can never be true strands every request in it.');
  }

  return problems;
}

/** Every active template that cannot do what it says, for the admin list. */
export function diagnoseFormTemplates(
  templates: FormTemplate[],
  ctx: DiagnoseFormContext,
): FormDiagnostic[] {
  return templates
    .filter((t) => t.status === 'active')
    .map((t) => ({ templateId: t.id, templateName: t.name, problems: diagnoseFormTemplate(t, ctx) }))
    .filter((d) => d.problems.length > 0);
}
