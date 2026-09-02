import { db } from '@/lib/db-client';
import type { FormTemplate } from '@/data/form-templates';
import { mapDbToFormTemplate, mapFormTemplateToDb } from './mappers';

const TABLE = 'form_templates';

export async function listFormTemplates(): Promise<FormTemplate[]> {
  const { data, error } = await db.from(TABLE).select('*').order('id');
  if (error) throw error;
  return (data ?? []).map(mapDbToFormTemplate);
}

export async function getFormTemplate(id: string): Promise<FormTemplate | null> {
  const { data, error } = await db.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapDbToFormTemplate(data) : null;
}

export async function saveFormTemplate(record: FormTemplate): Promise<FormTemplate> {
  const { data, error } = await db
    .from(TABLE)
    .upsert(mapFormTemplateToDb(record), { onConflict: 'id' })
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToFormTemplate(data);
}

export async function deleteFormTemplate(id: string): Promise<void> {
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
