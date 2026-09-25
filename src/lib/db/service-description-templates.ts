// Data access for service_description_templates — the admin-configured service
// description: its generation prompt, the components asked, and what is generated.
//
// Resolution is category-first with a `default` fallback, and a built-in
// fallback beneath that, so the table can be empty and everything behaves
// exactly as it did before it existed. A row overrides only what an admin
// actually changed.

import { db } from '@/lib/db-client';
import type { ServiceDescriptionTemplate } from '@/lib/procurement/service-description-config';
import { DEFAULT_TEMPLATE } from '@/lib/procurement/service-description-defaults';

const TABLE = 'service_description_templates';

/** A stored array, where absent means "not configured" and `[]` means "none". */
const asArray = <T,>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback);

/** A stored array where empty is not a configuration — see `mapRow`. */
const nonEmpty = <T,>(v: unknown, fallback: T[]): T[] =>
  (Array.isArray(v) && v.length > 0 ? (v as T[]) : fallback);

/** A stored wording map: strings only, so a hand-edited row cannot put anything else in a question. */
const wordingMap = (v: unknown): Record<string, string> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, t]) => typeof t === 'string')) as Record<string, string>
    : {};

function mapRow(row: Record<string, unknown>): ServiceDescriptionTemplate {
  return {
    category: row.category as string,
    label: (row.label as string) ?? '',
    active: row.active !== false,
    systemPrompt: (row.system_prompt as string) || DEFAULT_TEMPLATE.systemPrompt,
    categoryGuidance: (row.category_guidance as string) ?? '',
    temperature: Number(row.temperature ?? DEFAULT_TEMPLATE.temperature),
    maxTokens: Number(row.max_tokens ?? DEFAULT_TEMPLATE.maxTokens),
    // Slots and sections fall back when EMPTY as well as absent: a template that
    // asks nothing and generates nothing is not a configuration an admin can
    // mean, and it would present as the wizard being broken. `resolveSlots`
    // carries the same floor and says why.
    slots: nonEmpty(row.slots, DEFAULT_TEMPLATE.slots),
    sections: nonEmpty(row.sections, DEFAULT_TEMPLATE.sections),
    // The three id lists honour empty. `?.length` treated `[]` as "not
    // configured", so an admin clearing the compact narrative saved, toasted
    // success, and got the built-in list back on the next read — the edit undone
    // by the reader, with nothing to show it had been.
    narrativeSections: asArray(row.narrative_sections, DEFAULT_TEMPLATE.narrativeSections),
    sourcingRequirementSections: asArray(
      row.sourcing_requirement_sections,
      DEFAULT_TEMPLATE.sourcingRequirementSections,
    ),
    defaultCriteria: asArray(row.default_criteria, DEFAULT_TEMPLATE.defaultCriteria),
    riskQuestionWording: wordingMap(row.risk_question_wording),
    ...(row.updated_at ? { updatedAt: row.updated_at as string } : {}),
    ...(row.updated_by ? { updatedBy: row.updated_by as string } : {}),
  };
}

function mapToDb(t: ServiceDescriptionTemplate): Record<string, unknown> {
  return {
    category: t.category,
    label: t.label,
    active: t.active,
    system_prompt: t.systemPrompt,
    category_guidance: t.categoryGuidance,
    temperature: t.temperature,
    max_tokens: t.maxTokens,
    slots: t.slots,
    sections: t.sections,
    narrative_sections: t.narrativeSections,
    sourcing_requirement_sections: t.sourcingRequirementSections,
    default_criteria: t.defaultCriteria,
    risk_question_wording: t.riskQuestionWording ?? {},
    updated_at: new Date().toISOString(),
    ...(t.updatedBy ? { updated_by: t.updatedBy } : {}),
  };
}

export async function listServiceDescriptionTemplates(): Promise<ServiceDescriptionTemplate[]> {
  const { data, error } = await db.from(TABLE).select('*').order('category');
  if (error) throw error;
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

/**
 * The template for a category: its own row, else the `default` row, else the
 * built-in. Never returns null — generation must always have something to run.
 */
export async function resolveServiceDescriptionTemplate(
  category: string | undefined,
): Promise<ServiceDescriptionTemplate> {
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .in('category', [category ?? 'default', 'default'])
    .eq('active', true);

  // Falling back is right — generation must always have something to run — but
  // the error was destructured away entirely, so a failed read was
  // indistinguishable from an unconfigured table: the admin's template silently
  // replaced by the built-in, every time, with nothing said. Its three siblings
  // in this file all throw. Logged rather than thrown, mirroring the server's
  // api/_sd-template.ts, so the fail-open contract holds and the failure is
  // still visible.
  if (error) console.warn('[service-description] falling back to the built-in template:', error);

  const rows = (data ?? []) as Record<string, unknown>[];
  const exact = rows.find((r) => r.category === category);
  const fallback = rows.find((r) => r.category === 'default');
  const row = exact ?? fallback;
  return row ? mapRow(row) : DEFAULT_TEMPLATE;
}

export async function saveServiceDescriptionTemplate(
  template: ServiceDescriptionTemplate,
): Promise<ServiceDescriptionTemplate> {
  const { data, error } = await db
    .from(TABLE)
    .upsert(mapToDb(template), { onConflict: 'category' })
    .select('*')
    .single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

export async function deleteServiceDescriptionTemplate(category: string): Promise<void> {
  const { error } = await db.from(TABLE).delete().eq('category', category);
  if (error) throw error;
}
