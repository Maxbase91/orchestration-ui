import { supabase } from '@/lib/supabase-client';
import type { IntakeComplianceRecord } from '@/data/request-compliance';
import { mapDbToIntakeCompliance, mapIntakeComplianceToDb } from './mappers';

const TABLE = 'intake_compliance_records';

export async function getIntakeCompliance(
  requestId: string,
): Promise<IntakeComplianceRecord | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('request_id', requestId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapDbToIntakeCompliance(data) : null;
}

export async function saveIntakeCompliance(
  record: IntakeComplianceRecord,
): Promise<IntakeComplianceRecord> {
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(mapIntakeComplianceToDb(record), { onConflict: 'request_id' })
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToIntakeCompliance(data);
}
