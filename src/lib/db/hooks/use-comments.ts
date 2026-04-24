import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listCommentsByRequest,
  addComment,
  listCommentsMentioning,
  listReadCommentIds,
  markCommentRead,
} from '../comments';

const KEYS = {
  all: ['comments'] as const,
  byRequest: (requestId: string) => ['comments', 'request', requestId] as const,
  mentioning: (userId: string) => ['comments', 'mentions', userId] as const,
  reads: (userId: string) => ['comment-reads', userId] as const,
};

export function useCommentsByRequest(requestId: string | undefined) {
  return useQuery({
    queryKey: KEYS.byRequest(requestId ?? ''),
    queryFn: () => listCommentsByRequest(requestId!),
    enabled: Boolean(requestId),
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      requestId: string;
      authorId?: string;
      authorName: string;
      authorInitials?: string;
      content: string;
      isInternal: boolean;
      stage?: string;
      mentions?: string[];
    }) => addComment(input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: KEYS.byRequest(variables.requestId) });
      qc.invalidateQueries({ queryKey: ['comments', 'mentions'] });
    },
  });
}

export function useCommentsMentioning(userId: string | undefined) {
  return useQuery({
    queryKey: KEYS.mentioning(userId ?? ''),
    queryFn: () => listCommentsMentioning(userId!),
    enabled: Boolean(userId),
    refetchInterval: 60_000,
  });
}

export function useReadCommentIds(userId: string | undefined) {
  return useQuery({
    queryKey: KEYS.reads(userId ?? ''),
    queryFn: () => listReadCommentIds(userId!),
    enabled: Boolean(userId),
    refetchInterval: 60_000,
  });
}

export function useMarkCommentRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, userId }: { commentId: string; userId: string }) =>
      markCommentRead(commentId, userId),
    onSuccess: (_data, { userId }) => {
      qc.invalidateQueries({ queryKey: KEYS.reads(userId) });
    },
  });
}
