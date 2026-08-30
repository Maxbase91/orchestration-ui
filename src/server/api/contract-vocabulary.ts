// Controlled vocabulary endpoint for contract service families and deliverable
// terms. It is intentionally narrow; no generic table administration is exposed.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getNeonClient } from '../../../api/_neon.js';
type Row = Record<string, unknown>;
const isRecord = (v: unknown): v is Row => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const text = (v: unknown) => typeof v === 'string' ? v.trim() : '';
const list = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === 'string') ? v : [];
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const sql = getNeonClient();
    if (req.method === 'GET') {
      const [families, deliverables] = await Promise.all([
        sql.query('SELECT id,label,aliases,active FROM procurement_service_families WHERE active = true ORDER BY label'),
        sql.query('SELECT id,service_family_id,label,aliases,active FROM procurement_deliverable_terms WHERE active = true ORDER BY label'),
      ]);
      res.status(200).json({ families, deliverables });
      return;
    }
    if (req.method !== 'POST' || !isRecord(req.body) || !text(req.body.id) || !text(req.body.label)) { res.status(400).json({ error: 'id and label are required.', code: 'validation_error' }); return; }
    const body = req.body;
    const table = body.kind === 'deliverable' ? 'procurement_deliverable_terms' : 'procurement_service_families';
    if (table === 'procurement_deliverable_terms') {
      await sql.query('INSERT INTO procurement_deliverable_terms (id, service_family_id, label, aliases) VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT (id) DO UPDATE SET service_family_id=EXCLUDED.service_family_id,label=EXCLUDED.label,aliases=EXCLUDED.aliases,active=true,updated_at=now()', [text(body.id), text(body.serviceFamilyId) || null, text(body.label), JSON.stringify(list(body.aliases))]);
    } else {
      await sql.query('INSERT INTO procurement_service_families (id,label,aliases) VALUES ($1,$2,$3::jsonb) ON CONFLICT (id) DO UPDATE SET label=EXCLUDED.label,aliases=EXCLUDED.aliases,active=true,updated_at=now()', [text(body.id), text(body.label), JSON.stringify(list(body.aliases))]);
    }
    res.status(200).json({ saved: true, id: text(body.id) });
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : 'Vocabulary is unavailable.', code: 'vocabulary_unavailable' }); }
}
