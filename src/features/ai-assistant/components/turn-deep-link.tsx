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
      className="group w-full text-left rounded-xl border border-line bg-card shadow-sm hover:shadow-md hover:border-line transition-all duration-150 px-4 py-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-accent leading-none mb-1">
            {turn.label}
          </p>
          {turn.description && (
            <p className="text-[12px] text-ink-3 truncate">{turn.description}</p>
          )}
        </div>
        <ArrowUpRight className="size-4 text-ink-3 shrink-0 group-hover:text-ink-2 transition-colors" />
      </div>
    </button>
  );
}
