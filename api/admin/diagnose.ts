// Diagnostic endpoint — imports the seed module and returns detailed
// information about module-load errors or missing env vars.

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const result: Record<string, unknown> = {
    env: {
      SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      SUPABASE_ANON_KEY: Boolean(process.env.SUPABASE_ANON_KEY),
      ADMIN_SEED_SECRET: Boolean(process.env.ADMIN_SEED_SECRET),
    },
    imports: {} as Record<string, string>,
  };

  // Dynamically import each data module individually and record which one fails.
  const modules: [string, () => Promise<unknown>][] = [
    ['users', () => import('../../src/data/users.js')],
    ['requests', () => import('../../src/data/requests.js')],
    ['suppliers', () => import('../../src/data/suppliers.js')],
    ['contracts', () => import('../../src/data/contracts.js')],
    ['purchase-orders', () => import('../../src/data/purchase-orders.js')],
    ['invoices', () => import('../../src/data/invoices.js')],
    ['approval-entries', () => import('../../src/data/approval-entries.js')],
    ['risk-assessments', () => import('../../src/data/risk-assessments.js')],
    ['comments', () => import('../../src/data/comments.js')],
    ['stage-history', () => import('../../src/data/stage-history.js')],
    ['service-descriptions', () => import('../../src/data/service-descriptions.js')],
    ['notifications', () => import('../../src/data/notifications.js')],
    ['compliance-reports', () => import('../../src/data/compliance-reports.js')],
    ['system-integrations', () => import('../../src/data/system-integrations.js')],
    ['form-submissions', () => import('../../src/data/form-submissions.js')],
    ['form-templates', () => import('../../src/data/form-templates.js')],
    ['request-compliance', () => import('../../src/data/request-compliance.js')],
    ['mappers', () => import('../../src/lib/db/mappers.js')],
    ['supabase-admin', () => import('../_supabase-admin.js')],
  ];

  for (const [name, loader] of modules) {
    try {
      await loader();
      (result.imports as Record<string, string>)[name] = 'ok';
    } catch (e) {
      const msg = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
      (result.imports as Record<string, string>)[name] = `FAILED: ${msg}`;
    }
  }

  return res.status(200).json(result);
}
