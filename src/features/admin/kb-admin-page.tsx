// Admin — knowledge base management. CRUD over the `knowledge_base`
// table; entries here replace the built-in KB and are what the assistant, the
// Home box and the Help pages answer from. The topic and order place an entry
// on the Help page.
//
// An entry names a governed figure ({{policy:…}}, {{approval-chains}},
// {{preferred-suppliers:…}}) instead of restating it, so it cannot drift from
// the configuration. Each entry says whether it is linked to configuration or
// is policy text only, and a reference that names nothing is flagged here
// rather than shown to a requester as a raw token.

import { useMemo, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, X, Save, BookOpen, ChevronDown, ChevronUp, Link2, AlertTriangle } from 'lucide-react';
import type { KBEntry } from '@/lib/db/knowledge-base';
import {
  useKnowledgeBase,
  useKnowledgeContext,
  useSaveKnowledgeBaseEntry,
  useDeleteKnowledgeBaseEntry,
} from '@/lib/db/hooks/use-knowledge-base';
import {
  knowledgeLinks, renderKnowledgeBody, availableKnowledgeTokens,
  type KnowledgeContext, type KnowledgeLink,
} from '@/lib/procurement/knowledge-links';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';


/** "Linked to configuration" with what it links to, or "Policy text only". */
function LinkBadges({ links }: { links: KnowledgeLink[] }) {
  const valid = links.filter((l) => l.valid);
  const invalid = links.filter((l) => !l.valid);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {valid.length > 0 ? (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] text-accent"
          title={valid.map((l) => l.label).join(' · ')}
        >
          <Link2 className="size-3" /> Linked to configuration · {valid.length}
        </span>
      ) : (
        <span className="rounded-full bg-idle-soft px-1.5 py-0.5 text-[10px] text-ink-3" title="Its figures are policy text; no platform check reads them.">
          Policy text only
        </span>
      )}
      {invalid.map((l) => (
        <span key={l.token} className="inline-flex items-center gap-1 rounded-full bg-stop-soft px-1.5 py-0.5 font-mono text-[10px] text-stop">
          <AlertTriangle className="size-3" /> {l.token} names nothing
        </span>
      ))}
    </div>
  );
}

/**
 * The next free id after the highest stored one. It was a random KB-1000…9999,
 * which could land on an existing entry — and the save upserts on id, so it
 * would have replaced that entry without a word.
 */
function nextId(existingIds: readonly string[]): string {
  const highest = Math.max(0, ...existingIds.map((id) => Number(/^KB-(\d+)$/.exec(id)?.[1] ?? 0)));
  return `KB-${String(highest + 1).padStart(3, '0')}`;
}

function EntryForm({
  initial,
  onSave,
  onCancel,
  ctx,
  categoryIds,
  existingIds,
  topics,
}: {
  initial: KBEntry | null;
  onSave: (entry: KBEntry) => void;
  onCancel: () => void;
  ctx: KnowledgeContext | undefined;
  /** Undefined until the configuration loads — then nothing is flagged yet. */
  categoryIds: ReadonlySet<string> | undefined;
  existingIds: readonly string[];
  /** The topics in use, offered so an entry joins one rather than coining a near-duplicate. */
  topics: readonly string[];
}) {
  const [id, setId] = useState(initial?.id ?? nextId(existingIds));
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [source, setSource] = useState(initial?.source ?? '');
  const [tags, setTags] = useState(initial?.tags.join(', ') ?? '');
  const [topic, setTopic] = useState(initial?.topic ?? '');
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const links = knowledgeLinks(body, categoryIds);
  // A reference that names nothing would reach a requester as a raw token.
  const valid = title.trim().length > 0 && body.trim().length > 0 && links.every((l) => l.valid);
  const tokens = useMemo(() => availableKnowledgeTokens([...(categoryIds ?? [])]), [categoryIds]);

  // Insert at the cursor, so a figure lands where the sentence needs it.
  function insertToken(token: string) {
    const el = bodyRef.current;
    const at = el?.selectionStart ?? body.length;
    setBody(`${body.slice(0, at)}${token}${body.slice(at)}`);
  }

  function submit() {
    if (!valid) return;
    onSave({
      id: id.trim() || nextId(existingIds),
      title: title.trim(),
      body: body.trim(),
      source: source.trim(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      topic: topic.trim(),
      sortOrder: Number(sortOrder) || 0,
    });
  }

  return (
    <Card className="p-5 space-y-4 border-accent-line ring-1 ring-accent-line">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink">{initial ? 'Edit entry' : 'New entry'}</p>
        <button onClick={onCancel} className="rounded p-1 text-ink-3 hover:text-ink-2">
          <X className="size-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-3">ID</label>
          <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="KB-001" className="h-8 text-sm font-mono" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-3">Source / policy reference</label>
          <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Procurement Policy v3.1 — Section 4" className="h-8 text-sm" />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-ink-3">Title *</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Approval thresholds" className="h-8 text-sm" />
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <div className="space-y-1">
          <label htmlFor="kb-topic" className="text-xs font-medium text-ink-3">Topic — groups it on the Help page</label>
          <Input id="kb-topic" list="kb-topics" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Getting started" className="h-8 text-sm" />
          <datalist id="kb-topics">{topics.map((t) => <option key={t} value={t} />)}</datalist>
        </div>
        <div className="space-y-1">
          <label htmlFor="kb-order" className="text-xs font-medium text-ink-3">Order</label>
          <Input id="kb-order" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="h-8 text-sm tabular-nums" />
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="kb-body" className="text-xs font-medium text-ink-3">Body * — link a governed figure instead of typing it</label>
          <select
            aria-label="Insert a figure from configuration"
            className="h-7 max-w-64 rounded-md border border-input bg-background px-2 text-xs"
            value=""
            onChange={(e) => { if (e.target.value) insertToken(e.target.value); }}
          >
            <option value="">Insert a figure…</option>
            {tokens.map((t) => <option key={t.token} value={t.token}>{t.label}</option>)}
          </select>
        </div>
        <textarea
          id="kb-body"
          ref={bodyRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
          placeholder="Policy body…"
        />
        <LinkBadges links={links} />
        {ctx && links.length > 0 && (
          <div className="rounded-md border border-line bg-card-2 p-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-3">As the requester reads it</p>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-ink-2">{renderKnowledgeBody(body, ctx).text}</p>
          </div>
        )}
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-ink-3">Tags (comma-separated)</label>
        <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="threshold, approval, limit" className="h-8 text-sm" />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" disabled={!valid} onClick={submit} className="bg-accent-solid hover:bg-accent-solid/90 text-paper">
          <Save className="mr-1.5 size-3.5" />
          Save entry
        </Button>
      </div>
    </Card>
  );
}

function EntryRow({
  entry,
  onEdit,
  onDelete,
  ctx,
  categoryIds,
}: {
  entry: KBEntry;
  onEdit: (e: KBEntry) => void;
  onDelete: (id: string) => void;
  ctx: KnowledgeContext | undefined;
  /** Undefined until the configuration loads — then nothing is flagged yet. */
  categoryIds: ReadonlySet<string> | undefined;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-line-2 last:border-0">
      <div className="flex items-start gap-3 px-5 py-3.5 hover:bg-card-2/60">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-0.5 shrink-0 text-ink-3 hover:text-ink-2"
        >
          {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="shrink-0 font-mono text-[11px] text-ink-3">{entry.id}</span>
            <span className="truncate text-sm font-medium text-ink">{entry.title}</span>
            {entry.topic
              ? <span className="shrink-0 text-[11px] text-ink-3">· {entry.topic}</span>
              : <span className="shrink-0 text-[11px] text-warn">· no topic — listed under More on the Help page</span>}
          </div>
          <div className="mt-1"><LinkBadges links={knowledgeLinks(entry.body, categoryIds)} /></div>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {entry.tags.slice(0, 6).map((t) => (
              <span key={t} className="rounded-full bg-idle-soft px-1.5 py-0.5 text-[10px] text-ink-3">{t}</span>
            ))}
          </div>
          {expanded && (
            <div className="mt-2 space-y-1.5">
              {/* What a requester reads — figures from the live configuration. */}
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-ink-2">
                {ctx ? renderKnowledgeBody(entry.body, ctx).text : entry.body}
              </p>
              {entry.source && (
                <p className="text-[10px] text-ink-3 italic">Source: {entry.source}</p>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => onEdit(entry)}
            className="flex size-7 items-center justify-center rounded text-ink-3 hover:bg-idle-soft hover:text-ink-2 transition-colors"
            title="Edit"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            onClick={() => onDelete(entry.id)}
            className="flex size-7 items-center justify-center rounded text-ink-3 hover:bg-stop-soft hover:text-stop transition-colors"
            title="Delete"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function KBAdminPage() {
  // Data access goes through the entity hooks like every other screen, rather
  // than a hand-rolled useEffect + useState fetch: the query owns loading and
  // refetching, and the mutations invalidate it, so there is no effect here at
  // all and no manual `load()` to remember to call.
  const { data: entries = [], isLoading: loading } = useKnowledgeBase();
  const saveEntry = useSaveKnowledgeBaseEntry();
  const deleteEntry = useDeleteKnowledgeBaseEntry();
  const { data: ctx } = useKnowledgeContext();
  const categoryIds = useMemo(() => (ctx ? new Set(Object.keys(ctx.categoryLabels)) : undefined), [ctx]);

  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KBEntry | null>(null);
  const [search, setSearch] = useState('');

  async function handleSave(entry: KBEntry) {
    await saveEntry.mutateAsync(entry);
    setShowForm(false);
    setEditingEntry(null);
  }

  async function handleDelete(id: string) {
    if (!confirm(`Delete entry ${id}?`)) return;
    await deleteEntry.mutateAsync(id);
  }

  const filtered = entries.filter(
    (e) =>
      !search ||
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.topic.toLowerCase().includes(search.toLowerCase()) ||
      e.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );
  const existingIds = entries.map((e) => e.id);
  const topics = [...new Set(entries.map((e) => e.topic).filter(Boolean))];

  const formEntry = editingEntry;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Knowledge Base Management"
        subtitle="What the assistant, the Home box and the Help pages answer from. Link a governed figure instead of typing it, so the answer always matches what the platform does."
      />

      {entries.length === 0 && !loading && (
        <div className="rounded-xl border border-warn-line bg-warn-soft px-4 py-3 text-sm text-warn">
          <strong>Built-in KB active.</strong> No stored entries yet — the assistant is using the built-in knowledge base. Add entries here to override or supplement it.
        </div>
      )}

      <div className="flex items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by title, topic or tag…"
          className="h-9 max-w-xs"
        />
        <Button
          size="sm"
          className="ml-auto bg-accent-solid hover:bg-accent-solid/90 text-paper"
          onClick={() => { setEditingEntry(null); setShowForm(true); }}
        >
          <Plus className="mr-1.5 size-3.5" />
          Add entry
        </Button>
      </div>

      {(showForm && !editingEntry) && (
        <EntryForm
          initial={null}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
          ctx={ctx}
          categoryIds={categoryIds}
          existingIds={existingIds}
          topics={topics}
        />
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line-2 px-5 py-3">
          <BookOpen className="size-4 text-ink-3" />
          <span className="text-sm font-medium text-ink-2">
            {loading ? 'Loading…' : `${filtered.length} ${filtered.length === 1 ? 'entry' : 'entries'}`}
          </span>
        </div>
        {loading ? (
          <p className="px-5 py-8 text-center text-sm text-ink-3">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-3">
            {search ? 'No entries match your filter.' : 'No entries yet. Add your first entry above.'}
          </p>
        ) : (
          <div>
            {filtered.map((entry) =>
              editingEntry?.id === entry.id ? (
                <div key={entry.id} className="p-4">
                  <EntryForm
                    initial={formEntry}
                    onSave={handleSave}
                    onCancel={() => setEditingEntry(null)}
                    ctx={ctx}
                    categoryIds={categoryIds}
                    existingIds={existingIds}
                    topics={topics}
                  />
                </div>
              ) : (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  onEdit={(e) => { setShowForm(false); setEditingEntry(e); }}
                  onDelete={handleDelete}
                  ctx={ctx}
                  categoryIds={categoryIds}
                />
              )
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
