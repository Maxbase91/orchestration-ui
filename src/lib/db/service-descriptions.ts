import { supabase } from '@/lib/supabase-client';
import { mapDbToServiceDescription, type ServiceDescriptionRecord } from './mappers';

const TABLE = 'service_descriptions';

export async function getServiceDescription(
  requestId: string,
): Promise<ServiceDescriptionRecord | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('request_id', requestId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapDbToServiceDescription(data) : null;
}

export async function saveServiceDescription(
  requestId: string,
  sow: Omit<ServiceDescriptionRecord, 'requestId'>,
): Promise<ServiceDescriptionRecord> {
  const payload = {
    request_id: requestId,
    objective: sow.objective,
    scope: sow.scope,
    deliverables: sow.deliverables,
    timeline: sow.timeline,
    resources: sow.resources,
    acceptance_criteria: sow.acceptanceCriteria,
    pricing_model: sow.pricingModel,
    location: sow.location,
    dependencies: sow.dependencies,
    narrative: sow.narrative,
  };
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: 'request_id' })
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToServiceDescription(data);
}
