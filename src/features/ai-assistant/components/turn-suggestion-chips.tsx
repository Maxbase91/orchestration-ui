import type { SuggestionChipsTurn } from '@/data/types';

interface Props {
  turn: SuggestionChipsTurn;
  onChipClick: (prompt: string) => void;
}

export function TurnSuggestionChips({ turn, onChipClick }: Props) {
  if (turn.chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {turn.chips.map((chip) => (
        <button
          key={chip.label}
          className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] text-blue-700 hover:bg-blue-100 transition-colors"
          onClick={() => onChipClick(chip.prompt)}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
