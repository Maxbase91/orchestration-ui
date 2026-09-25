// Server-side read of the admin-configured service description template.
//
// Mirrors api/_ai-agents.ts: a 60s process-local memo so a serverless
// invocation does not hit the DB every time, resetting on cold start.
//
// Fails open in every direction: no row, a bad row, or an unreachable database
// all return the built-in template, so generation keeps working and an admin
// mistake cannot take the intake wizard down.
//
// (The note that used to sit here said PolicyConfig lived in localStorage and
// was therefore unreachable from a serverless route. It is a Postgres singleton
// and has been since ADR-0002; `api/_policy.ts` is how these routes read it.)

import { getDbAdmin } from './_db-admin.js';
import type { ServiceDescriptionTemplate } from '../src/lib/procurement/service-description-config.js';
import { DEFAULT_TEMPLATE } from '../src/lib/procurement/service-description-defaults.js';

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { value: ServiceDescriptionTemplate; expiresAt: number }>();

/** A stored wording map: strings only, so a hand-edited row cannot put anything else in a question. */
const wordingMap = (v: unknown): Record<string, string> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, t]) => typeof t === 'string')) as Record<string, string>
    : {};

function coerce(row: Record<string, unknown>): ServiceDescriptionTemplate {
  /**
   * An array the admin stored, honouring EMPTY as a configuration.
   *
   * `v.length > 0 ? v : fallback` treated `[]` as "not configured", so clearing
   * `narrativeSections` saved, toasted success, and came back with the built-in
   * list on the next read — the admin's edit undone by the reader. Absent is
   * not configured; empty is configured to nothing.
   */
  const arr = <T,>(v: unknown, fallback: T[]): T[] =>
    Array.isArray(v) ? (v as T[]) : fallback;

  /**
   * The two lists where empty is not a configuration but an empty template.
   *
   * A template with no slots asks nothing and one with no sections generates
   * nothing — neither is a thing an admin can mean, and both would present as
   * the wizard being broken. `resolveSlots` already carries this floor for
   * slots and says why; this keeps the reader agreeing with it.
   */
  const nonEmpty = <T,>(v: unknown, fallback: T[]): T[] =>
    Array.isArray(v) && v.length > 0 ? (v as T[]) : fallback;

  return {
    category: (row.category as string) ?? 'default',
    label: (row.label as string) ?? '',
    active: row.active !== false,
    systemPrompt: (row.system_prompt as string) || DEFAULT_TEMPLATE.systemPrompt,
    categoryGuidance: (row.category_guidance as string) ?? '',
    temperature: Number(row.temperature ?? DEFAULT_TEMPLATE.temperature),
    maxTokens: Number(row.max_tokens ?? DEFAULT_TEMPLATE.maxTokens),
    slots: nonEmpty(row.slots, DEFAULT_TEMPLATE.slots),
    sections: nonEmpty(row.sections, DEFAULT_TEMPLATE.sections),
    narrativeSections: arr(row.narrative_sections, DEFAULT_TEMPLATE.narrativeSections),
    sourcingRequirementSections: arr(
      row.sourcing_requirement_sections,
      DEFAULT_TEMPLATE.sourcingRequirementSections,
    ),
    defaultCriteria: arr(row.default_criteria, DEFAULT_TEMPLATE.defaultCriteria),
    riskQuestionWording: wordingMap(row.risk_question_wording),
  };
}

/** The template for a category: its own row, else `default`, else the built-in. */
export async function getServiceDescriptionTemplate(
  category: string | undefined,
): Promise<ServiceDescriptionTemplate> {
  const key = category ?? 'default';
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && hit.expiresAt > now) return hit.value;

  let value = DEFAULT_TEMPLATE;
  try {
    const { data, error } = await getDbAdmin()
      .from('service_description_templates')
      .select('*')
      .in('category', [key, 'default'])
      .eq('active', true);

    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Record<string, unknown>[];
    const row = rows.find((r) => r.category === key) ?? rows.find((r) => r.category === 'default');
    if (row) value = coerce(row);
  } catch (e) {
    console.warn('[sd-template] falling back to the built-in template:', e);
  }

  cache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
  return value;
}
