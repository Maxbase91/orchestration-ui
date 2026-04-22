import { useMemo, useState } from 'react';
import type { ProcurementRequest } from '@/data/types';
import { useCommentsByRequest, useAddComment } from '@/lib/db/hooks/use-comments';
import { CommentThread, type Comment as ThreadComment } from '@/components/shared/comment-thread';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRelativeTime } from '@/lib/format';
import { useAuthStore } from '@/stores/auth-store';

interface TabCommentsProps {
  request: ProcurementRequest;
}

export function TabComments({ request }: TabCommentsProps) {
  const { data: baseComments = [] } = useCommentsByRequest(request.id);
  const { currentUser } = useAuthStore();
  const addCommentMutation = useAddComment();
  const [optimistic, setOptimistic] = useState<ThreadComment[]>([]);

  const comments = useMemo<ThreadComment[]>(
    () => [
      ...baseComments.map((c) => ({
        id: c.id,
        author: c.authorName,
        authorInitials: c.authorInitials,
        content: c.content,
        timestamp: formatRelativeTime(c.timestamp),
        isInternal: c.isInternal,
      })),
      ...optimistic,
    ],
    [baseComments, optimistic],
  );

  function handleAddComment(content: string, isInternal: boolean) {
    const tempId = `CMT-local-${Date.now()}`;
    const tempComment: ThreadComment = {
      id: tempId,
      author: currentUser.name,
      authorInitials: currentUser.initials,
      content,
      timestamp: 'just now',
      isInternal,
    };
    setOptimistic((prev) => [...prev, tempComment]);

    addCommentMutation.mutate(
      {
        requestId: request.id,
        authorId: currentUser.id,
        authorName: currentUser.name,
        authorInitials: currentUser.initials,
        content,
        isInternal,
      },
      {
        onSuccess: () => {
          // Remove the optimistic placeholder — the real comment is now in the cache.
          setOptimistic((prev) => prev.filter((c) => c.id !== tempId));
        },
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Comments ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No comments yet. Be the first to add one.
          </p>
        ) : (
          <CommentThread comments={comments} onAddComment={handleAddComment} />
        )}
        {comments.length === 0 && (
          <CommentThread comments={[]} onAddComment={handleAddComment} />
        )}
      </CardContent>
    </Card>
  );
}
