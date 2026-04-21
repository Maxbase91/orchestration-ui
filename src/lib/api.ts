// Client-side API wrapper with fallback to mock data.
// NOTE: Mappers live in `src/lib/db/mappers.ts`; this module re-exports the
// ones that are used externally and will be slimmed down as each entity
// migrates to the db-layer hooks (see plan file).

import type { ProcurementRequest, Comment } from '../data/types';
import { requests as mockRequests } from '../data/requests';
import { comments as mockComments } from '../data/comments';
import { stageHistory as mockStageHistory } from '../data/stage-history';
import { serviceDescriptions as mockServiceDescriptions } from '../data/service-descriptions';
import {
  mapDbToRequest,
  mapRequestToDb,
  mapDbToComment,
  mapDbToStageHistory,
  mapDbToServiceDescription,
} from './db/mappers';

export { mapDbToRequest, mapRequestToDb };

type DbRecord = Record<string, unknown>;

type MappedStageHistory = ReturnType<typeof mapDbToStageHistory>;

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

// Suppliers and contracts have moved to `src/lib/db/suppliers.ts` /
// `src/lib/db/contracts.ts` + React Query hooks. Use `useSuppliers` /
// `useSupplier` / `useContracts` / `useContract` from
// `@/lib/db/hooks/*` instead of any deleted apiGetX wrappers.

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
