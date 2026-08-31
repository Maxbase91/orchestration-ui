// Read-only Neon connectivity diagnostics routed through the existing API
// dispatcher. It reports safe failure classes without exposing credentials.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getNeonClient, NeonConfigurationError } from '../../../api/_neon.js';

function classify(error: unknown): string {
  if (error instanceof NeonConfigurationError) return 'configuration';
  const message = error instanceof Error ? error.message : String(error);
  if (/ENOTFOUND|EAI_AGAIN|NXDOMAIN|getaddrinfo/i.test(message)) return 'dns';
  if (/certificate|TLS|SSL|secure connection/i.test(message)) return 'tls';
  if (/password|authentication|28P01|unauthorized/i.test(message)) return 'authentication';
  if (/does not exist|undefined table|relation .* missing/i.test(message)) return 'schema';
  return 'connection';
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed', code: 'method_not_allowed' }); return; }
  try {
    const sql = getNeonClient();
    await sql.query('SELECT 1 AS ok');
    const rows = await sql.query(
      `SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public'`,
    ) as Array<{ count?: number }>;
    res.status(200).json({ ok: true, database: 'neon', publicTableCount: rows[0]?.count ?? 0 });
  } catch (error) {
    const kind = classify(error);
    res.status(kind === 'configuration' ? 503 : 502).json({
      ok: false,
      database: 'neon',
      error: 'Neon connectivity check failed.',
      code: `neon_${kind}`,
    });
  }
}
