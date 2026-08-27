// Data access for service_descriptions (the SOW captured during intake), one
// row per request. Reads flow through use-service-description.ts hooks.
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
    // Undefined fields are omitted rather than written as null: a save from a
    // path that never generated (e.g. a contract call-off) must not blank the
    // quality gate on an existing row.
    ...(sow.qualityScore != null ? { quality_score: sow.qualityScore } : {}),
    ...(sow.qualityChecks ? { quality_checks: sow.qualityChecks } : {}),
    ...(sow.signals ? { signals: sow.signals } : {}),
    ...(sow.requiredSections ? { required_sections: sow.requiredSections } : {}),
  };
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: 'request_id' })
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToServiceDescription(data);
}
