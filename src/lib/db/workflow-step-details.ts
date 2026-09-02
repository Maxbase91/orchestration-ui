// Data access for workflow_step_details — the per-stage system/status/detail
// rows shown on a request's workflow tab. Keyed by (request_id, stage), so
// saves upsert on that composite key rather than a single id.
import { db } from '@/lib/db-client';
import type { WorkflowStepDetail } from '@/data/workflow-step-details';
import { mapDbToWorkflowStepDetail, mapWorkflowStepDetailToDb } from './mappers';

const TABLE = 'workflow_step_details';

export async function listWorkflowStepDetails(): Promise<WorkflowStepDetail[]> {
  const { data, error } = await db.from(TABLE).select('*').order('request_id');
  if (error) throw error;
  return (data ?? []).map(mapDbToWorkflowStepDetail);
}

export async function listStepDetailsForRequest(requestId: string): Promise<WorkflowStepDetail[]> {
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .eq('request_id', requestId);
  if (error) throw error;
  return (data ?? []).map(mapDbToWorkflowStepDetail);
}

export async function saveWorkflowStepDetail(record: WorkflowStepDetail): Promise<WorkflowStepDetail> {
  const { data, error } = await db
    .from(TABLE)
    .upsert(mapWorkflowStepDetailToDb(record), { onConflict: 'request_id,stage' })
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToWorkflowStepDetail(data);
}

export async function deleteWorkflowStepDetail(requestId: string, stage: string): Promise<void> {
  const { error } = await db
    .from(TABLE)
    .delete()
    .eq('request_id', requestId)
    .eq('stage', stage);
  if (error) throw error;
}
