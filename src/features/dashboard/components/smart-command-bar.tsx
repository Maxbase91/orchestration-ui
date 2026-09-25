// The Home box: one field for anything a requester has in mind. What they
// type takes the shared question route (lib/assistant/question-route.ts) — a
// status or policy question is answered here, an item the catalogue serves is
// offered for ordering, a demand goes to intake with their words, and the rest
// goes to the assistant, which routes the same way.
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, X, Loader2, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { CatalogueItem } from '@/data/catalogue-items';
import { useCatalogueItems } from '@/lib/db/hooks/use-catalogue-items';
import { openAIChatWithPrompt } from '@/features/ai-assistant/ai-chat-controls';
import { formatCurrency } from '@/lib/format';
import type { StatusAnswer } from '@/lib/assistant/status-answer';
import type { PolicyAnswer } from '@/lib/assistant/policy-lookup';
import { useQuestionRoute } from '@/lib/assistant/use-question-route';
import { StatusAnswerView } from '@/components/shared/status-answer-view';
import { PolicyAnswerView } from '@/components/shared/policy-answer-view';

/**
 * What the box answered in place. A demand goes to intake; a policy or status
 * question is answered here, with the follow-up handed to the assistant
 * carrying the question.
 */
type InlineAnswer =
  | { kind: 'policy'; query: string; policy: PolicyAnswer }
  | { kind: 'status'; query: string; status: StatusAnswer };

/** Catalogue items the route recognised, offered — never ordered — for the requester. */
interface Identified {
  items: CatalogueItem[];
  /** The original wording, carried into intake when the match is not what they meant. */
  query: string;
}

const EXAMPLES = [
  'consulting for a transformation programme',
  'do I need three quotes for a €40,000 order?',
  "what's waiting for me?",
  'where are my requests?',
];

export function SmartCommandBar() {
  const navigate = useNavigate();
  const route = useQuestionRoute();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<InlineAnswer | null>(null);
  const [identified, setIdentified] = useState<Identified | null>(null);

  const { data: catalogueItems = [] } = useCatalogueItems();

  // Browsing the catalogue in place. The groups are the catalogues the items
  // belong to — they were six names and icons typed here, which a catalogue
  // added to the store would never have joined.
  const [showCatalogue, setShowCatalogue] = useState(false);
  const [browsing, setBrowsing] = useState<string | null>(null);
  const catalogues = useMemo(() => {
    const byId = new Map<string, string>();
    for (const item of catalogueItems) {
      if (item.catalogueId && !byId.has(item.catalogueId)) byId.set(item.catalogueId, item.catalogueName || item.catalogueId);
    }
    return [...byId].map(([id, name]) => ({ id, name }));
  }, [catalogueItems]);
  const browsed = browsing ? catalogueItems.filter((i) => i.catalogueId === browsing) : [];

  const handleClear = () => {
    setInput('');
    setAnswer(null);
    setIdentified(null);
    setShowCatalogue(false);
    setBrowsing(null);
  };

  const go = (path: string) => {
    navigate(path);
    handleClear();
  };

  const ask = async (query: string) => {
    const text = query.trim();
    if (!text) return;
    setAnswer(null);
    setIdentified(null);
    setShowCatalogue(false);
    setLoading(true);
    let routed;
    try {
      routed = await route(text);
    } finally {
      setLoading(false);
    }
    switch (routed.kind) {
      case 'status': setAnswer({ kind: 'status', query: text, status: routed.status }); return;
      case 'policy': setAnswer({ kind: 'policy', query: text, policy: routed.policy }); return;
      case 'catalogue': setIdentified({ items: routed.items.slice(0, 3), query: text }); return;
      case 'demand': go(`/requests/new?q=${encodeURIComponent(text)}`); return;
      case 'assistant': openAIChatWithPrompt(text); setInput(''); return;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await ask(input);
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    // No card, no gradient strip and no centred heading: the input asks the
    // question itself. The block used to take ~170px — a titled, bordered panel
    // with the field floating in its middle — for one text box and a hint.
    // Results still get a surface, because only they are a separate object.
    <section aria-label="What do you need?">
      <div>
        {/* Flat, but not grey. Stripped of its card it read as one more search
            box — the header already has one — and requesters stopped noticing
            it was the way in. The accent edge and the sparkle say "this is the
            assistant", without the 170px panel it used to be. */}
        <form onSubmit={handleSubmit} className="relative">
          <Sparkles className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-accent" aria-hidden="true" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="What do you need?"
            placeholder="What do you need? Describe it, or ask about a policy or a status — press Enter"
            className="h-12 rounded-lg border-accent-line bg-card pl-11 pr-10 text-prose shadow-[var(--shadow)] focus-visible:border-accent focus-visible:ring-accent/15"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="size-4 animate-spin text-accent" />
            </div>
          )}
          {!loading && (input || identified || answer || showCatalogue) && (
            <button type="button" aria-label="Clear" onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink-2">
              <X className="size-4" />
            </button>
          )}
        </form>

        {/* AI hint */}
        {!identified && !answer && !showCatalogue && !loading && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-3">
            <span>Describe what you need, or ask about a policy or a status. Try:</span>
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                className="rounded-full border border-line bg-card px-2 py-0.5 text-ink-2 hover:border-accent-line hover:text-accent"
                onClick={() => { setInput(example); void ask(example); }}
              >
                {example}
              </button>
            ))}
          </div>
        )}

        {/* ── INLINE ANSWER — a policy or status question, answered here ── */}
        {answer && !loading && (
          <div className="mt-3 space-y-3 rounded-md border border-line bg-card p-4" data-testid="home-answer">
            <span className={answer.kind === 'policy'
              ? 'inline-block rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-medium text-warn'
              : 'inline-block rounded-full bg-idle-soft px-2 py-0.5 text-[11px] font-medium text-ink-2'}
            >
              {answer.kind === 'policy' ? 'A policy question' : 'A status question'}
            </span>
            {answer.kind === 'status'
              ? <StatusAnswerView answer={answer.status} onNavigate={handleClear} />
              : <PolicyAnswerView answer={answer.policy} />}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                className="text-xs font-medium text-accent-solid hover:underline"
                onClick={() => { openAIChatWithPrompt(answer.query); handleClear(); }}
              >
                Ask a follow-up →
              </button>
              {answer.kind === 'policy' && (
                <button
                  type="button"
                  className="text-xs text-ink-3 hover:text-ink-2 hover:underline"
                  onClick={() => go(`/requests/new?q=${encodeURIComponent(answer.query)}`)}
                >
                  This is something I need to buy →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="mt-3 flex items-center gap-2 text-body text-ink-3">
            <Loader2 className="size-4 animate-spin" />
            Analysing...
          </div>
        )}

        {/* ── IDENTIFIED CATALOGUE ITEM ──
            Say what was recognised, then hand over a link. Navigating for the
            requester would be faster and worse: a wrong match would land them
            in a checkout for the wrong thing. */}
        {identified && !showCatalogue && !loading && (
          <div className="mt-3 space-y-3 rounded-md border border-line bg-card p-4">
            <div className="flex items-start gap-2">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft mt-0.5">
                <Sparkles className="size-3 text-accent" />
              </div>
              <p className="text-sm text-ink-2">
                {identified.items.length === 1
                  ? 'This looks like a catalogue item you can order today.'
                  : `This looks like ${identified.items.length} catalogue items you can order today.`}
              </p>
            </div>
            {identified.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-line bg-card p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{item.name}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-3">
                    {formatCurrency(item.unitPrice)} / {item.unit} · {item.supplierName} · {item.leadTime}
                  </p>
                </div>
                <Button size="sm" onClick={() => go(`/catalogue/items/${encodeURIComponent(item.id)}`)}>
                  Order this
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            ))}
            {/* The correction, always available and never hidden behind the
                match: the original wording goes with it, so nothing is retyped. */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                className="text-xs font-medium text-accent-solid hover:underline"
                onClick={() => go(`/requests/new?q=${encodeURIComponent(identified.query)}`)}
              >
                Not what you need? Describe it in full →
              </button>
              <button
                type="button"
                className="text-xs text-ink-3 hover:text-ink-2 hover:underline"
                onClick={() => { setIdentified(null); setShowCatalogue(true); setBrowsing(catalogues[0]?.id ?? null); }}
              >
                Browse the whole catalogue
              </button>
            </div>
          </div>
        )}

        {/* ── CATALOGUE VIEW ──
            Every item orders through its own governed checkout, so there is no
            basket here: the one it had could order a single line, and said so
            only after the second was added. */}
        {showCatalogue && !loading && (
          <div className="mt-3 space-y-4 rounded-md border border-line bg-card p-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Catalogues">
              {catalogues.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={browsing === cat.id}
                  onClick={() => setBrowsing(cat.id)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${browsing === cat.id ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-2 hover:bg-card-2'}`}
                >
                  <Package className="size-3.5" />
                  {cat.name}
                </button>
              ))}
            </div>
            {catalogues.length === 0 && <p className="text-sm text-ink-3">The catalogue has no items yet.</p>}

            {browsed.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {browsed.slice(0, 9).map((item) => (
                  <div key={item.id} className="flex flex-col justify-between gap-2 rounded-lg border border-line bg-card p-3">
                    <div>
                      <p className="text-sm font-medium text-ink">{item.name}</p>
                      <p className="mt-0.5 text-xs text-ink-3">{item.supplierName} · {item.leadTime}</p>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink tabular-nums">
                        {formatCurrency(item.unitPrice)} <span className="text-xs font-normal text-ink-3">/ {item.unit}</span>
                      </p>
                      <Button size="sm" variant="outline" onClick={() => go(`/catalogue/items/${encodeURIComponent(item.id)}`)}>
                        Order this
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {browsed.length > 9 && <p className="text-xs text-ink-3">Showing 9 of {browsed.length} — search for an item by name above.</p>}

            <div className="flex items-center gap-3 pt-1">
              <Button variant="link" size="sm" className="px-0 text-xs text-ink-3" onClick={() => go('/requests/new')}>
                Not in the catalogue? Create a procurement request <ArrowRight className="ml-1 size-3" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
