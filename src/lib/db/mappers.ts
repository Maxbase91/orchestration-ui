// Relative imports (not @/data/*) so this module is also usable from
// server-side Vercel functions where the `@/` alias is not configured.
import type {
  ProcurementRequest,
  Comment,
  Supplier,
  Contract,
  PurchaseOrder,
  Invoice,
  ApprovalEntry,
  RiskAssessment,
  StageHistoryEntry,
  User,
  Notification,
} from '../../data/types';
import type { ComplianceReport } from '../../data/compliance-reports';
import type { SystemIntegration } from '../../data/system-integrations';
import type { FormSubmission } from '../../data/form-submissions';
import type { FormTemplate } from '../../data/form-templates';
import type { IntakeComplianceRecord } from '../../data/request-compliance';

type DbRecord = Record<string, unknown>;

// ── Compliance Reports ──────────────────────────────────────────────

export function mapDbToComplianceReport(row: DbRecord): ComplianceReport {
  return {
    requestId: (row.request_id ?? row.requestId ?? '') as string,
    agentId: (row.agent_id ?? row.agentId ?? '') as string,
    agentName: (row.agent_name ?? row.agentName ?? '') as string,
    decision: (row.decision ?? 'needs-review') as ComplianceReport['decision'],
    confidence: (row.confidence ?? 0) as number,
    generatedAt: (row.generated_at ?? row.generatedAt ?? '') as string,
    summary: (row.summary ?? '') as string,
    checks: (row.checks ?? []) as ComplianceReport['checks'],
    recommendation: (row.recommendation ?? '') as string,
  };
}

export function mapComplianceReportToDb(r: Partial<ComplianceReport>): DbRecord {
  const out: DbRecord = {};
  if (r.requestId !== undefined) out.request_id = r.requestId;
  if (r.agentId !== undefined) out.agent_id = r.agentId;
  if (r.agentName !== undefined) out.agent_name = r.agentName;
  if (r.decision !== undefined) out.decision = r.decision;
  if (r.confidence !== undefined) out.confidence = r.confidence;
  if (r.generatedAt !== undefined) out.generated_at = r.generatedAt;
  if (r.summary !== undefined) out.summary = r.summary;
  if (r.checks !== undefined) out.checks = r.checks;
  if (r.recommendation !== undefined) out.recommendation = r.recommendation;
  return out;
}

// ── System Integrations ─────────────────────────────────────────────

export function mapDbToSystemIntegration(row: DbRecord): SystemIntegration {
  return {
    id: row.id as string,
    requestId: (row.request_id ?? row.requestId ?? '') as string,
    system: (row.system ?? 'ariba') as SystemIntegration['system'],
    systemLabel: (row.system_label ?? row.systemLabel ?? '') as string,
    status: (row.status ?? 'pending-handover') as SystemIntegration['status'],
    submittedAt: (row.submitted_at ?? row.submittedAt ?? '') as string,
    respondedAt: (row.responded_at ?? row.respondedAt) as string | undefined,
    referenceId: (row.reference_id ?? row.referenceId) as string | undefined,
    stage: (row.stage ?? '') as string,
    detail: (row.detail ?? '') as string,
  };
}

export function mapSystemIntegrationToDb(i: Partial<SystemIntegration>): DbRecord {
  const out: DbRecord = {};
  if (i.id !== undefined) out.id = i.id;
  if (i.requestId !== undefined) out.request_id = i.requestId;
  if (i.system !== undefined) out.system = i.system;
  if (i.systemLabel !== undefined) out.system_label = i.systemLabel;
  if (i.status !== undefined) out.status = i.status;
  if (i.submittedAt !== undefined) out.submitted_at = i.submittedAt;
  if (i.respondedAt !== undefined) out.responded_at = i.respondedAt;
  if (i.referenceId !== undefined) out.reference_id = i.referenceId;
  if (i.stage !== undefined) out.stage = i.stage;
  if (i.detail !== undefined) out.detail = i.detail;
  return out;
}

// ── Form Templates ──────────────────────────────────────────────────

export function mapDbToFormTemplate(row: DbRecord): FormTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description ?? '') as string,
    status: (row.status ?? 'draft') as FormTemplate['status'],
    category: (row.category ?? '') as string,
    triggerStages: (row.trigger_stages ?? row.triggerStages ?? []) as string[],
    triggerConditions: (row.trigger_conditions ?? row.triggerConditions ?? []) as FormTemplate['triggerConditions'],
    fields: (row.fields ?? []) as FormTemplate['fields'],
    version: (row.version ?? '1.0') as string,
    lastModified: (row.last_modified ?? row.lastModified ?? '') as string,
    createdBy: (row.created_by ?? row.createdBy ?? '') as string,
  };
}

export function mapFormTemplateToDb(t: Partial<FormTemplate>): DbRecord {
  const out: DbRecord = {};
  if (t.id !== undefined) out.id = t.id;
  if (t.name !== undefined) out.name = t.name;
  if (t.description !== undefined) out.description = t.description;
  if (t.status !== undefined) out.status = t.status;
  if (t.category !== undefined) out.category = t.category;
  if (t.triggerStages !== undefined) out.trigger_stages = t.triggerStages;
  if (t.triggerConditions !== undefined) out.trigger_conditions = t.triggerConditions;
  if (t.fields !== undefined) out.fields = t.fields;
  if (t.version !== undefined) out.version = t.version;
  if (t.lastModified !== undefined) out.last_modified = t.lastModified;
  if (t.createdBy !== undefined) out.created_by = t.createdBy;
  return out;
}

// ── Intake Compliance Records ───────────────────────────────────────

export function mapDbToIntakeCompliance(row: DbRecord): IntakeComplianceRecord {
  return {
    requestId: (row.request_id ?? row.requestId ?? '') as string,
    determinedAt: (row.determined_at ?? row.determinedAt ?? '') as string,
    buyingChannel: (row.buying_channel ?? row.buyingChannel) as IntakeComplianceRecord['buyingChannel'],
    sraCheck: (row.sra_check ?? row.sraCheck) as IntakeComplianceRecord['sraCheck'],
    policyChecks: (row.policy_checks ?? row.policyChecks ?? []) as IntakeComplianceRecord['policyChecks'],
    duplicateCheck: (row.duplicate_check ?? row.duplicateCheck) as IntakeComplianceRecord['duplicateCheck'],
    riskFlags: (row.risk_flags ?? row.riskFlags ?? []) as string[],
    matchingRiskAssessmentIds:
      (row.matching_risk_assessment_ids ?? row.matchingRiskAssessmentIds) as string[] | undefined,
  };
}

export function mapIntakeComplianceToDb(r: IntakeComplianceRecord): DbRecord {
  return {
    request_id: r.requestId,
    determined_at: r.determinedAt,
    buying_channel: r.buyingChannel,
    sra_check: r.sraCheck,
    policy_checks: r.policyChecks,
    duplicate_check: r.duplicateCheck,
    risk_flags: r.riskFlags,
    matching_risk_assessment_ids: r.matchingRiskAssessmentIds ?? [],
  };
}

// ── Form Submissions ────────────────────────────────────────────────

export function mapDbToFormSubmission(row: DbRecord): FormSubmission {
  return {
    id: row.id as string,
    formTemplateId: (row.form_template_id ?? row.formTemplateId ?? '') as string,
    formName: (row.form_name ?? row.formName ?? '') as string,
    requestId: (row.request_id ?? row.requestId ?? '') as string,
    stage: (row.stage ?? '') as string,
    submittedBy: (row.submitted_by ?? row.submittedBy ?? '') as string,
    submittedAt: (row.submitted_at ?? row.submittedAt ?? '') as string,
    values: (row.field_values ?? row.values ?? {}) as FormSubmission['values'],
    status: (row.status ?? 'completed') as FormSubmission['status'],
  };
}

export function mapFormSubmissionToDb(s: Partial<FormSubmission>): DbRecord {
  const out: DbRecord = {};
  if (s.id !== undefined) out.id = s.id;
  if (s.formTemplateId !== undefined) out.form_template_id = s.formTemplateId;
  if (s.formName !== undefined) out.form_name = s.formName;
  if (s.requestId !== undefined) out.request_id = s.requestId;
  if (s.stage !== undefined) out.stage = s.stage;
  if (s.submittedBy !== undefined) out.submitted_by = s.submittedBy;
  if (s.submittedAt !== undefined) out.submitted_at = s.submittedAt;
  if (s.values !== undefined) out.field_values = s.values;
  if (s.status !== undefined) out.status = s.status;
  return out;
}

// ── Notifications ───────────────────────────────────────────────────

export function mapDbToNotification(row: DbRecord): Notification {
  return {
    id: row.id as string,
    type: (row.type ?? 'system-alert') as Notification['type'],
    title: row.title as string,
    description: (row.description ?? '') as string,
    timestamp: (row.timestamp ?? '') as string,
    isRead: (row.is_read ?? row.isRead ?? false) as boolean,
    actionUrl: (row.action_url ?? row.actionUrl) as string | undefined,
    relatedId: (row.related_id ?? row.relatedId) as string | undefined,
  };
}

export function mapNotificationToDb(n: Partial<Notification>): DbRecord {
  const out: DbRecord = {};
  if (n.id !== undefined) out.id = n.id;
  if (n.type !== undefined) out.type = n.type;
  if (n.title !== undefined) out.title = n.title;
  if (n.description !== undefined) out.description = n.description;
  if (n.timestamp !== undefined) out.timestamp = n.timestamp;
  if (n.isRead !== undefined) out.is_read = n.isRead;
  if (n.actionUrl !== undefined) out.action_url = n.actionUrl;
  if (n.relatedId !== undefined) out.related_id = n.relatedId;
  return out;
}

// ── Users ───────────────────────────────────────────────────────────

export function mapDbToUser(row: DbRecord): User {
  return {
    id: row.id as string,
    name: row.name as string,
    email: (row.email ?? '') as string,
    role: (row.role ?? '') as string,
    department: (row.department ?? '') as string,
    initials: (row.initials ?? '') as string,
    isOOO: (row.is_ooo ?? row.isOOO ?? false) as boolean,
    delegateId: (row.delegate_id ?? row.delegateId) as string | undefined,
    avatar: row.avatar as string | undefined,
  };
}

export function mapUserToDb(u: Partial<User>): DbRecord {
  const out: DbRecord = {};
  if (u.id !== undefined) out.id = u.id;
  if (u.name !== undefined) out.name = u.name;
  if (u.email !== undefined) out.email = u.email;
  if (u.role !== undefined) out.role = u.role;
  if (u.department !== undefined) out.department = u.department;
  if (u.initials !== undefined) out.initials = u.initials;
  if (u.isOOO !== undefined) out.is_ooo = u.isOOO;
  if (u.delegateId !== undefined) out.delegate_id = u.delegateId;
  if (u.avatar !== undefined) out.avatar = u.avatar;
  return out;
}

// ── Requests ────────────────────────────────────────────────────────

const REQUEST_FIELD_MAP: Record<string, string> = {
  requestorId: 'requestor_id',
  ownerId: 'owner_id',
  supplierId: 'supplier_id',
  supplierName: 'supplier_name',
  contractId: 'contract_id',
  poId: 'po_id',
  buyingChannel: 'buying_channel',
  commodityCode: 'commodity_code',
  commodityCodeLabel: 'commodity_code_label',
  costCentre: 'cost_centre',
  budgetOwner: 'budget_owner',
  businessJustification: 'business_justification',
  deliveryDate: 'delivery_date',
  isUrgent: 'is_urgent',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  slaDeadline: 'sla_deadline',
  daysInStage: 'days_in_stage',
  isOverdue: 'is_overdue',
  referBackCount: 'refer_back_count',
};

const REVERSE_REQUEST_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(REQUEST_FIELD_MAP).map(([k, v]) => [v, k]),
);

export function mapDbToRequest(row: DbRecord): ProcurementRequest {
  const result: DbRecord = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = REVERSE_REQUEST_MAP[key] ?? key;
    result[camelKey] = value;
  }
  return result as unknown as ProcurementRequest;
}

export function mapRequestToDb(data: Partial<ProcurementRequest>): DbRecord {
  const result: DbRecord = {};
  for (const [key, value] of Object.entries(data)) {
    const snakeKey = REQUEST_FIELD_MAP[key] ?? key;
    result[snakeKey] = value;
  }
  return result;
}

// ── Comments ────────────────────────────────────────────────────────

export function mapDbToComment(row: DbRecord): Comment {
  return {
    id: row.id as string,
    requestId: (row.request_id ?? row.requestId) as string,
    authorId: (row.author_id ?? row.authorId) as string,
    authorName: (row.author_name ?? row.authorName) as string,
    authorInitials: (row.author_initials ?? row.authorInitials ?? '') as string,
    content: row.content as string,
    timestamp: (row.created_at ?? row.timestamp) as string,
    isInternal: (row.is_internal ?? row.isInternal ?? false) as boolean,
  };
}

export function mapCommentToDb(
  c: Partial<Comment> & { requestId: string; authorName: string; content: string; isInternal: boolean },
): DbRecord {
  return {
    request_id: c.requestId,
    author_id: c.authorId ?? null,
    author_name: c.authorName,
    author_initials: c.authorInitials ?? null,
    content: c.content,
    is_internal: c.isInternal,
  };
}

// ── Stage History ───────────────────────────────────────────────────

export function mapDbToStageHistory(row: DbRecord): StageHistoryEntry {
  return {
    requestId: (row.request_id ?? row.requestId) as string,
    stage: row.stage as StageHistoryEntry['stage'],
    enteredAt: (row.entered_at ?? row.enteredAt) as string,
    completedAt: (row.completed_at ?? row.completedAt) as string | undefined,
    ownerId: (row.owner_id ?? row.ownerId) as string,
    action: row.action as string | undefined,
    notes: row.notes as string | undefined,
  };
}

// ── Service Descriptions ────────────────────────────────────────────

export interface ServiceDescriptionRecord {
  requestId: string;
  objective: string;
  scope: string;
  deliverables: string;
  timeline: string;
  resources: string;
  acceptanceCriteria: string;
  pricingModel: string;
  location: string;
  dependencies: string;
  narrative: string;
}

export function mapDbToServiceDescription(row: DbRecord): ServiceDescriptionRecord {
  return {
    requestId: (row.request_id ?? row.requestId) as string,
    objective: (row.objective ?? '') as string,
    scope: (row.scope ?? '') as string,
    deliverables: (row.deliverables ?? '') as string,
    timeline: (row.timeline ?? '') as string,
    resources: (row.resources ?? '') as string,
    acceptanceCriteria: (row.acceptance_criteria ?? row.acceptanceCriteria ?? '') as string,
    pricingModel: (row.pricing_model ?? row.pricingModel ?? '') as string,
    location: (row.location ?? '') as string,
    dependencies: (row.dependencies ?? '') as string,
    narrative: (row.narrative ?? '') as string,
  };
}

// ── Suppliers ───────────────────────────────────────────────────────

export function mapDbToSupplier(row: DbRecord): Supplier {
  return {
    id: row.id as string,
    name: row.name as string,
    country: (row.country ?? '') as string,
    countryCode: (row.country_code ?? row.countryCode ?? '') as string,
    riskRating: (row.risk_rating ?? row.riskRating ?? 'low') as Supplier['riskRating'],
    activeContracts: (row.active_contracts ?? row.activeContracts ?? 0) as number,
    totalSpend12m: (row.total_spend_12m ?? row.totalSpend12m ?? 0) as number,
    onboardingStatus: (row.onboarding_status ?? row.onboardingStatus ?? 'not-started') as Supplier['onboardingStatus'],
    sraStatus: (row.sra_status ?? row.sraStatus ?? 'not-assessed') as Supplier['sraStatus'],
    sraExpiryDate: (row.sra_expiry_date ?? row.sraExpiryDate) as string | undefined,
    screeningStatus: (row.screening_status ?? row.screeningStatus ?? 'pending') as Supplier['screeningStatus'],
    categories: (row.categories ?? []) as string[],
    tier: (row.tier ?? 3) as Supplier['tier'],
    duns: (row.duns ?? '') as string,
    address: (row.address ?? '') as string,
    primaryContact: (row.primary_contact ?? row.primaryContact ?? '') as string,
    primaryContactEmail: (row.primary_contact_email ?? row.primaryContactEmail ?? '') as string,
    certifications: (row.certifications ?? []) as Supplier['certifications'],
    spendHistory: (row.spend_history ?? row.spendHistory ?? []) as Supplier['spendHistory'],
    performanceScore: (row.performance_score ?? row.performanceScore ?? 0) as number,
  };
}

export function mapSupplierToDb(s: Partial<Supplier>): DbRecord {
  const out: DbRecord = {};
  if (s.id !== undefined) out.id = s.id;
  if (s.name !== undefined) out.name = s.name;
  if (s.country !== undefined) out.country = s.country;
  if (s.countryCode !== undefined) out.country_code = s.countryCode;
  if (s.riskRating !== undefined) out.risk_rating = s.riskRating;
  if (s.activeContracts !== undefined) out.active_contracts = s.activeContracts;
  if (s.totalSpend12m !== undefined) out.total_spend_12m = s.totalSpend12m;
  if (s.onboardingStatus !== undefined) out.onboarding_status = s.onboardingStatus;
  if (s.sraStatus !== undefined) out.sra_status = s.sraStatus;
  if (s.sraExpiryDate !== undefined) out.sra_expiry_date = s.sraExpiryDate;
  if (s.screeningStatus !== undefined) out.screening_status = s.screeningStatus;
  if (s.categories !== undefined) out.categories = s.categories;
  if (s.tier !== undefined) out.tier = s.tier;
  if (s.duns !== undefined) out.duns = s.duns;
  if (s.address !== undefined) out.address = s.address;
  if (s.primaryContact !== undefined) out.primary_contact = s.primaryContact;
  if (s.primaryContactEmail !== undefined) out.primary_contact_email = s.primaryContactEmail;
  if (s.certifications !== undefined) out.certifications = s.certifications;
  if (s.spendHistory !== undefined) out.spend_history = s.spendHistory;
  if (s.performanceScore !== undefined) out.performance_score = s.performanceScore;
  return out;
}

// ── Contracts ───────────────────────────────────────────────────────

export function mapDbToContract(row: DbRecord): Contract {
  return {
    id: row.id as string,
    title: row.title as string,
    supplierId: (row.supplier_id ?? row.supplierId ?? '') as string,
    supplierName: (row.supplier_name ?? row.supplierName ?? '') as string,
    value: (row.value ?? 0) as number,
    startDate: (row.start_date ?? row.startDate ?? '') as string,
    endDate: (row.end_date ?? row.endDate ?? '') as string,
    status: (row.status ?? 'draft') as Contract['status'],
    ownerId: (row.owner_id ?? row.ownerId ?? '') as string,
    ownerName: (row.owner_name ?? row.ownerName ?? '') as string,
    department: (row.department ?? '') as string,
    category: (row.category ?? '') as string,
    renewalDate: (row.renewal_date ?? row.renewalDate) as string | undefined,
    utilisationPercentage: (row.utilisation_percentage ?? row.utilisationPercentage ?? 0) as number,
    linkedRequestIds: (row.linked_request_ids ?? row.linkedRequestIds ?? []) as string[],
  };
}

export function mapContractToDb(c: Partial<Contract>): DbRecord {
  const out: DbRecord = {};
  if (c.id !== undefined) out.id = c.id;
  if (c.title !== undefined) out.title = c.title;
  if (c.supplierId !== undefined) out.supplier_id = c.supplierId;
  if (c.supplierName !== undefined) out.supplier_name = c.supplierName;
  if (c.value !== undefined) out.value = c.value;
  if (c.startDate !== undefined) out.start_date = c.startDate;
  if (c.endDate !== undefined) out.end_date = c.endDate;
  if (c.status !== undefined) out.status = c.status;
  if (c.ownerId !== undefined) out.owner_id = c.ownerId;
  if (c.ownerName !== undefined) out.owner_name = c.ownerName;
  if (c.department !== undefined) out.department = c.department;
  if (c.category !== undefined) out.category = c.category;
  if (c.renewalDate !== undefined) out.renewal_date = c.renewalDate;
  if (c.utilisationPercentage !== undefined) out.utilisation_percentage = c.utilisationPercentage;
  return out;
}

// ── Purchase Orders ─────────────────────────────────────────────────

export function mapDbToPurchaseOrder(row: DbRecord): PurchaseOrder {
  return {
    id: row.id as string,
    supplierId: (row.supplier_id ?? row.supplierId ?? '') as string,
    supplierName: (row.supplier_name ?? row.supplierName ?? '') as string,
    value: (row.value ?? 0) as number,
    status: (row.status ?? 'draft') as PurchaseOrder['status'],
    createdAt: (row.created_at ?? row.createdAt) as string,
    deliveryDate: (row.delivery_date ?? row.deliveryDate ?? '') as string,
    contractId: (row.contract_id ?? row.contractId) as string | undefined,
    requestId: (row.request_id ?? row.requestId) as string | undefined,
    lineItems: (row.line_items ?? row.lineItems ?? []) as PurchaseOrder['lineItems'],
  };
}

export function mapPurchaseOrderToDb(p: Partial<PurchaseOrder>): DbRecord {
  const out: DbRecord = {};
  if (p.id !== undefined) out.id = p.id;
  if (p.supplierId !== undefined) out.supplier_id = p.supplierId;
  if (p.supplierName !== undefined) out.supplier_name = p.supplierName;
  if (p.value !== undefined) out.value = p.value;
  if (p.status !== undefined) out.status = p.status;
  if (p.createdAt !== undefined) out.created_at = p.createdAt;
  if (p.deliveryDate !== undefined) out.delivery_date = p.deliveryDate;
  if (p.contractId !== undefined) out.contract_id = p.contractId;
  if (p.requestId !== undefined) out.request_id = p.requestId;
  if (p.lineItems !== undefined) out.line_items = p.lineItems;
  return out;
}

// ── Invoices ────────────────────────────────────────────────────────

export function mapDbToInvoice(row: DbRecord): Invoice {
  return {
    id: row.id as string,
    supplierId: (row.supplier_id ?? row.supplierId ?? '') as string,
    supplierName: (row.supplier_name ?? row.supplierName ?? '') as string,
    amount: (row.amount ?? 0) as number,
    currency: (row.currency ?? 'EUR') as string,
    status: (row.status ?? 'submitted') as Invoice['status'],
    invoiceDate: (row.invoice_date ?? row.invoiceDate ?? '') as string,
    dueDate: (row.due_date ?? row.dueDate ?? '') as string,
    poId: (row.po_id ?? row.poId) as string | undefined,
    matchStatus: (row.match_status ?? row.matchStatus ?? 'unmatched') as Invoice['matchStatus'],
    matchVariance: (row.match_variance ?? row.matchVariance) as number | undefined,
    paidDate: (row.paid_date ?? row.paidDate) as string | undefined,
  };
}

export function mapInvoiceToDb(i: Partial<Invoice>): DbRecord {
  const out: DbRecord = {};
  if (i.id !== undefined) out.id = i.id;
  if (i.supplierId !== undefined) out.supplier_id = i.supplierId;
  if (i.supplierName !== undefined) out.supplier_name = i.supplierName;
  if (i.amount !== undefined) out.amount = i.amount;
  if (i.currency !== undefined) out.currency = i.currency;
  if (i.status !== undefined) out.status = i.status;
  if (i.invoiceDate !== undefined) out.invoice_date = i.invoiceDate;
  if (i.dueDate !== undefined) out.due_date = i.dueDate;
  if (i.poId !== undefined) out.po_id = i.poId;
  if (i.matchStatus !== undefined) out.match_status = i.matchStatus;
  if (i.matchVariance !== undefined) out.match_variance = i.matchVariance;
  if (i.paidDate !== undefined) out.paid_date = i.paidDate;
  return out;
}

// ── Approval Entries ────────────────────────────────────────────────

export function mapDbToApproval(row: DbRecord): ApprovalEntry {
  return {
    id: row.id as string,
    requestId: (row.request_id ?? row.requestId ?? '') as string,
    approverId: (row.approver_id ?? row.approverId ?? '') as string,
    approverName: (row.approver_name ?? row.approverName ?? '') as string,
    approverRole: (row.approver_role ?? row.approverRole ?? '') as string,
    status: (row.status ?? 'pending') as ApprovalEntry['status'],
    requestedAt: (row.requested_at ?? row.requestedAt ?? '') as string,
    respondedAt: (row.responded_at ?? row.respondedAt) as string | undefined,
    comments: row.comments as string | undefined,
    delegatedTo: (row.delegated_to ?? row.delegatedTo) as string | undefined,
  };
}

export function mapApprovalToDb(a: Partial<ApprovalEntry>): DbRecord {
  const out: DbRecord = {};
  if (a.id !== undefined) out.id = a.id;
  if (a.requestId !== undefined) out.request_id = a.requestId;
  if (a.approverId !== undefined) out.approver_id = a.approverId;
  if (a.approverName !== undefined) out.approver_name = a.approverName;
  if (a.approverRole !== undefined) out.approver_role = a.approverRole;
  if (a.status !== undefined) out.status = a.status;
  if (a.requestedAt !== undefined) out.requested_at = a.requestedAt;
  if (a.respondedAt !== undefined) out.responded_at = a.respondedAt;
  if (a.comments !== undefined) out.comments = a.comments;
  if (a.delegatedTo !== undefined) out.delegated_to = a.delegatedTo;
  return out;
}

// ── Risk Assessments ────────────────────────────────────────────────

export function mapDbToRiskAssessment(row: DbRecord): RiskAssessment {
  return {
    id: row.id as string,
    title: row.title as string,
    subjectType: (row.subject_type ?? row.subjectType) as RiskAssessment['subjectType'],
    supplierId: (row.supplier_id ?? row.supplierId) as string | undefined,
    contractId: (row.contract_id ?? row.contractId) as string | undefined,
    category: row.category as RiskAssessment['category'],
    riskLevel: (row.risk_level ?? row.riskLevel) as RiskAssessment['riskLevel'],
    score: (row.score ?? 0) as number,
    status: (row.status ?? 'draft') as RiskAssessment['status'],
    assessorId: (row.assessor_id ?? row.assessorId ?? '') as string,
    assessorName: (row.assessor_name ?? row.assessorName ?? '') as string,
    assessedAt: (row.assessed_at ?? row.assessedAt ?? '') as string,
    validUntil: (row.valid_until ?? row.validUntil ?? '') as string,
    summary: (row.summary ?? '') as string,
    mitigations: (row.mitigations ?? []) as string[],
    reusable: (row.reusable ?? false) as boolean,
    linkedRequestIds: (row.linked_request_ids ?? row.linkedRequestIds ?? []) as string[],
  };
}

export function mapRiskAssessmentToDb(r: Partial<RiskAssessment>): DbRecord {
  const out: DbRecord = {};
  if (r.id !== undefined) out.id = r.id;
  if (r.title !== undefined) out.title = r.title;
  if (r.subjectType !== undefined) out.subject_type = r.subjectType;
  if (r.supplierId !== undefined) out.supplier_id = r.supplierId;
  if (r.contractId !== undefined) out.contract_id = r.contractId;
  if (r.category !== undefined) out.category = r.category;
  if (r.riskLevel !== undefined) out.risk_level = r.riskLevel;
  if (r.score !== undefined) out.score = r.score;
  if (r.status !== undefined) out.status = r.status;
  if (r.assessorId !== undefined) out.assessor_id = r.assessorId;
  if (r.assessorName !== undefined) out.assessor_name = r.assessorName;
  if (r.assessedAt !== undefined) out.assessed_at = r.assessedAt;
  if (r.validUntil !== undefined) out.valid_until = r.validUntil;
  if (r.summary !== undefined) out.summary = r.summary;
  if (r.mitigations !== undefined) out.mitigations = r.mitigations;
  if (r.reusable !== undefined) out.reusable = r.reusable;
  if (r.linkedRequestIds !== undefined) out.linked_request_ids = r.linkedRequestIds;
  return out;
}
