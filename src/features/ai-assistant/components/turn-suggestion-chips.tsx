import type { SuggestionChipsTurn } from '@/data/types';

interface Props {
  turn: SuggestionChipsTurn;
  onChipClick: (prompt: string) => void;
}

export function TurnSuggestionChips({ turn, onChipClick }: Props) {
  if (turn.chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {turn.chips.map((chip, i) => (
        <button
          key={chip.label}
          className="animate-chip-in rounded-full border border-line bg-card shadow-sm hover:shadow hover:border-line px-3 py-1.5 text-[12px] font-medium text-ink-2 transition-all duration-150"
          style={{ animationDelay: `${i * 60}ms` }}
          onClick={() => onChipClick(chip.prompt)}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
