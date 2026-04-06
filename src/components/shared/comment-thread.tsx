import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Send } from 'lucide-react';

interface Comment {
  id: string;
  author: string;
  authorInitials: string;
  content: string;
  timestamp: string;
  isInternal: boolean;
  attachments?: string[];
}

interface CommentThreadProps {
  comments: Comment[];
  onAddComment?: (content: string, isInternal: boolean) => void;
}

export function CommentThread({ comments, onAddComment }: CommentThreadProps) {
  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  function handleSubmit() {
    const trimmed = newComment.trim();
    if (!trimmed || !onAddComment) return;
    onAddComment(trimmed, isInternal);
    setNewComment('');
  }

  return (
    <div className="space-y-4">
      {/* Comments list */}
      <div className="space-y-3">
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1B2A4A] text-xs font-medium text-white">
              {comment.authorInitials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{comment.author}</span>
                {comment.isInternal && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                    Internal
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{comment.timestamp}</span>
              </div>
              <p className="mt-0.5 text-sm text-gray-700">{comment.content}</p>
              {comment.attachments && comment.attachments.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {comment.attachments.map((name, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add comment form */}
      {onAddComment && (
        <div className="space-y-2 border-t pt-3">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="min-h-[60px]"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch
                size="sm"
                checked={isInternal}
                onCheckedChange={setIsInternal}
              />
              Internal only
            </label>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!newComment.trim()}
            >
              <Send className="size-3.5" />
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export type { Comment };
