// Persistence for the durable line-level audit trail behind a requisition.
import { supabase } from '@/lib/supabase-client';
import type { RequestLine } from '@/data/types';
import { mapDbToRequestLine, mapRequestLineToDb } from './mappers';

const TABLE = 'request_lines';

export async function listRequestLines(requestId: string): Promise<RequestLine[]> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('request_id', requestId).order('id');
  if (error) throw error;
  return (data ?? []).map(mapDbToRequestLine);
}

export async function createRequestLines(lines: RequestLine[]): Promise<RequestLine[]> {
  if (lines.length === 0) return [];
  const { data, error } = await supabase.from(TABLE).insert(lines.map(mapRequestLineToDb)).select('*');
  if (error) throw error;
  return (data ?? []).map(mapDbToRequestLine);
}
