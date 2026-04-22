import { supabase } from '@/lib/supabase-client';
import type { Comment } from '@/data/types';
import { mapDbToComment, mapCommentToDb } from './mappers';

const TABLE = 'comments';

export async function listCommentsByRequest(requestId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('request_id', requestId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []).map(mapDbToComment);
}

export async function addComment(input: {
  requestId: string;
  authorId?: string;
  authorName: string;
  authorInitials?: string;
  content: string;
  isInternal: boolean;
}): Promise<Comment> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(
      mapCommentToDb({
        requestId: input.requestId,
        authorId: input.authorId,
        authorName: input.authorName,
        authorInitials: input.authorInitials,
        content: input.content,
        isInternal: input.isInternal,
      }),
    )
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToComment(data);
}
