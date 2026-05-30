import { ShieldCheck, Check, X } from 'lucide-react';
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
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-amber-600 shrink-0" />
        <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">
          Confirm before I act
        </span>
      </div>
      <p className="text-[13px] text-gray-800 whitespace-pre-wrap leading-relaxed">
        {turn.readBack}
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          className="h-8 px-4 text-[12px] bg-[#1B2A4A] hover:bg-[#273957] text-white"
          disabled={disabled}
          onClick={() => onConfirm(turn)}
        >
          <Check className="size-3 mr-1.5" />
          Confirm
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 px-3 text-[12px]"
          disabled={disabled}
          onClick={onCancel}
        >
          <X className="size-3 mr-1" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
