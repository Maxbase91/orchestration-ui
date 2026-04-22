import { supabase } from '@/lib/supabase-client';
import type { ComplianceReport } from '@/data/compliance-reports';
import { mapDbToComplianceReport, mapComplianceReportToDb } from './mappers';

const TABLE = 'compliance_reports';

export async function listComplianceReports(): Promise<ComplianceReport[]> {
  const { data, error } = await supabase.from(TABLE).select('*');
  if (error) throw error;
  return (data ?? []).map(mapDbToComplianceReport);
}

export async function getComplianceReportByRequest(
  requestId: string,
): Promise<ComplianceReport | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('request_id', requestId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapDbToComplianceReport(data) : null;
}

export async function saveComplianceReport(
  report: ComplianceReport,
): Promise<ComplianceReport> {
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(mapComplianceReportToDb(report), { onConflict: 'request_id' })
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToComplianceReport(data);
}
