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
  stage?: string;
  mentions?: string[];
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
        stage: input.stage,
        mentions: input.mentions,
      }),
    )
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToComment(data);
}

/**
 * Comments that mention the given user ID. Ordered most recent first.
 * Used by the dashboard Mentions widget.
 */
export async function listCommentsMentioning(userId: string, limit = 20): Promise<Comment[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .contains('mentions', [userId])
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapDbToComment);
}

/**
 * Mark a comment as read for a user. Safe to call repeatedly —
 * conflicts on the composite PK are ignored.
 */
export async function markCommentRead(commentId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('comment_reads')
    .upsert({ comment_id: commentId, user_id: userId, read_at: new Date().toISOString() }, { onConflict: 'comment_id,user_id' });
  if (error) throw error;
}

/**
 * Return the set of comment IDs that the user has already read.
 * Paired with listCommentsMentioning to compute unread counts.
 */
export async function listReadCommentIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('comment_reads')
    .select('comment_id')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.comment_id as string));
}
