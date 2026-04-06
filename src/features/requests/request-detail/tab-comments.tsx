import { useState } from 'react';
import type { ProcurementRequest } from '@/data/types';
import { getCommentsByRequestId } from '@/data/comments';
import { CommentThread, type Comment as ThreadComment } from '@/components/shared/comment-thread';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRelativeTime } from '@/lib/format';

interface TabCommentsProps {
  request: ProcurementRequest;
}

export function TabComments({ request }: TabCommentsProps) {
  const baseComments = getCommentsByRequestId(request.id);
  const [localComments, setLocalComments] = useState<ThreadComment[]>(() =>
    baseComments.map((c) => ({
      id: c.id,
      author: c.authorName,
      authorInitials: c.authorInitials,
      content: c.content,
      timestamp: formatRelativeTime(c.timestamp),
      isInternal: c.isInternal,
      attachments: c.attachments,
    }))
  );

  function handleAddComment(content: string, isInternal: boolean) {
    const newComment: ThreadComment = {
      id: `CMT-local-${Date.now()}`,
      author: 'You',
      authorInitials: 'YO',
      content,
      timestamp: 'just now',
      isInternal,
    };
    setLocalComments((prev) => [...prev, newComment]);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Comments ({localComments.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {localComments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No comments yet. Be the first to add one.
          </p>
        ) : (
          <CommentThread comments={localComments} onAddComment={handleAddComment} />
        )}
        {localComments.length === 0 && (
          <CommentThread comments={[]} onAddComment={handleAddComment} />
        )}
      </CardContent>
    </Card>
  );
}
