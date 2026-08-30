// Server-owned procurement policy configuration. This endpoint is deliberately
// domain-specific so checkout and browser previews read the same Neon row.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getNeonClient } from '../../../api/_neon.js';
import { DEFAULT_POLICY_CONFIG, resolvePolicyConfig, type PolicyConfig } from '../../lib/procurement/policy-config.js';

const KEYS: (keyof PolicyConfig)[] = [
  'catalogueAutoApprovalThreshold', 'approvalFullThreshold', 'materialityValueThreshold',
  'criticalServiceThreshold', 'continuityThreshold', 'riskHighValue', 'riskMediumValue',
  'competitiveSourcingThreshold', 'minCompetitiveQuotes', 'preferredMinPerformance',
  'contractUtilisationHeadroom', 'contractExpiryBufferDays', 'delegatedAuthorityThreshold',
  'catalogueMatchThreshold', 'catalogueMinContentMatches', 'pCardEnabled', 'pCardMaxValue',
  'pCardEligibleCategories', 'pCardExcludedCategories',
];

function isPolicyConfig(value: unknown): value is PolicyConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  for (const key of KEYS) if (!(key in candidate)) return false;
  const numeric = KEYS.filter((key) => key !== 'pCardEnabled' && key !== 'pCardEligibleCategories' && key !== 'pCardExcludedCategories');
  if (numeric.some((key) => typeof candidate[key] !== 'number' || !Number.isFinite(candidate[key]) || (candidate[key] as number) < 0)) return false;
  if (typeof candidate.pCardEnabled !== 'boolean' || typeof candidate.pCardMaxValue !== 'number') return false;
  if (!Array.isArray(candidate.pCardEligibleCategories) || !Array.isArray(candidate.pCardExcludedCategories)) return false;
  if (typeof candidate.minCompetitiveQuotes !== 'number' || typeof candidate.catalogueMinContentMatches !== 'number' || candidate.minCompetitiveQuotes < 1 || candidate.catalogueMinContentMatches < 1) return false;
  if (typeof candidate.contractUtilisationHeadroom !== 'number' || typeof candidate.preferredMinPerformance !== 'number' || candidate.contractUtilisationHeadroom > 100 || candidate.preferredMinPerformance > 100) return false;
  return [...candidate.pCardEligibleCategories, ...candidate.pCardExcludedCategories].every((item) => typeof item === 'string' && item.length > 0);
}

function cleanError(error: unknown): string {
  return error instanceof Error ? error.message : 'Policy configuration request failed.';
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const sql = getNeonClient();
    if (req.method === 'GET') {
      const rows = await sql.query('SELECT config, updated_by, created_at, updated_at FROM procurement_policy_configs WHERE singleton_key = $1', ['default']) as unknown as Array<Record<string, unknown>>;
      const config = rows[0]?.config && isPolicyConfig(rows[0].config) ? rows[0].config : DEFAULT_POLICY_CONFIG;
      res.status(200).json({ config, updatedBy: rows[0]?.updated_by ?? null, updatedAt: rows[0]?.updated_at ?? null });
      return;
    }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed', code: 'method_not_allowed' }); return; }
    const body = req.body as { action?: string; config?: unknown; updatedBy?: unknown } | undefined;
    if (body?.action === 'reset') {
      const rows = await sql.query(
        `INSERT INTO procurement_policy_configs (singleton_key, config, updated_by)
         VALUES ('default', $1::jsonb, $2)
         ON CONFLICT (singleton_key) DO UPDATE SET config = EXCLUDED.config, updated_by = EXCLUDED.updated_by, updated_at = now()
         RETURNING config, updated_by, updated_at`,
        [JSON.stringify(DEFAULT_POLICY_CONFIG), typeof body.updatedBy === 'string' ? body.updatedBy : null],
      ) as unknown as Array<Record<string, unknown>>;
      res.status(200).json({ config: rows[0].config, updatedBy: rows[0].updated_by, updatedAt: rows[0].updated_at });
      return;
    }
    if (!isPolicyConfig(body?.config)) { res.status(400).json({ error: 'Invalid policy configuration.', code: 'invalid_policy_config' }); return; }
    const rows = await sql.query(
      `INSERT INTO procurement_policy_configs (singleton_key, config, updated_by)
       VALUES ('default', $1::jsonb, $2)
       ON CONFLICT (singleton_key) DO UPDATE SET config = EXCLUDED.config, updated_by = EXCLUDED.updated_by, updated_at = now()
       RETURNING config, updated_by, updated_at`,
      [JSON.stringify(resolvePolicyConfig(body.config)), typeof body.updatedBy === 'string' ? body.updatedBy : null],
    ) as unknown as Array<Record<string, unknown>>;
    res.status(200).json({ config: rows[0].config, updatedBy: rows[0].updated_by, updatedAt: rows[0].updated_at });
  } catch (error) {
    console.error('[policy-config]', cleanError(error));
    res.status(500).json({ error: 'Policy configuration is unavailable.', code: 'policy_config_unavailable' });
  }
}
