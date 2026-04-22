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
import { notifications } from '../../src/data/notifications.js';
import { complianceReports } from '../../src/data/compliance-reports.js';
import { systemIntegrations } from '../../src/data/system-integrations.js';
import { formSubmissions } from '../../src/data/form-submissions.js';
import { formTemplates } from '../../src/data/form-templates.js';
import { intakeComplianceRecords } from '../../src/data/request-compliance.js';

import {
  mapRequestToDb,
  mapSupplierToDb,
  mapContractToDb,
  mapPurchaseOrderToDb,
  mapInvoiceToDb,
  mapApprovalToDb,
  mapRiskAssessmentToDb,
  mapCommentToDb,
  mapNotificationToDb,
  mapComplianceReportToDb,
  mapSystemIntegrationToDb,
  mapFormSubmissionToDb,
  mapFormTemplateToDb,
  mapIntakeComplianceToDb,
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

    // 7. Stage history (FK to requests). Upsert by natural key (request_id, stage, entered_at).
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
      'request_id,stage,entered_at',
    );

    // 8. Comments (TEXT PK — mock CMT-xxx IDs).
    counts.comments = await upsert(
      'comments',
      comments.map((c) => ({
        id: c.id,
        ...mapCommentToDb({
          requestId: c.requestId,
          authorId: c.authorId,
          authorName: c.authorName,
          authorInitials: c.authorInitials,
          content: c.content,
          isInternal: c.isInternal,
        }),
        created_at: c.timestamp,
      })),
      'id',
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

    // 12. Notifications (no FKs, simple append).
    counts.notifications = await upsert(
      'notifications',
      notifications.map((n) => mapNotificationToDb(n)),
      'id',
    );

    // 13. Compliance reports (one per request). Keyed by request_id (UUID PK
    // is auto-generated, so upsert via request_id).
    counts.compliance_reports = await upsert(
      'compliance_reports',
      complianceReports.map((r) => mapComplianceReportToDb(r)),
      'request_id',
    );

    // 14. System integrations.
    counts.system_integrations = await upsert(
      'system_integrations',
      systemIntegrations.map((i) => mapSystemIntegrationToDb(i)),
      'id',
    );

    // 15. Form submissions.
    counts.form_submissions = await upsert(
      'form_submissions',
      formSubmissions.map((s) => mapFormSubmissionToDb({
        ...s,
        values: s.values,
      })),
      'id',
    );

    // 16. Form templates (admin-configurable dynamic forms).
    counts.form_templates = await upsert(
      'form_templates',
      formTemplates.map((t) => mapFormTemplateToDb(t)),
      'id',
    );

    // 17. Intake compliance records (keyed by request_id; matchingRiskAssessmentIds
    // is populated by the module-load backfill in src/data/request-compliance.ts).
    counts.intake_compliance_records = await upsert(
      'intake_compliance_records',
      intakeComplianceRecords.map((r) => mapIntakeComplianceToDb(r)),
      'request_id',
    );

    return res.status(201).json({ message: 'Seed complete', counts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Seed error:', message);
    return res.status(500).json({ error: message });
  }
}
