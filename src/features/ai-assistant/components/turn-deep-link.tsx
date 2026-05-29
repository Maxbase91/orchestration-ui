import { ArrowUpRight, ExternalLink } from 'lucide-react';
import type { DeepLinkTurn } from '@/data/types';

interface Props {
  turn: DeepLinkTurn;
  onNavigate: (path: string) => void;
}

export function TurnDeepLink({ turn, onNavigate }: Props) {
  return (
    <button
      onClick={() => onNavigate(turn.path)}
      className="group w-full text-left rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 transition-colors hover:bg-amber-100"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ExternalLink className="size-3.5 text-amber-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-amber-700 uppercase tracking-wide leading-none mb-0.5">
              Opens in platform
            </p>
            <p className="text-[13px] font-semibold text-gray-900 truncate">{turn.label}</p>
            {turn.description && (
              <p className="text-[11px] text-gray-500 truncate">{turn.description}</p>
            )}
          </div>
        </div>
        <ArrowUpRight className="size-4 text-amber-500 shrink-0 group-hover:text-amber-700 transition-colors" />
      </div>
    </button>
  );
}
