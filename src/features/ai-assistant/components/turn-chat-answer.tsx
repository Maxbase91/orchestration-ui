import { BookOpen } from 'lucide-react';
import type { ChatAnswerTurn } from '@/data/types';

interface Props {
  turn: ChatAnswerTurn;
}

export function TurnChatAnswer({ turn }: Props) {
  return (
    <div className="space-y-1.5">
      <div className="rounded-[18px] rounded-tl-[4px] bg-white border border-gray-100 shadow-sm px-4 py-3 text-[13.5px] leading-relaxed text-gray-800">
        <p className="whitespace-pre-wrap">{turn.content}</p>
      </div>
      {turn.source && (
        <div className="flex items-center gap-1 pl-1">
          <BookOpen className="size-3 text-gray-400 shrink-0" />
          <span className="text-[10px] text-gray-400">{turn.source}</span>
        </div>
      )}
    </div>
  );
}
