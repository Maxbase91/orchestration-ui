import { ArrowUpRight } from 'lucide-react';
import type { DeepLinkTurn } from '@/data/types';

interface Props {
  turn: DeepLinkTurn;
  onNavigate: (path: string) => void;
}

export function TurnDeepLink({ turn, onNavigate }: Props) {
  return (
    <button
      onClick={() => onNavigate(turn.path)}
      className="group w-full text-left rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-150 px-4 py-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#2D5F8A] leading-none mb-1">
            {turn.label}
          </p>
          {turn.description && (
            <p className="text-[12px] text-gray-500 truncate">{turn.description}</p>
          )}
        </div>
        <ArrowUpRight className="size-4 text-gray-400 shrink-0 group-hover:text-gray-600 transition-colors" />
      </div>
    </button>
  );
}
