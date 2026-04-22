import { supabase } from '@/lib/supabase-client';
import type { WorkflowTemplate } from '@/data/types';
import { mapDbToWorkflowTemplate, mapWorkflowTemplateToDb } from './mappers';

const TABLE = 'workflow_templates';

export async function listWorkflowTemplates(): Promise<WorkflowTemplate[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('name');
  if (error) throw error;
  return (data ?? []).map(mapDbToWorkflowTemplate);
}

export async function getWorkflowTemplate(id: string): Promise<WorkflowTemplate | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapDbToWorkflowTemplate(data) : null;
}

export async function saveWorkflowTemplate(record: WorkflowTemplate): Promise<WorkflowTemplate> {
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(mapWorkflowTemplateToDb(record), { onConflict: 'id' })
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToWorkflowTemplate(data);
}

export async function deleteWorkflowTemplate(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
