import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listCommentsByRequest, addComment } from '../comments';

const KEYS = {
  all: ['comments'] as const,
  byRequest: (requestId: string) => ['comments', 'request', requestId] as const,
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
    }) => addComment(input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: KEYS.byRequest(variables.requestId) });
    },
  });
}
