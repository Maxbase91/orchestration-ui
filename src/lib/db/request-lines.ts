// The lines a request is buying. Read-only here: they are written inside the
// governed checkout's transaction, which owns their consistency with the
// requisition and the purchase order.
import { db } from '@/lib/db-client';
import { mapDbToRequestLine } from './mappers';
import type { RequestLine } from '@/data/types';

export async function listRequestLines(requestId: string): Promise<RequestLine[]> {
  const { data, error } = await db
    .from('request_lines').select('*').eq('request_id', requestId).order('line_number');
  if (error) throw error;
  return (data ?? []).map(mapDbToRequestLine);
}
