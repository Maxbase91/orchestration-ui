// Help → Knowledge base: the knowledge base as a reader sees it — the same
// entries the assistant and the Home box answer from, grouped by topic, with
// every governed figure rendered from the live configuration.
//
// It was twelve articles written into this file. Several described what the
// platform does not do (a Direct PO channel, a supplier-onboarding request,
// email escalation after three days, round-robin assignment), and its "Was this
// helpful?" buttons recorded nothing. The articles are knowledge-base entries
// now, corrected, and edited under Admin → KB Management like the rest.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronDown, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { useKnowledgeBase, useKnowledgeContext } from '@/lib/db/hooks/use-knowledge-base';
import { renderKnowledgeBody, stripKnowledgeTokens } from '@/lib/procurement/knowledge-links';
import { knowledgeBase as builtInKnowledge } from '@/data/knowledge-base';
import { helpTopics, matchesHelpSearch } from './knowledge-topics';

export function KnowledgeBasePage() {
  const { data: stored, isLoading, isError } = useKnowledgeBase();
  const { data: ctx, isError: figuresFailed } = useKnowledgeContext();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  // The pool the assistant answers from (capabilities/knowledge.ts
  // `knowledgePool`): the stored entries, else the built-in set — replaced, not
  // merged, so an entry an admin deleted is gone here too.
  const entries = useMemo(() => (stored && stored.length > 0 ? stored : builtInKnowledge), [stored]);

  // What the reader sees, and what search runs over. Without the configuration
  // the references are left out of the text rather than shown raw.
  const text = useMemo(
    () => new Map(entries.map((e) => [e.id, ctx ? renderKnowledgeBody(e.body, ctx).text : stripKnowledgeTokens(e.body)])),
    [entries, ctx],
  );

  const topics = useMemo(
    () => helpTopics(entries.filter((e) => matchesHelpSearch(e, text.get(e.id) ?? '', search))),
    [entries, text, search],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" /> <span className="text-sm">Loading the knowledge base…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge Base"
        subtitle="How buying works here, and the policies behind it — the same answers the assistant gives, with figures from the live configuration."
      />

      <div className="space-y-2">
        <div className="relative max-w-lg">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            aria-label="Search the knowledge base"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search — e.g. quotes, catalogue, delegation"
            className="pl-10"
          />
        </div>
        <p className="text-xs text-ink-3">
          Can&apos;t find it? <Link to="/help/assistant" className="text-accent hover:underline">Ask the assistant</Link>
          {' '}or <Link to="/help/support" className="text-accent hover:underline">contact support</Link>.
        </p>
      </div>

      {/* Both are said, not hidden: an answer from the built-in set, or with its
          figures missing, is still an answer — but the reader should know. */}
      {isError && (
        <p className="rounded-md border border-warn-line bg-warn-soft px-3 py-2 text-xs text-warn">
          The knowledge base could not be loaded, so these are the built-in articles.
        </p>
      )}
      {figuresFailed && (
        <p className="rounded-md border border-warn-line bg-warn-soft px-3 py-2 text-xs text-warn">
          The current figures could not be loaded, so they are left out of the articles.
        </p>
      )}

      <div className="space-y-6">
        {topics.map((topic) => (
          <section key={topic.name} aria-labelledby={`topic-${topic.name}`}>
            <h2 id={`topic-${topic.name}`} className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink">
              {topic.name}
            </h2>
            {/* One list per topic: a card per entry spent ~100px on a single
                line of title, so thirty-odd entries were several screens. */}
            <Card className="gap-0 divide-y divide-line-2 overflow-hidden py-0">
              {topic.entries.map((entry) => {
                const expanded = open === entry.id || (search.trim() !== '' && topics.length === 1 && topic.entries.length === 1);
                return (
                  <div key={entry.id}>
                    <button
                      className="flex w-full items-center justify-between gap-4 px-5 py-3 text-left hover:bg-card-2"
                      aria-expanded={expanded}
                      aria-controls={`kb-${entry.id}`}
                      onClick={() => setOpen((prev) => (prev === entry.id ? null : entry.id))}
                    >
                      <span className="text-sm font-medium text-ink">{entry.title}</span>
                      <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                    {expanded && (
                      <div id={`kb-${entry.id}`} className="space-y-3 bg-card-2/40 px-5 pb-4 pt-1">
                        <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-ink-2">{text.get(entry.id)}</p>
                        {entry.source && <p className="text-xs text-ink-3">Source: {entry.source}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
          </section>
        ))}
        {topics.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No articles match “{search.trim()}”.
          </div>
        )}
      </div>
    </div>
  );
}
