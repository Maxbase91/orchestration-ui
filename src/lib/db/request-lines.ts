// Persistence for the durable line-level audit trail behind a requisition.
import { db } from '@/lib/db-client';
import type { RequestLine } from '@/data/types';
import { mapDbToRequestLine, mapRequestLineToDb } from './mappers';

const TABLE = 'request_lines';

export async function listRequestLines(requestId: string): Promise<RequestLine[]> {
  const { data, error } = await db.from(TABLE).select('*').eq('request_id', requestId).order('id');
  if (error) throw error;
  return (data ?? []).map(mapDbToRequestLine);
}

export async function createRequestLines(lines: RequestLine[]): Promise<RequestLine[]> {
  if (lines.length === 0) return [];
  const { data, error } = await db.from(TABLE).insert(lines.map(mapRequestLineToDb)).select('*');
  if (error) throw error;
  return (data ?? []).map(mapDbToRequestLine);
}
