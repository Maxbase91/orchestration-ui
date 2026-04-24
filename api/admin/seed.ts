import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin, requireAdminSecret } from '../_supabase-admin.js';

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

  const counts: Record<string, number> = {};

  try {
    // Dynamic imports so a failure in any single data file surfaces at
    // runtime (with a stack), not at module-load time.
    const [
      { users },
      { requests },
      { stageHistory },
      { comments },
      { serviceDescriptions },
      { suppliers },
      { contracts },
      { purchaseOrders },
      { invoices },
      { approvalEntries },
      { riskAssessments },
      { notifications },
      { complianceReports },
      { systemIntegrations },
      { formSubmissions },
      { formTemplates },
      { intakeComplianceRecords },
      { aiAgents },
      { kpiData },
      { workflowTemplates },
      { routingRules },
      { catalogueItems },
      { workflowStepDetails },
      { extraRequests, extraStageHistory, extraInvoices, extraComments, extraApprovals },
      mappers,
    ] = await Promise.all([
      import('../../src/data/users.js'),
      import('../../src/data/requests.js'),
      import('../../src/data/stage-history.js'),
      import('../../src/data/comments.js'),
      import('../../src/data/service-descriptions.js'),
      import('../../src/data/suppliers.js'),
      import('../../src/data/contracts.js'),
      import('../../src/data/purchase-orders.js'),
      import('../../src/data/invoices.js'),
      import('../../src/data/approval-entries.js'),
      import('../../src/data/risk-assessments.js'),
      import('../../src/data/notifications.js'),
      import('../../src/data/compliance-reports.js'),
      import('../../src/data/system-integrations.js'),
      import('../../src/data/form-submissions.js'),
      import('../../src/data/form-templates.js'),
      import('../../src/data/request-compliance.js'),
      import('../../src/data/ai-agents.js'),
      import('../../src/data/kpi-data.js'),
      import('../../src/data/workflows.js'),
      import('../../src/data/routing-rules.js'),
      import('../../src/data/catalogue-items.js'),
      import('../../src/data/workflow-step-details.js'),
      import('../../src/data/demo-expansion.js'),
      import('../../src/lib/db/mappers.js'),
    ]);

    // Merge the extras in. Supabase upserts by id, so re-runs are
    // idempotent.
    const requestsAll    = [...requests,       ...extraRequests];
    const stageHistoryAll= [...stageHistory,   ...extraStageHistory];
    const invoicesAll    = [...invoices,       ...extraInvoices];
    const commentsAll    = [...comments,       ...extraComments];
    const approvalsAll   = [...approvalEntries,...extraApprovals];

    const {
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
      mapAiAgentToDb,
      mapKpiToDb,
      mapWorkflowTemplateToDb,
      mapRoutingRuleToDb,
      mapCatalogueItemToDb,
      mapWorkflowStepDetailToDb,
    } = mappers;

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

    // 2. Suppliers.
    counts.suppliers = await upsert(
      'suppliers',
      suppliers.map((s) => mapSupplierToDb(s)),
      'id',
    );

    // 3. Requests (FK to users).
    counts.requests = await upsert(
      'requests',
      requestsAll.map((r) => mapRequestToDb(r)),
      'id',
    );

    // 4. Contracts (FK to suppliers).
    counts.contracts = await upsert(
      'contracts',
      contracts.map((c) => mapContractToDb(c)),
      'id',
    );

    // 5. Purchase orders.
    counts.purchase_orders = await upsert(
      'purchase_orders',
      purchaseOrders.map((p) => mapPurchaseOrderToDb(p)),
      'id',
    );

    // 6. Invoices.
    counts.invoices = await upsert(
      'invoices',
      invoicesAll.map((i) => mapInvoiceToDb(i)),
      'id',
    );

    // 7. Stage history (natural composite key).
    counts.stage_history = await upsert(
      'stage_history',
      stageHistoryAll.map((s) => ({
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

    // 8. Comments.
    counts.comments = await upsert(
      'comments',
      commentsAll.map((c) => ({
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

    // 9. Service descriptions.
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

    // 10. Approval entries.
    counts.approval_entries = await upsert(
      'approval_entries',
      approvalsAll.map((a) => mapApprovalToDb(a)),
      'id',
    );

    // 11. Risk assessments.
    counts.risk_assessments = await upsert(
      'risk_assessments',
      riskAssessments.map((r) => mapRiskAssessmentToDb(r)),
      'id',
    );

    // 12. Notifications.
    counts.notifications = await upsert(
      'notifications',
      notifications.map((n) => mapNotificationToDb(n)),
      'id',
    );

    // 13. Compliance reports.
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
      formSubmissions.map((s) => mapFormSubmissionToDb({ ...s, values: s.values })),
      'id',
    );

    // 16. Form templates.
    counts.form_templates = await upsert(
      'form_templates',
      formTemplates.map((t) => mapFormTemplateToDb(t)),
      'id',
    );

    // 17. Intake compliance records (back-fill matchingRiskAssessmentIds
    // from riskAssessments.linkedRequestIds right before insert).
    const intakeWithMatches = intakeComplianceRecords.map((r) => {
      if (r.matchingRiskAssessmentIds && r.matchingRiskAssessmentIds.length > 0) return r;
      const matches = riskAssessments
        .filter((ra) => ra.reusable && ra.status === 'completed' && ra.linkedRequestIds.includes(r.requestId))
        .map((ra) => ra.id);
      return matches.length > 0 ? { ...r, matchingRiskAssessmentIds: matches } : r;
    });
    counts.intake_compliance_records = await upsert(
      'intake_compliance_records',
      intakeWithMatches.map((r) => mapIntakeComplianceToDb(r)),
      'request_id',
    );

    // 18. AI agents.
    counts.ai_agents = await upsert(
      'ai_agents',
      aiAgents.map((a) => mapAiAgentToDb(a)),
      'id',
    );

    // 19. KPI data (monthly snapshots).
    counts.kpi_data = await upsert(
      'kpi_data',
      kpiData.map((k) => mapKpiToDb(k)),
      'month',
    );

    // 20. Workflow templates (node/edge graphs).
    counts.workflow_templates = await upsert(
      'workflow_templates',
      workflowTemplates.map((w) => mapWorkflowTemplateToDb(w)),
      'id',
    );

    // 21. Routing rules.
    counts.routing_rules = await upsert(
      'routing_rules',
      routingRules.map((r) => mapRoutingRuleToDb(r)),
      'id',
    );

    // 22. Catalogue items.
    counts.catalogue_items = await upsert(
      'catalogue_items',
      catalogueItems.map((c) => mapCatalogueItemToDb(c)),
      'id',
    );

    // 23. Workflow step details (FK to requests).
    counts.workflow_step_details = await upsert(
      'workflow_step_details',
      workflowStepDetails.map((d) => mapWorkflowStepDetailToDb(d)),
      'request_id,stage',
    );

    return res.status(201).json({ message: 'Seed complete', counts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('Seed failed:', message, stack);
    return res.status(500).json({ error: message, stack, counts });
  }
}
