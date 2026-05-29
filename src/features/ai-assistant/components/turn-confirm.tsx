import { AlertTriangle, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ConfirmTurn } from '@/data/types';

interface Props {
  turn: ConfirmTurn;
  onConfirm: (turn: ConfirmTurn) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export function TurnConfirm({ turn, onConfirm, onCancel, disabled }: Props) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 overflow-hidden">
      <div className="flex items-center gap-2 bg-amber-500 px-3 py-1.5">
        <AlertTriangle className="size-3.5 text-white shrink-0" />
        <span className="text-[11px] font-semibold text-white uppercase tracking-wide">
          Confirm before I act
        </span>
      </div>
      <div className="px-3 py-2.5 space-y-2.5">
        <p className="text-[13px] text-gray-800 whitespace-pre-wrap leading-relaxed">
          {turn.readBack}
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="h-7 px-3 text-[12px] bg-amber-500 hover:bg-amber-600 text-white"
            disabled={disabled}
            onClick={() => onConfirm(turn)}
          >
            <Check className="size-3 mr-1" />
            Confirm
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-3 text-[12px]"
            disabled={disabled}
            onClick={onCancel}
          >
            <X className="size-3 mr-1" />
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
