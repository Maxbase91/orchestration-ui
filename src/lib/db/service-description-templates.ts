// Data access for service_description_templates — the admin-configured service
// description: its generation prompt, the components asked, and what is generated.
//
// Resolution is category-first with a `default` fallback, and a built-in
// fallback beneath that, so the table can be empty and everything behaves
// exactly as it did before it existed. A row overrides only what an admin
// actually changed.

import { supabase } from '@/lib/supabase-client';
import type { ServiceDescriptionTemplate } from '@/lib/procurement/service-description-config';
import { DEFAULT_TEMPLATE } from '@/lib/procurement/service-description-defaults';

const TABLE = 'service_description_templates';

function mapRow(row: Record<string, unknown>): ServiceDescriptionTemplate {
  return {
    category: row.category as string,
    label: (row.label as string) ?? '',
    active: row.active !== false,
    systemPrompt: (row.system_prompt as string) || DEFAULT_TEMPLATE.systemPrompt,
    categoryGuidance: (row.category_guidance as string) ?? '',
    temperature: Number(row.temperature ?? DEFAULT_TEMPLATE.temperature),
    maxTokens: Number(row.max_tokens ?? DEFAULT_TEMPLATE.maxTokens),
    // An empty array means "not configured", so fall back rather than shipping a
    // template with no questions and no sections.
    slots: (row.slots as ServiceDescriptionTemplate['slots'])?.length
      ? (row.slots as ServiceDescriptionTemplate['slots'])
      : DEFAULT_TEMPLATE.slots,
    sections: (row.sections as ServiceDescriptionTemplate['sections'])?.length
      ? (row.sections as ServiceDescriptionTemplate['sections'])
      : DEFAULT_TEMPLATE.sections,
    narrativeSections: (row.narrative_sections as string[])?.length
      ? (row.narrative_sections as string[])
      : DEFAULT_TEMPLATE.narrativeSections,
    sourcingRequirementSections: (row.sourcing_requirement_sections as string[])?.length
      ? (row.sourcing_requirement_sections as string[])
      : DEFAULT_TEMPLATE.sourcingRequirementSections,
    defaultCriteria: (row.default_criteria as ServiceDescriptionTemplate['defaultCriteria'])?.length
      ? (row.default_criteria as ServiceDescriptionTemplate['defaultCriteria'])
      : DEFAULT_TEMPLATE.defaultCriteria,
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
    updated_at: new Date().toISOString(),
    ...(t.updatedBy ? { updated_by: t.updatedBy } : {}),
  };
}

export async function listServiceDescriptionTemplates(): Promise<ServiceDescriptionTemplate[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('category');
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
  const { data } = await supabase
    .from(TABLE)
    .select('*')
    .in('category', [category ?? 'default', 'default'])
    .eq('active', true);

  const rows = (data ?? []) as Record<string, unknown>[];
  const exact = rows.find((r) => r.category === category);
  const fallback = rows.find((r) => r.category === 'default');
  const row = exact ?? fallback;
  return row ? mapRow(row) : DEFAULT_TEMPLATE;
}

export async function saveServiceDescriptionTemplate(
  template: ServiceDescriptionTemplate,
): Promise<ServiceDescriptionTemplate> {
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(mapToDb(template), { onConflict: 'category' })
    .select('*')
    .single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

export async function deleteServiceDescriptionTemplate(category: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('category', category);
  if (error) throw error;
}
