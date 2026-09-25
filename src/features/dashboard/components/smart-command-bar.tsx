// Home, Door 1: one field for anything a requester has in mind. What they type
// takes the shared question route (lib/assistant/question-route.ts), and every
// outcome comes back the same way — an "Understood as" card saying what was
// understood, the answer or what happens next, where it came from, and one
// action: something to buy starts the request, a catalogue item goes into the
// basket on the Catalogue page (Door 2), a policy or status question is
// answered here. Only what none of those is goes to the assistant, which routes
// the same way.
//
// A demand used to navigate straight into intake; it shows its card first, like
// every other outcome, so the requester sees how it was read before anything
// opens (Intake Prototype, 2026-09-25).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { CatalogueItem } from '@/data/catalogue-items';
import { openAIChatWithPrompt } from '@/features/ai-assistant/ai-chat-controls';
import { formatCurrency } from '@/lib/format';
import type { StatusAnswer } from '@/lib/assistant/status-answer';
import type { PolicyAnswer } from '@/lib/assistant/policy-lookup';
import { useQuestionRoute } from '@/lib/assistant/use-question-route';
import { usePolicyConfig } from '@/lib/procurement/use-policy-config';
import { StatusAnswerView } from '@/components/shared/status-answer-view';
import { PolicyAnswerView } from '@/components/shared/policy-answer-view';

/** What the box understood, with what it needs to show it. */
type Understood =
  | { kind: 'demand'; query: string }
  | { kind: 'catalogue'; query: string; items: CatalogueItem[] }
  | { kind: 'policy'; query: string; policy: PolicyAnswer }
  | { kind: 'status'; query: string; status: StatusAnswer };

const KIND: Record<Understood['kind'], { label: string; pill: string }> = {
  demand: { label: 'Something to buy', pill: 'bg-accent-soft text-accent' },
  catalogue: { label: 'A catalogue item', pill: 'bg-ok-soft text-ok' },
  policy: { label: 'A policy question', pill: 'bg-warn-soft text-warn' },
  status: { label: 'A status question', pill: 'bg-idle-soft text-ink-2' },
};

const EXAMPLES = [
  'consulting for a transformation programme',
  'do I need three quotes for a €40,000 order?',
  "what's waiting for me?",
  'where are my requests?',
];

const linkButton = 'text-xs font-medium text-accent-solid hover:underline';
const quietButton = 'text-xs text-ink-3 hover:text-ink-2 hover:underline';

export function SmartCommandBar() {
  const navigate = useNavigate();
  const route = useQuestionRoute();
  const { catalogueAutoApprovalThreshold } = usePolicyConfig();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [understood, setUnderstood] = useState<Understood | null>(null);

  const handleClear = () => {
    setInput('');
    setUnderstood(null);
  };

  const go = (path: string) => {
    navigate(path);
    handleClear();
  };

  const followUp = (query: string) => {
    openAIChatWithPrompt(query);
    handleClear();
  };

  const ask = async (query: string) => {
    const text = query.trim();
    if (!text) return;
    setUnderstood(null);
    setLoading(true);
    let routed;
    try {
      routed = await route(text);
    } finally {
      setLoading(false);
    }
    switch (routed.kind) {
      case 'status': setUnderstood({ kind: 'status', query: text, status: routed.status }); return;
      case 'policy': setUnderstood({ kind: 'policy', query: text, policy: routed.policy }); return;
      case 'catalogue': setUnderstood({ kind: 'catalogue', query: text, items: routed.items.slice(0, 3) }); return;
      case 'demand': setUnderstood({ kind: 'demand', query: text }); return;
      case 'assistant': openAIChatWithPrompt(text); setInput(''); return;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await ask(input);
  };

  const describeInFull = (query: string) => `/requests/new?q=${encodeURIComponent(query)}`;

  return (
    <section
      aria-label="Describe what you need"
      className="flex flex-col gap-3 rounded-xl border border-accent-line bg-card p-5 shadow-[var(--shadow)]"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Sparkles className="size-4 text-accent" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-ink">What do you need?</h2>
        <span className="text-xs text-ink-3">Something to buy, a policy question, or where a request is — ask it in your own words.</span>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={input}
            onChange={(e) => { setInput(e.target.value); setUnderstood(null); }}
            aria-label="What do you need?"
            placeholder="e.g. consulting support for a finance transformation programme"
            className="h-11 bg-card-2 pr-10 text-prose"
          />
          {!loading && (input || understood) && (
            <button type="button" aria-label="Clear" onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink-2">
              <X className="size-4" />
            </button>
          )}
        </div>
        <Button type="submit" className="h-11 px-5" disabled={loading || !input.trim()}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : 'Continue'}
        </Button>
      </form>

      {!understood && !loading && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
          <span>Try:</span>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              className="rounded-full border border-line bg-card-2 px-2.5 py-0.5 text-ink-2 hover:border-accent-line hover:text-accent"
              onClick={() => { setInput(example); void ask(example); }}
            >
              {example}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <p className="flex items-center gap-2 text-xs text-ink-3" role="status">
          <Loader2 className="size-3.5 animate-spin" /> Reading it…
        </p>
      )}

      {understood && !loading && (
        <div className="space-y-2.5 rounded-lg border border-line bg-card-2 px-4 py-3" data-testid="home-answer">
          <div className="flex items-center gap-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-3">Understood as</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${KIND[understood.kind].pill}`}>{KIND[understood.kind].label}</span>
          </div>

          {understood.kind === 'demand' && (
            <>
              <p className="text-sm leading-relaxed text-ink">
                I&apos;ll check the catalogue and existing contracts first, then ask only what is still needed.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm" onClick={() => go(describeInFull(understood.query))}>
                  Start the request <ArrowRight className="size-3.5" />
                </Button>
                <span className="text-xs text-ink-3">Nothing is created until you submit it.</span>
              </div>
            </>
          )}

          {understood.kind === 'catalogue' && (
            <>
              <p className="text-sm leading-relaxed text-ink">
                {understood.items.length === 1 ? 'This is in the catalogue' : `These ${understood.items.length} are in the catalogue`} — no request form, and an order up to {formatCurrency(catalogueAutoApprovalThreshold)} becomes a purchase order straight away.
              </p>
              <div className="space-y-2">
                {understood.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-line bg-card px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{item.name}</p>
                      <p className="mt-0.5 truncate text-xs text-ink-3">
                        {formatCurrency(item.unitPrice)} / {item.unit} · {item.supplierName} · {item.leadTime}
                      </p>
                    </div>
                    {/* Into the basket on the Catalogue page — Door 2, where every
                        catalogue order is placed — never an order on its own. */}
                    <Button size="sm" onClick={() => go(`/catalogue?add=${encodeURIComponent(item.id)}`)}>
                      Order this <ArrowRight className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              {/* The correction, always available and never hidden behind the
                  match: the original wording goes with it, so nothing is retyped. */}
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className={linkButton} onClick={() => go(describeInFull(understood.query))}>
                  Not what you need? Describe it in full →
                </button>
                <button type="button" className={quietButton} onClick={() => go('/catalogue')}>
                  Browse the whole catalogue
                </button>
              </div>
            </>
          )}

          {understood.kind === 'status' && <StatusAnswerView answer={understood.status} onNavigate={handleClear} />}
          {understood.kind === 'policy' && <PolicyAnswerView answer={understood.policy} />}

          {(understood.kind === 'status' || understood.kind === 'policy') && (
            <div className="flex flex-wrap items-center gap-3 pt-0.5">
              <button type="button" className={linkButton} onClick={() => followUp(understood.query)}>
                Ask a follow-up →
              </button>
              {understood.kind === 'policy' && (
                <button type="button" className={quietButton} onClick={() => go(describeInFull(understood.query))}>
                  This is something I need to buy →
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
