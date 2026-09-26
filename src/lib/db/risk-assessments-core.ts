// Reading the risk register with a given client, so the risk-assessment port
// answers in the browser and on the server with one query and one mapping.
// risk-assessments.ts and the own-store connector both read through here.
// Relative '.js' specifiers only: api/ imports this.
import type { NeonCompatibleClient } from '../neon-compatible-client.js';
import type { RiskAssessment } from '../../data/types.js';
import { mapDbToRiskAssessment } from './mappers.js';

const TABLE = 'risk_assessments';

/** Most recently assessed first — the order reuse takes its first match in. */
export async function listRiskAssessmentsWith(client: NeonCompatibleClient): Promise<RiskAssessment[]> {
  const { data, error } = await client.from(TABLE).select('*').order('assessed_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapDbToRiskAssessment);
}

export async function getRiskAssessmentWith(client: NeonCompatibleClient, id: string): Promise<RiskAssessment | null> {
  const { data, error } = await client.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapDbToRiskAssessment(data) : null;
}
