// Confirm-before-act card for assistant-proposed actions (R1 boundary: the
// assistant proposes, the user confirms — no action runs without this step).
//
// `turn.readBack` is built server-side from the action and its parameters
// (api/_action-description.ts), not written by the model, so the sentence and
// the queued write cannot disagree. The resolved targets are listed under it
// because a plausible sentence about the wrong record is the failure this card
// exists to catch.
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
    <div className="rounded-xl border border-warn-line bg-warn-soft/60 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-warn shrink-0" />
        <span className="text-[11px] font-semibold text-warn uppercase tracking-wider">
          Confirm before I act
        </span>
      </div>
      <p className="text-[13px] text-ink whitespace-pre-wrap leading-relaxed">
        {turn.readBack}
      </p>
      {turn.facts && turn.facts.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
          {turn.facts.map((fact) => (
            <div key={fact.label} className="contents">
              <dt className="text-warn/80">{fact.label}</dt>
              <dd className="text-ink font-medium break-words">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="h-8 px-4 text-[12px] bg-accent-solid hover:bg-accent-solid/90 text-paper"
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
