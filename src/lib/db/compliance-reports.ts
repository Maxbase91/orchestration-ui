// Data access for the `compliance_reports` table (per-request compliance
// snapshots). Upserts key on request_id — one report per request, saving
// replaces the previous snapshot.
import { supabase } from '@/lib/supabase-client';
import type { ComplianceReport } from '@/data/compliance-reports';
import { complianceReports as seedReports } from '@/data/compliance-reports';
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
  if (data) return mapDbToComplianceReport(data);
  // Fall back to bundled seed data so demo requests that were never saved to
  // the DB still show a compliance tab.
  return seedReports.find((r) => r.requestId === requestId) ?? null;
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
