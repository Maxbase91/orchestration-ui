// Optional, privacy-preserving guidance from approved internal examples.
// Historical text is redacted and reduced to short field suggestions; raw
// requests are never returned to the browser.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getNeonClient } from '../../../api/_neon.js';
import type { IntakeGuidanceSuggestion } from '../../lib/procurement/intake-guidance-api.js';

const SECTIONS = new Set(['objective', 'scope', 'exclusions', 'deliverables', 'acceptanceCriteria', 'timeline', 'resources', 'dependencies', 'pricingModel', 'classification', 'route', 'details', 'review']);
const FIELD_MAP: Record<string, string> = {
  acceptanceCriteria: 'acceptance_criteria',
  pricingModel: 'pricing_model',
  // These are requester-facing journey moments rather than stored columns;
  // use a safe descriptive field for the optional historical hint query.
  classification: 'objective',
  route: 'scope',
  details: 'objective',
  review: 'acceptance_criteria',
};
function redact(value: unknown): string { return String(value ?? '').replace(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b/g, 'the supplier').replace(/\s+/g, ' ').trim().slice(0, 260); }

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed', code: 'method_not_allowed' }); return; }
  const body = req.body as { category?: unknown; section?: unknown; text?: unknown; commodityCode?: unknown };
  const section = typeof body?.section === 'string' ? body.section : '';
  if (!SECTIONS.has(section)) { res.status(400).json({ error: 'A valid description section is required.', code: 'validation_error' }); return; }
  const suggestions: IntakeGuidanceSuggestion[] = [];
  try {
    const sql = getNeonClient();
    const column = FIELD_MAP[section] ?? section;
    const rows = await sql.query(`SELECT sd.${column} AS value FROM service_descriptions sd JOIN requests r ON r.id = sd.request_id WHERE r.status IN ('completed','po','approval','validation') AND sd.${column} IS NOT NULL AND length(sd.${column}) > 20 ORDER BY r.updated_at DESC NULLS LAST LIMIT 8`);
    for (const row of rows as Array<Record<string, unknown>>) {
      const value = redact(row.value);
      if (!value || suggestions.some((item) => item.text === value)) continue;
      suggestions.push({ id: `similar-${suggestions.length + 1}`, text: value, sourceType: 'similar approved request', rationale: `Similar completed requests include concrete ${section.replace(/([A-Z])/g, ' $1').toLowerCase()} details.` });
      if (suggestions.length === 2) break;
    }
  } catch {
    // Static guidance keeps the requester moving during local/static mode.
  }
  if (suggestions.length === 0) {
    suggestions.push({ id: 'template-1', text: `State the specific ${section.replace(/([A-Z])/g, ' $1').toLowerCase()}, who owns it, and what a reviewer can verify.`, sourceType: 'configured template', rationale: 'Configured guidance keeps the description actionable without inventing business facts.' });
  }
  res.status(200).json({ suggestions });
}
