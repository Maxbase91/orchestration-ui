import { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIConfidenceBadge } from './ai-confidence-badge';

interface AISuggestionCardProps {
  title?: string;
  children: React.ReactNode;
  confidence?: number;
  onDismiss?: () => void;
  onAccept?: () => void;
  showExplanation?: boolean;
  explanation?: string;
}

export function AISuggestionCard({
  title,
  children,
  confidence,
  onDismiss,
  onAccept,
  showExplanation = false,
  explanation,
}: AISuggestionCardProps) {
  const [explanationOpen, setExplanationOpen] = useState(false);

  return (
    <div className="rounded-md border-l-2 border-blue-400 bg-blue-50/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <Sparkles className="size-4 shrink-0 text-blue-500 mt-0.5" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-blue-600">AI-generated</span>
              {confidence !== undefined && <AIConfidenceBadge confidence={confidence} />}
            </div>
            {title && (
              <p className="mt-1 text-sm font-medium text-gray-900">{title}</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-2 pl-6 text-sm text-gray-700">{children}</div>

      {showExplanation && explanation && (
        <div className="mt-3 pl-6">
          <button
            type="button"
            onClick={() => setExplanationOpen(!explanationOpen)}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
          >
            Why this suggestion?
            {explanationOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
          {explanationOpen && (
            <p className="mt-1 text-xs text-gray-600">{explanation}</p>
          )}
        </div>
      )}

      {(onAccept || onDismiss) && (
        <div className="mt-3 flex items-center gap-2 pl-6">
          {onAccept && (
            <Button size="sm" variant="default" onClick={onAccept}>
              <Check className="size-3.5" />
              Accept
            </Button>
          )}
          {onDismiss && (
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              <X className="size-3.5" />
              Dismiss
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
