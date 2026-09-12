// Stage SLAs, from the workflow templates that own them.
//
// There were two sources and neither knew about the other. The `sla_targets`
// table is editable at /admin/sla-targets, whose subtitle claimed its values
// decide when a request is flagged overdue — but `requests.sla_deadline`, which
// every countdown and every stuck/bottleneck view actually reads, is computed
// from the template node's `slaDays` in transition.ts. Editing the admin grid
// changed nothing; only four chart components ever read the table, and they
// recomputed locally against numbers the rest of the platform ignored.
//
// The template won: an SLA is a property of a stage, and the stage is defined
// in the Workflow Designer where `slaDays` is already edited and already works.
// This module is how everything else reads it.
//
// `sla_targets` is not dead — its `stage = 'ticket'` rows are read server-side
// by tickets-core.ts for support-ticket SLAs, which are a different clock.
import type { RequestStatus } from '../../data/types.js';
import { nodeToStatus } from './node-config.js';

export interface StageSla {
  stage: RequestStatus;
  days: number;
  /** The template the figure came from, so a screen can say where to change it. */
  templateId: string;
}

interface TemplateLike {
  id: string;
  nodes?: Array<{ type?: string; label?: string; slaDays?: number }>;
}

/**
 * Every stage SLA the templates define.
 *
 * A stage can appear in more than one template with different figures — a
 * catalogue approval is not a procurement-led approval — so the result is keyed
 * by template as well as stage rather than collapsing to one number per stage.
 */
export function stageSlasFromTemplates(templates: TemplateLike[]): StageSla[] {
  const out: StageSla[] = [];
  for (const template of templates) {
    for (const node of template.nodes ?? []) {
      if (node.type !== 'stage' || typeof node.label !== 'string' || node.slaDays == null) continue;
      out.push({ stage: nodeToStatus(node.label) as RequestStatus, days: node.slaDays, templateId: template.id });
    }
  }
  return out;
}

/**
 * The SLA for one stage, preferring a named template.
 *
 * Returns null rather than a default when nothing defines one: absence of a
 * target is not a five-day target, and a screen showing "5 days" for a stage
 * nobody configured is the kind of invented number this whole pass has been
 * removing. `resolveSla` in src/lib/db/sla-targets.ts did exactly that.
 */
export function stageSlaDays(
  slas: StageSla[],
  stage: string,
  templateId?: string,
): number | null {
  if (templateId) {
    const exact = slas.find((s) => s.stage === stage && s.templateId === templateId);
    if (exact) return exact.days;
  }
  return slas.find((s) => s.stage === stage)?.days ?? null;
}
