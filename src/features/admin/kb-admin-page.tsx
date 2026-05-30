import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Save, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

interface KBEntry {
  id: string;
  title: string;
  body: string;
  source: string;
  tags: string[];
}

function generateId(): string {
  return `KB-${String(Math.floor(Math.random() * 9000) + 1000)}`;
}

function EntryForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: KBEntry | null;
  onSave: (entry: KBEntry) => void;
  onCancel: () => void;
}) {
  const [id, setId] = useState(initial?.id ?? generateId());
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [source, setSource] = useState(initial?.source ?? '');
  const [tags, setTags] = useState(initial?.tags.join(', ') ?? '');

  const valid = title.trim().length > 0 && body.trim().length > 0;

  function submit() {
    if (!valid) return;
    onSave({
      id: id.trim() || generateId(),
      title: title.trim(),
      body: body.trim(),
      source: source.trim(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    });
  }

  return (
    <Card className="p-5 space-y-4 border-[#1B2A4A]/20 ring-1 ring-[#1B2A4A]/10">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-800">{initial ? 'Edit entry' : 'New entry'}</p>
        <button onClick={onCancel} className="rounded p-1 text-gray-400 hover:text-gray-600">
          <X className="size-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">ID</label>
          <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="KB-001" className="h-8 text-sm font-mono" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Source / policy reference</label>
          <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Procurement Policy v3.1 — Section 4" className="h-8 text-sm" />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-500">Title *</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Approval thresholds" className="h-8 text-sm" />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-500">Body * (markdown supported)</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
          placeholder="Policy body…"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-500">Tags (comma-separated)</label>
        <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="threshold, approval, limit" className="h-8 text-sm" />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" disabled={!valid} onClick={submit} className="bg-[#1B2A4A] hover:bg-[#273957] text-white">
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
}: {
  entry: KBEntry;
  onEdit: (e: KBEntry) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-gray-100 last:border-0">
      <div className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50/60">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-0.5 shrink-0 text-gray-400 hover:text-gray-600"
        >
          {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="shrink-0 font-mono text-[11px] text-gray-400">{entry.id}</span>
            <span className="truncate text-sm font-medium text-gray-800">{entry.title}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {entry.tags.slice(0, 6).map((t) => (
              <span key={t} className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{t}</span>
            ))}
          </div>
          {expanded && (
            <div className="mt-2 space-y-1.5">
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-gray-600">{entry.body}</p>
              {entry.source && (
                <p className="text-[10px] text-gray-400 italic">Source: {entry.source}</p>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => onEdit(entry)}
            className="flex size-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            title="Edit"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            onClick={() => onDelete(entry.id)}
            className="flex size-7 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
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
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KBEntry | null>(null);
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('knowledge_base')
      .select('id, title, body, source, tags')
      .order('id', { ascending: true });
    setEntries((data ?? []) as KBEntry[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function handleSave(entry: KBEntry) {
    await supabase
      .from('knowledge_base')
      .upsert({ ...entry, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    setShowForm(false);
    setEditingEntry(null);
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm(`Delete entry ${id}?`)) return;
    await supabase.from('knowledge_base').delete().eq('id', id);
    await load();
  }

  const filtered = entries.filter(
    (e) =>
      !search ||
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const formEntry = editingEntry;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Knowledge Base Management"
        subtitle="Entries in Supabase override the built-in KB. The AI assistant uses these first."
      />

      {entries.length === 0 && !loading && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Built-in KB active.</strong> No entries in Supabase yet — the assistant is using the hardcoded knowledge base. Add entries here to override or supplement it.
        </div>
      )}

      <div className="flex items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by title or tag…"
          className="h-9 max-w-xs"
        />
        <Button
          size="sm"
          className="ml-auto bg-[#1B2A4A] hover:bg-[#273957] text-white"
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
        />
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
          <BookOpen className="size-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">
            {loading ? 'Loading…' : `${filtered.length} ${filtered.length === 1 ? 'entry' : 'entries'}`}
          </span>
        </div>
        {loading ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">
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
                  />
                </div>
              ) : (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  onEdit={(e) => { setShowForm(false); setEditingEntry(e); }}
                  onDelete={handleDelete}
                />
              )
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
