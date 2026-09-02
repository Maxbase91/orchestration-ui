import { db } from '@/lib/db-client';
import type { IntakeComplianceRecord } from '@/data/request-compliance';
import { mapDbToIntakeCompliance, mapIntakeComplianceToDb } from './mappers';

const TABLE = 'intake_compliance_records';

export async function getIntakeCompliance(
  requestId: string,
): Promise<IntakeComplianceRecord | null> {
  const { data, error } = await db
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
  const { data, error } = await db
    .from(TABLE)
    .upsert(mapIntakeComplianceToDb(record), { onConflict: 'request_id' })
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToIntakeCompliance(data);
}
