import { supabase } from '@/lib/supabase-client';

export interface SourcingEvent {
  id: string;
  title: string;
  category: string;
  type: string;
  status: 'draft' | 'published' | 'in-evaluation' | 'award-pending' | 'completed' | 'cancelled';
  budget?: number;
  deadline?: string;
  publishDate?: string;
  evaluationDate?: string;
  awardDate?: string;
  ownerId?: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

const TABLE = 'sourcing_events';

function mapRow(row: Record<string, unknown>): SourcingEvent {
  return {
    id: row.id as string,
    title: row.title as string,
    category: (row.category as string) ?? '',
    type: (row.type as string) ?? 'RFP',
    status: (row.status as SourcingEvent['status']) ?? 'draft',
    budget: row.budget as number | undefined,
    deadline: row.deadline as string | undefined,
    publishDate: row.publish_date as string | undefined,
    evaluationDate: row.evaluation_date as string | undefined,
    awardDate: row.award_date as string | undefined,
    ownerId: row.owner_id as string | undefined,
    description: (row.description as string) ?? '',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapToDb(e: Partial<SourcingEvent>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (e.title !== undefined) row.title = e.title;
  if (e.category !== undefined) row.category = e.category;
  if (e.type !== undefined) row.type = e.type;
  if (e.status !== undefined) row.status = e.status;
  if (e.budget !== undefined) row.budget = e.budget;
  if (e.deadline !== undefined) row.deadline = e.deadline;
  if (e.publishDate !== undefined) row.publish_date = e.publishDate;
  if (e.evaluationDate !== undefined) row.evaluation_date = e.evaluationDate;
  if (e.awardDate !== undefined) row.award_date = e.awardDate;
  if (e.ownerId !== undefined) row.owner_id = e.ownerId;
  if (e.description !== undefined) row.description = e.description;
  row.updated_at = new Date().toISOString();
  return row;
}

export async function listSourcingEvents(): Promise<SourcingEvent[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getSourcingEvent(id: string): Promise<SourcingEvent | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapRow(data) : null;
}

export async function createSourcingEvent(event: Omit<SourcingEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<SourcingEvent> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(mapToDb(event))
    .select('*')
    .single();
  if (error) throw error;
  return mapRow(data);
}

export async function updateSourcingEvent(id: string, patch: Partial<SourcingEvent>): Promise<SourcingEvent> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(mapToDb(patch))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapRow(data);
}
