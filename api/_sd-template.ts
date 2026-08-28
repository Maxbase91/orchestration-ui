// Server-side read of the admin-configured service description template.
//
// Mirrors api/_ai-agents.ts: a 60s process-local memo so a serverless
// invocation does not hit the DB every time, resetting on cold start.
//
// This is the reason the config is a table rather than a store. PolicyConfig
// lives in localStorage, so this route — and api/chat-intake.ts, which imports
// demand-conversation server-side — can never see an admin's overrides. Two of
// the four question-branch thresholds already fail exactly that way.
//
// Fails open in every direction: no row, a bad row, or an unreachable database
// all return the built-in template, so generation keeps working and an admin
// mistake cannot take the intake wizard down.

import { getSupabaseAdmin } from './_supabase-admin.js';
import type { ServiceDescriptionTemplate } from '../src/lib/procurement/service-description-config.js';
import { DEFAULT_TEMPLATE } from '../src/lib/procurement/service-description-defaults.js';

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { value: ServiceDescriptionTemplate; expiresAt: number }>();

function coerce(row: Record<string, unknown>): ServiceDescriptionTemplate {
  const arr = <T,>(v: unknown, fallback: T[]): T[] =>
    Array.isArray(v) && v.length > 0 ? (v as T[]) : fallback;

  return {
    category: (row.category as string) ?? 'default',
    label: (row.label as string) ?? '',
    active: row.active !== false,
    systemPrompt: (row.system_prompt as string) || DEFAULT_TEMPLATE.systemPrompt,
    categoryGuidance: (row.category_guidance as string) ?? '',
    temperature: Number(row.temperature ?? DEFAULT_TEMPLATE.temperature),
    maxTokens: Number(row.max_tokens ?? DEFAULT_TEMPLATE.maxTokens),
    slots: arr(row.slots, DEFAULT_TEMPLATE.slots),
    sections: arr(row.sections, DEFAULT_TEMPLATE.sections),
    narrativeSections: arr(row.narrative_sections, DEFAULT_TEMPLATE.narrativeSections),
    sourcingRequirementSections: arr(
      row.sourcing_requirement_sections,
      DEFAULT_TEMPLATE.sourcingRequirementSections,
    ),
    defaultCriteria: arr(row.default_criteria, DEFAULT_TEMPLATE.defaultCriteria),
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
    const { data, error } = await getSupabaseAdmin()
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
