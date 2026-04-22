import { supabase } from '@/lib/supabase-client';
import type { FormSubmission } from '@/data/form-submissions';
import { mapDbToFormSubmission, mapFormSubmissionToDb } from './mappers';

const TABLE = 'form_submissions';

export async function listFormSubmissions(): Promise<FormSubmission[]> {
  const { data, error } = await supabase.from(TABLE).select('*');
  if (error) throw error;
  return (data ?? []).map(mapDbToFormSubmission);
}

export async function listSubmissionsByRequest(requestId: string): Promise<FormSubmission[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('request_id', requestId)
    .order('submitted_at');
  if (error) throw error;
  return (data ?? []).map(mapDbToFormSubmission);
}

export async function createFormSubmission(record: FormSubmission): Promise<FormSubmission> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(mapFormSubmissionToDb(record))
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToFormSubmission(data);
}
