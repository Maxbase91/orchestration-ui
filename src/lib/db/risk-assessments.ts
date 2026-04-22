import { supabase } from '@/lib/supabase-client';
import type { RiskAssessment } from '@/data/types';
import { mapDbToRiskAssessment, mapRiskAssessmentToDb } from './mappers';

const TABLE = 'risk_assessments';

export async function listRiskAssessments(): Promise<RiskAssessment[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('assessed_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapDbToRiskAssessment);
}

export async function getRiskAssessment(id: string): Promise<RiskAssessment | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapDbToRiskAssessment(data) : null;
}

export async function createRiskAssessment(record: RiskAssessment): Promise<RiskAssessment> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(mapRiskAssessmentToDb(record))
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToRiskAssessment(data);
}

export async function updateRiskAssessment(
  id: string,
  patch: Partial<RiskAssessment>,
): Promise<RiskAssessment> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(mapRiskAssessmentToDb(patch))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToRiskAssessment(data);
}

export async function deleteRiskAssessment(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

/**
 * Used by intake validation to surface reusable risk assessments that already
 * cover a supplier or contract. Matches the original synchronous helper in
 * src/data/risk-assessments.ts but backed by Supabase.
 */
export async function findMatchingRiskAssessments(params: {
  supplierId?: string;
  contractId?: string;
  now?: Date;
}): Promise<RiskAssessment[]> {
  const { supplierId, contractId, now = new Date() } = params;
  if (!supplierId && !contractId) return [];

  let query = supabase
    .from(TABLE)
    .select('*')
    .eq('reusable', true)
    .eq('status', 'completed')
    .gt('valid_until', now.toISOString().slice(0, 10));

  if (supplierId && contractId) {
    query = query.or(`supplier_id.eq.${supplierId},contract_id.eq.${contractId}`);
  } else if (supplierId) {
    query = query.eq('supplier_id', supplierId);
  } else if (contractId) {
    query = query.eq('contract_id', contractId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapDbToRiskAssessment);
}
