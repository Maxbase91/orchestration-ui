import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin, requireAdminSecret } from '../_supabase-admin.js';

// Import mock data by relative path (Vercel bundles the TS files).
import { users } from '../../src/data/users.js';
import { requests } from '../../src/data/requests.js';
import { stageHistory } from '../../src/data/stage-history.js';
import { comments } from '../../src/data/comments.js';
import { serviceDescriptions } from '../../src/data/service-descriptions.js';
import { suppliers } from '../../src/data/suppliers.js';
import { contracts } from '../../src/data/contracts.js';
import { purchaseOrders } from '../../src/data/purchase-orders.js';
import { invoices } from '../../src/data/invoices.js';
import { approvalEntries } from '../../src/data/approval-entries.js';
import { riskAssessments } from '../../src/data/risk-assessments.js';

import {
  mapRequestToDb,
  mapSupplierToDb,
  mapContractToDb,
  mapPurchaseOrderToDb,
  mapInvoiceToDb,
  mapApprovalToDb,
  mapRiskAssessmentToDb,
  mapCommentToDb,
} from '../../src/lib/db/mappers.js';

type DbRow = Record<string, unknown>;

function chunks<T>(arr: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function upsert(table: string, rows: DbRow[], conflict?: string): Promise<number> {
  if (rows.length === 0) return 0;
  let total = 0;
  for (const batch of chunks(rows)) {
    const q = supabaseAdmin.from(table).upsert(batch, conflict ? { onConflict: conflict } : undefined);
    const { error, count } = await q.select('*', { count: 'exact', head: true });
    if (error) throw new Error(`${table}: ${error.message}`);
    total += count ?? batch.length;
  }
  return total;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!requireAdminSecret(req.headers['x-admin-secret'])) {
    return res.status(401).json({ error: 'Unauthorized: missing or invalid x-admin-secret header' });
  }

  try {
    const counts: Record<string, number> = {};

    // 1. Users (no FK dependencies).
    counts.users = await upsert(
      'users',
      users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        department: u.department,
        initials: u.initials,
        is_ooo: u.isOOO,
        delegate_id: u.delegateId ?? null,
      })),
      'id',
    );

    // 2. Suppliers (needed before contracts/POs/invoices/risk_assessments).
    counts.suppliers = await upsert(
      'suppliers',
      suppliers.map((s) => mapSupplierToDb(s)),
      'id',
    );

    // 3. Requests (FK to users).
    counts.requests = await upsert(
      'requests',
      requests.map((r) => mapRequestToDb(r)),
      'id',
    );

    // 4. Contracts (FK to suppliers).
    counts.contracts = await upsert(
      'contracts',
      contracts.map((c) => mapContractToDb(c)),
      'id',
    );

    // 5. Purchase orders (FK to suppliers, contracts, requests).
    counts.purchase_orders = await upsert(
      'purchase_orders',
      purchaseOrders.map((p) => mapPurchaseOrderToDb(p)),
      'id',
    );

    // 6. Invoices (FK to suppliers, purchase_orders).
    counts.invoices = await upsert(
      'invoices',
      invoices.map((i) => mapInvoiceToDb(i)),
      'id',
    );

    // 7. Stage history (FK to requests). UUID PK; upsert by (request_id, stage).
    counts.stage_history = await upsert(
      'stage_history',
      stageHistory.map((s) => ({
        request_id: s.requestId,
        stage: s.stage,
        entered_at: s.enteredAt,
        completed_at: s.completedAt ?? null,
        owner_id: s.ownerId,
        action: s.action ?? null,
        notes: s.notes ?? null,
      })),
    );

    // 8. Comments (FK to requests). UUID PK; seed is inherently insert-once.
    counts.comments = await upsert(
      'comments',
      comments.map((c) =>
        mapCommentToDb({
          requestId: c.requestId,
          authorId: c.authorId,
          authorName: c.authorName,
          authorInitials: c.authorInitials,
          content: c.content,
          isInternal: c.isInternal,
        }),
      ),
    );

    // 9. Service descriptions (FK+UNIQUE to requests).
    counts.service_descriptions = await upsert(
      'service_descriptions',
      serviceDescriptions.map((s) => ({
        request_id: s.requestId,
        objective: s.objective,
        scope: s.scope,
        deliverables: s.deliverables,
        timeline: s.timeline,
        resources: s.resources,
        acceptance_criteria: s.acceptanceCriteria,
        pricing_model: s.pricingModel,
        location: s.location,
        dependencies: s.dependencies,
        narrative: s.narrative,
      })),
      'request_id',
    );

    // 10. Approval entries (FK to requests, users).
    counts.approval_entries = await upsert(
      'approval_entries',
      approvalEntries.map((a) => mapApprovalToDb(a)),
      'id',
    );

    // 11. Risk assessments (FK to suppliers, contracts).
    counts.risk_assessments = await upsert(
      'risk_assessments',
      riskAssessments.map((r) => mapRiskAssessmentToDb(r)),
      'id',
    );

    return res.status(201).json({ message: 'Seed complete', counts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Seed error:', message);
    return res.status(500).json({ error: message });
  }
}
