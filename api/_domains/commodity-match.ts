// Server endpoint for specific commodity/service-family suggestions.
// Persisted routing still validates the confirmed code against current policy.
//
// The codes are the categories' own (Admin → Categories), read from the store
// on every call — this handler used to rank a code table compiled into the
// bundle, so an admin's edit reached the browser fallback and not the server.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getNeonClient, isMissingRelation, type DbRow } from '../_neon.js';
import { resolveCommodityCandidates } from '../../src/lib/procurement/commodity-candidates.js';
import { codeBookFromCategories, commodityFieldsFromRow, EMPTY_CODE_BOOK, type CommodityCodeBook } from '../../src/lib/procurement/category-code.js';

async function loadCodeBook(): Promise<CommodityCodeBook> {
  const sql = getNeonClient();
  const rows = await sql.query(
    'SELECT id, active, commodity_codes, default_code, default_code_label FROM procurement_categories ORDER BY sort_order',
  ) as DbRow[];
  return codeBookFromCategories(rows.map((row) => ({
    id: String(row.id), active: row.active !== false, ...commodityFieldsFromRow(row),
  })));
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed', code: 'method_not_allowed' }); return; }
  const body = req.body as { text?: unknown; category?: unknown };
  if (typeof body?.text !== 'string' || !body.text.trim()) { res.status(400).json({ error: 'text is required', code: 'validation_error' }); return; }
  if (body.text.length > 5000) { res.status(400).json({ error: 'text is too long', code: 'validation_error' }); return; }
  const category = typeof body.category === 'string' ? body.category : undefined;

  let book: CommodityCodeBook;
  try {
    book = await loadCodeBook();
  } catch (error) {
    // One migration behind: no configured codes yet is an empty answer, not a
    // failure. Anything else is reported — the browser then ranks locally.
    if (isMissingRelation(error)) {
      book = EMPTY_CODE_BOOK;
    } else {
      console.error('[commodity-match] could not read category codes', error);
      res.status(503).json({ error: 'Commodity suggestions are temporarily unavailable.', code: 'unavailable' });
      return;
    }
  }
  res.status(200).json({ candidates: resolveCommodityCandidates(body.text, category, book) });
}
