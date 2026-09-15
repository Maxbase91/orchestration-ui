// Which forms a stage asks for — one predicate, two gates.
//
// A form is evidence a stage needs. Two places decide whether it is being
// asked for: the request detail renders it, and the advance action refuses to
// move while a `blocking` one is outstanding. Those were separate pieces of
// code, and they disagreed — the renderer evaluated `triggerConditions` and
// the blocking gate did not.
//
// So a template that was both conditional AND blocking would strand every
// request in its stage, including the ones its own conditions exclude: the
// form would never render, and the button would never unlock. No seeded
// template is currently both, but `blocking` is a live column and the Form
// Builder can set it, so the surface is reachable.
//
// The fix is not "remember to call evalCondition in both places". It is that
// the blocking set is a SUBSET of the triggered set by construction — there is
// one predicate here, and the gates are views over it.
import type { FormTemplate } from '../../data/form-templates.js';
import type { PolicyConfig } from '../procurement/policy-config.js';
import { evalCondition, type RoutingContext } from '../routing/evaluate-routing-rules.js';
import { resolvePolicyList } from '../procurement/policy-tokens.js';

/**
 * What a trigger condition is evaluated against — literally the routing
 * vocabulary, so the two config surfaces cannot drift into two dialects.
 */
export type FormTriggerContext = RoutingContext;

/**
 * Active templates this stage asks for, given the request.
 *
 * `every` with an explicit false for an unrecognised condition. The original
 * was `.some()` returning `true` by default, so ONE unrecognised condition
 * made the whole set pass — a form configured "category equals software AND
 * value greater_than 100000" fired on every request, while the builder's own
 * preview described the conditions as ANDed.
 */
export function triggeredForms(
  templates: FormTemplate[],
  stage: string,
  ctx: FormTriggerContext,
  config: PolicyConfig,
): FormTemplate[] {
  return templates.filter((template) => {
    if (template.status !== 'active') return false;
    if (!template.triggerStages.includes(stage)) return false;
    const conditions = template.triggerConditions ?? [];
    if (conditions.length === 0) return true;
    return conditions.every((cond) => evalCondition(
      cond.field,
      cond.operator,
      // A form condition may reference a governed threshold by name, the same
      // as a routing rule. Resolved here, at the read boundary, so the shared
      // evaluator stays pure and token-blind.
      resolvePolicyList(cond.value, config).value,
      ctx,
    ));
  });
}

/**
 * The blocking forms this stage is still waiting on.
 *
 * Deliberately `triggeredForms(...)` narrowed, rather than its own filter over
 * the same columns: a second filter is a second chance to forget a condition,
 * which is exactly what happened.
 */
export function outstandingBlockingForms(
  templates: FormTemplate[],
  submittedTemplateIds: ReadonlySet<string>,
  stage: string,
  ctx: FormTriggerContext,
  config: PolicyConfig,
): FormTemplate[] {
  return triggeredForms(templates, stage, ctx, config)
    .filter((t) => t.blocking === true && !submittedTemplateIds.has(t.id));
}

/**
 * The forms to render: triggered, and not already submitted.
 *
 * Same base set as the blocking gate, narrowed differently — a non-blocking
 * form still has to appear, it just does not hold the stage.
 */
export function outstandingForms(
  templates: FormTemplate[],
  submittedTemplateIds: ReadonlySet<string>,
  stage: string,
  ctx: FormTriggerContext,
  config: PolicyConfig,
): FormTemplate[] {
  return triggeredForms(templates, stage, ctx, config)
    .filter((t) => !submittedTemplateIds.has(t.id));
}
