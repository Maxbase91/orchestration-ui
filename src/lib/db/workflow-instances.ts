import { supabase } from '@/lib/supabase-client';

export interface WorkflowInstance {
  id: string;
  requestId: string;
  templateId: string;
  currentNodeIds: string[];
  status: 'running' | 'suspended' | 'completed' | 'error';
  variables: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const TABLE = 'workflow_instances';

function mapDbToInstance(row: Record<string, unknown>): WorkflowInstance {
  return {
    id: row.id as string,
    requestId: row.request_id as string,
    templateId: row.template_id as string,
    currentNodeIds: (row.current_node_ids as string[]) ?? [],
    status: (row.status as WorkflowInstance['status']) ?? 'running',
    variables: (row.variables as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function createWorkflowInstance(
  requestId: string,
  templateId: string,
  currentNodeIds: string[],
  variables: Record<string, unknown> = {},
): Promise<WorkflowInstance> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ request_id: requestId, template_id: templateId, current_node_ids: currentNodeIds, variables })
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToInstance(data);
}

export async function getWorkflowInstanceForRequest(requestId: string): Promise<WorkflowInstance | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapDbToInstance(data) : null;
}

export async function updateWorkflowInstance(
  id: string,
  patch: Partial<Pick<WorkflowInstance, 'currentNodeIds' | 'status' | 'variables'>>,
): Promise<WorkflowInstance> {
  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.currentNodeIds !== undefined) dbPatch.current_node_ids = patch.currentNodeIds;
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.variables !== undefined) dbPatch.variables = patch.variables;

  const { data, error } = await supabase
    .from(TABLE)
    .update(dbPatch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToInstance(data);
}
