import { db } from '@/lib/db-client';
import type { RiskAssessment } from '@/data/types';
import { mapDbToRiskAssessment, mapRiskAssessmentToDb } from './mappers';
import { getRiskAssessmentWith, listRiskAssessmentsWith } from './risk-assessments-core';

const TABLE = 'risk_assessments';

// Reads go through risk-assessments-core.ts, the query the server's risk port
// runs. The assessments a demand can reuse are read through that port too
// (lib/integrations/reusable-assessments.ts), not from here.
export async function listRiskAssessments(): Promise<RiskAssessment[]> {
  return listRiskAssessmentsWith(db);
}

export async function getRiskAssessment(id: string): Promise<RiskAssessment | null> {
  return getRiskAssessmentWith(db, id);
}

export async function createRiskAssessment(record: RiskAssessment): Promise<RiskAssessment> {
  const { data, error } = await db
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
  const { data, error } = await db
    .from(TABLE)
    .update(mapRiskAssessmentToDb(patch))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToRiskAssessment(data);
}

export async function deleteRiskAssessment(id: string): Promise<void> {
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
