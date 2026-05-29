import { BookOpen } from 'lucide-react';
import type { ChatAnswerTurn } from '@/data/types';

interface Props {
  turn: ChatAnswerTurn;
}

export function TurnChatAnswer({ turn }: Props) {
  return (
    <div className="space-y-1.5">
      <div className="rounded-lg bg-gray-50 px-3 py-2 text-[13px] leading-relaxed text-gray-800">
        <p className="whitespace-pre-wrap">{turn.content}</p>
      </div>
      {turn.source && (
        <div className="flex items-center gap-1">
          <BookOpen className="size-3 text-blue-500 shrink-0" />
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-100">
            {turn.source}
          </span>
        </div>
      )}
    </div>
  );
}
