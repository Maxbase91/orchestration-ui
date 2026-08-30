// Optional requester guidance beside the active intake field. Suggestions are
// explicitly applied so the requester remains the author of the submission.

import { useEffect, useState } from 'react';
import { Lightbulb, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { requestIntakeGuidance, type IntakeGuidanceSuggestion } from '@/lib/procurement/intake-guidance-api';

interface IntakeGuidanceCardProps {
  category?: string;
  section: string;
  text?: string;
  commodityCode?: string;
  onApply: (text: string) => void;
}

export function IntakeGuidanceCard({ category, section, text, commodityCode, onApply }: IntakeGuidanceCardProps) {
  const [suggestions, setSuggestions] = useState<IntakeGuidanceSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void requestIntakeGuidance({ category, section, text, commodityCode }, controller.signal)
      .then(setSuggestions)
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [category, section, text, commodityCode]);
  if (!loading && suggestions.length === 0) return null;
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50/60 p-2.5 text-xs">
      <button type="button" className="flex w-full items-center gap-1.5 text-left font-medium text-amber-800" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Lightbulb className="size-3.5" />}
        {loading ? 'Finding useful examples…' : 'Helpful guidance from similar requests'}
      </button>
      {open && !loading && <div className="mt-2 space-y-2">{suggestions.map((suggestion) => <div key={suggestion.id} className="rounded border border-amber-100 bg-white p-2"><p className="text-gray-700">{suggestion.text}</p><p className="mt-1 text-[10px] text-gray-500">{suggestion.rationale} · {suggestion.sourceType}</p><Button type="button" variant="ghost" size="sm" className="mt-1 h-6 px-1.5 text-[11px] text-amber-800" onClick={() => onApply(suggestion.text)}>Use as a starting point</Button></div>)}</div>}
    </div>
  );
}
