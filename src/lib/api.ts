// Client-side API wrapper with fallback to mock data

import type { ProcurementRequest, Comment, Supplier, Contract } from '../data/types';
import { requests as mockRequests } from '../data/requests';
import { comments as mockComments } from '../data/comments';
import { stageHistory as mockStageHistory } from '../data/stage-history';
import { serviceDescriptions as mockServiceDescriptions } from '../data/service-descriptions';
import { suppliers as mockSuppliers } from '../data/suppliers';
import { contracts as mockContracts } from '../data/contracts';

// --- snake_case <-> camelCase mapping ---

type DbRecord = Record<string, unknown>;

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

function mapDbToComment(row: DbRecord): Comment {
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

interface MappedStageHistory {
  requestId: string;
  stage: string;
  enteredAt: string;
  completedAt?: string;
  ownerId: string;
  action?: string;
  notes?: string;
}

function mapDbToStageHistory(row: DbRecord): MappedStageHistory {
  return {
    requestId: (row.request_id ?? row.requestId) as string,
    stage: row.stage as string,
    enteredAt: (row.entered_at ?? row.enteredAt) as string,
    completedAt: (row.completed_at ?? row.completedAt) as string | undefined,
    ownerId: (row.owner_id ?? row.ownerId) as string,
    action: row.action as string | undefined,
    notes: row.notes as string | undefined,
  };
}

function mapDbToServiceDescription(row: DbRecord) {
  return {
    requestId: (row.request_id ?? row.requestId) as string,
    objective: row.objective as string,
    scope: row.scope as string,
    deliverables: row.deliverables as string,
    timeline: row.timeline as string,
    resources: row.resources as string,
    acceptanceCriteria: (row.acceptance_criteria ?? row.acceptanceCriteria) as string,
    pricingModel: (row.pricing_model ?? row.pricingModel) as string,
    location: row.location as string,
    dependencies: row.dependencies as string,
    narrative: row.narrative as string,
  };
}

// --- API functions ---

export async function apiGetRequests(): Promise<ProcurementRequest[]> {
  try {
    const res = await fetch('/api/requests');
    if (!res.ok) throw new Error('API error');
    const data = (await res.json()) as DbRecord[];
    return data.map(mapDbToRequest);
  } catch {
    return mockRequests;
  }
}

export async function apiCreateRequest(
  data: Partial<ProcurementRequest>,
): Promise<ProcurementRequest> {
  const body = mapRequestToDb(data);
  const res = await fetch('/api/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? 'Failed to create request');
  }
  const row = (await res.json()) as DbRecord;
  return mapDbToRequest(row);
}

export async function apiUpdateRequest(
  id: string,
  updates: Partial<ProcurementRequest>,
): Promise<void> {
  const body = mapRequestToDb(updates);
  const res = await fetch(`/api/requests/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? 'Failed to update request');
  }
}

interface RequestDetail {
  request: ProcurementRequest;
  stageHistory: MappedStageHistory[];
  serviceDescription: ReturnType<typeof mapDbToServiceDescription> | null;
  comments: Comment[];
  approvalEntries: DbRecord[];
}

export async function apiGetRequest(id: string): Promise<RequestDetail | null> {
  try {
    const res = await fetch(`/api/requests/${id}`);
    if (!res.ok) throw new Error('API error');
    const data = (await res.json()) as DbRecord;

    const stageHistoryData = (data.stage_history ?? []) as DbRecord[];
    const commentsData = (data.comments ?? []) as DbRecord[];
    const sowData = data.service_description as DbRecord | null;

    // Remove joined fields before mapping request
    const { stage_history: _sh, comments: _c, service_description: _sd, approval_entries: _ae, ...requestData } = data;

    return {
      request: mapDbToRequest(requestData),
      stageHistory: stageHistoryData.map(mapDbToStageHistory),
      serviceDescription: sowData ? mapDbToServiceDescription(sowData) : null,
      comments: commentsData.map(mapDbToComment),
      approvalEntries: (data.approval_entries ?? []) as DbRecord[],
    };
  } catch {
    // Fallback to mock data
    const request = mockRequests.find((r) => r.id === id);
    if (!request) return null;

    const history = mockStageHistory.filter((s) => s.requestId === id);
    const requestComments = mockComments.filter((c) => c.requestId === id);
    const sow = mockServiceDescriptions.find((s) => s.requestId === id) ?? null;

    return {
      request,
      stageHistory: history,
      serviceDescription: sow,
      comments: requestComments,
      approvalEntries: [],
    };
  }
}

export async function apiAddComment(
  requestId: string,
  comment: { authorId?: string; authorName: string; content: string; isInternal: boolean },
): Promise<void> {
  const res = await fetch('/api/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      request_id: requestId,
      author_id: comment.authorId ?? null,
      author_name: comment.authorName,
      content: comment.content,
      is_internal: comment.isInternal,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? 'Failed to add comment');
  }
}

export async function apiSaveServiceDescription(
  requestId: string,
  sow: Record<string, string>,
): Promise<void> {
  const body: Record<string, unknown> = {
    request_id: requestId,
    objective: sow.objective,
    scope: sow.scope,
    deliverables: sow.deliverables,
    timeline: sow.timeline,
    resources: sow.resources,
    acceptance_criteria: sow.acceptanceCriteria,
    pricing_model: sow.pricingModel,
    location: sow.location,
    dependencies: sow.dependencies,
    narrative: sow.narrative,
  };

  const res = await fetch('/api/service-descriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? 'Failed to save service description');
  }
}

export async function apiSaveConversation(data: {
  requestId: string;
  messages: unknown[];
  category: string;
  status: string;
}): Promise<void> {
  const res = await fetch('/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      request_id: data.requestId,
      messages: data.messages,
      category: data.category,
      status: data.status,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? 'Failed to save conversation');
  }
}

// --- Supplier helpers ---

function mapDbToSupplier(row: DbRecord): Supplier {
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
    certifications: [],
    spendHistory: [],
    performanceScore: (row.performance_score ?? row.performanceScore ?? 0) as number,
  };
}

function mapDbToContract(row: DbRecord): Contract {
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
    linkedRequestIds: [],
  };
}

export async function apiGetSuppliers(): Promise<Supplier[]> {
  try {
    const res = await fetch('/api/suppliers');
    if (!res.ok) throw new Error('API error');
    const data = (await res.json()) as DbRecord[];
    return data.map(mapDbToSupplier);
  } catch {
    return mockSuppliers;
  }
}

export async function apiGetSupplier(id: string): Promise<Supplier | null> {
  try {
    const res = await fetch(`/api/suppliers/${id}`);
    if (!res.ok) throw new Error('API error');
    const data = (await res.json()) as DbRecord;
    return mapDbToSupplier(data);
  } catch {
    return mockSuppliers.find((s) => s.id === id) ?? null;
  }
}

export async function apiGetContracts(): Promise<Contract[]> {
  try {
    const res = await fetch('/api/contracts');
    if (!res.ok) throw new Error('API error');
    const data = (await res.json()) as DbRecord[];
    return data.map(mapDbToContract);
  } catch {
    return mockContracts;
  }
}

export async function apiGetContract(id: string): Promise<Contract | null> {
  try {
    const res = await fetch(`/api/contracts/${id}`);
    if (!res.ok) throw new Error('API error');
    const data = (await res.json()) as DbRecord;
    return mapDbToContract(data);
  } catch {
    return mockContracts.find((c) => c.id === id) ?? null;
  }
}

export async function apiWorkflowAction(data: {
  requestId: string;
  action: string;
  newStatus: string;
  ownerId?: string;
  notes?: string;
}): Promise<void> {
  const res = await fetch('/api/workflow-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? 'Failed to execute workflow action');
  }
}
