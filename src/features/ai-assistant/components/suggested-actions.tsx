const suggestions = [
  'Where is my request?',
  'How do I buy software?',
  'Show pending approvals',
];

interface SuggestedActionsProps {
  onActionClick: (text: string) => void;
}

export function SuggestedActions({ onActionClick }: SuggestedActionsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {suggestions.map((text) => (
        <button
          key={text}
          className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
          onClick={() => onActionClick(text)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
