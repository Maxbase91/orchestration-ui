// "Your request" — the conversation page's right-hand panel (Intake Prototype):
// every value the request carries, where each came from, and the inputs edited
// in place. It draws request-rows.ts and decides nothing; an edit goes back to
// the page, which writes it where the conversation reads it — so "the assistant
// uses your edit from here on" is true, not a promise.
import { useState, type ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Supplier } from '@/data/types';
import { useCreateProspectiveSupplier } from '@/lib/db/hooks/use-suppliers';
import { UserAutocomplete } from '../components/user-autocomplete';
import { SupplierAutocomplete } from '../components/supplier-autocomplete';
import type { Provenance, RequestGroup, RequestRow, RowEditor } from './request-rows';

const DOT: Record<Provenance, string> = {
  known: 'bg-ok',
  derived: 'bg-accent-solid',
  draft: 'bg-warn',
  pending: 'border-[1.5px] border-ink-3 bg-transparent',
};

const LEGEND: Array<[Provenance, string]> = [
  ['known', 'From you'], ['derived', 'Derived'], ['draft', 'Drafted — check it'], ['pending', 'Still to come'],
];

/** What an editor commits: a string, a number, or a picked record. */
export type EditValue =
  | { kind: 'text'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'user'; id: string; name: string; country?: string; countryCode?: string }
  | { kind: 'supplier'; supplier: Supplier };

interface YourRequestPanelProps {
  groups: RequestGroup[];
  known: number;
  required: number;
  /** The service description's executive summary, once it is written. */
  summary?: string | null;
  /** The written description's quality score and its checklist, from generation. */
  quality?: { score: number; checks: Array<{ section: string; passed: boolean; issue: string | null }> } | null;
  /** The raw value an editor starts from — a section's full text, an ISO date, a cost-centre id. */
  editorValue: (row: RequestRow) => string;
  costCentres: Array<{ id: string; label: string }>;
  deliveryLocations: Array<{ id: string; label: string }>;
  requesterId: string;
  supplierId: string;
  /** What marking the request urgent does to its channel, from the live rules — shown with the toggle. */
  urgencyNote?: ReactNode;
  onEdit: (row: RequestRow, editor: RowEditor, value: EditValue) => void;
}

export function YourRequestPanel(props: YourRequestPanelProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [showChecks, setShowChecks] = useState(false);
  const failed = props.quality?.checks.filter((check) => !check.passed) ?? [];
  const tone = !props.quality ? '' : props.quality.score >= 80 ? 'text-ok' : props.quality.score >= 60 ? 'text-warn' : 'text-stop';
  const complete = props.required > 0 && props.known === props.required;
  const pct = props.required === 0 ? 0 : Math.round((props.known / props.required) * 100);
  return (
    <aside aria-label="Your request" className="flex min-w-0 flex-col border-t border-line bg-card-2 lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-t-0">
      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <h2 className="text-body font-semibold text-ink">Your request</h2>
        <span className="text-caption tabular-nums text-ink-3" aria-live="polite">{props.known} of {props.required} known</span>
      </div>
      <div className="mx-4 mt-2 h-1 overflow-hidden rounded-full bg-idle-soft" aria-hidden="true">
        <div className={cn('h-full rounded-full transition-all duration-500', complete ? 'bg-ok' : 'bg-accent-solid')} style={{ width: `${pct}%` }} />
      </div>
      {/* Where a value came from, as a dot on the row rather than a second line
          under it — the second line is what made the panel scroll. */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-4 pt-2.5 text-eyebrow text-ink-3">
        {LEGEND.map(([kind, label]) => (
          <span key={kind} className="inline-flex items-center gap-1.5">
            <span className={cn('size-[7px] rounded-full', DOT[kind])} aria-hidden="true" />{label}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-3 px-4 pb-4 pt-3">
        {props.groups.map((group) => (
          <div key={group.title}>
            <h3 className="pb-1 text-eyebrow font-semibold uppercase tracking-[0.08em] text-ink-3">{group.title}</h3>
            <div className="flex flex-col">
              {group.rows.map((row) => (
                editing === row.key && row.edit ? (
                  <RowEditorView
                    key={row.key}
                    row={row}
                    editor={row.edit}
                    initial={props.editorValue(row)}
                    costCentres={props.costCentres}
                    deliveryLocations={props.deliveryLocations}
                    requesterId={props.requesterId}
                    supplierId={props.supplierId}
                    note={row.edit.kind === 'toggle' ? props.urgencyNote : undefined}
                    onCommit={(value) => { props.onEdit(row, row.edit!, value); setEditing(null); }}
                    onClose={() => setEditing(null)}
                  />
                ) : (
                  <RowView key={row.key} row={row} onEdit={row.edit ? () => setEditing(row.key) : undefined} />
                )
              ))}
            </div>
          </div>
        ))}
        {props.summary && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-card px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-eyebrow font-semibold uppercase tracking-[0.08em] text-ink-3">Service description — executive summary</span>
              {/* The score generation returns, with what it failed one click
                  down — the checklist is how a thin section gets noticed before
                  a reviewer does. */}
              {props.quality && (
                <button
                  type="button"
                  onClick={() => setShowChecks((open) => !open)}
                  aria-expanded={showChecks}
                  disabled={failed.length === 0}
                  className={cn('shrink-0 text-caption font-semibold tabular-nums', tone, failed.length > 0 && 'underline-offset-2 hover:underline')}
                >
                  Quality {props.quality.score}/100{failed.length > 0 ? ` · ${failed.length} ${failed.length === 1 ? 'issue' : 'issues'}` : ''}
                </button>
              )}
            </div>
            <p className="whitespace-pre-line text-caption leading-relaxed text-ink-2">{props.summary}</p>
            {showChecks && failed.length > 0 && (
              <ul className="flex flex-col gap-1 border-t border-line-2 pt-1.5">
                {failed.map((check) => (
                  <li key={check.section} className="text-caption text-ink-2">
                    <span className="font-medium text-ink">{check.section}</span>{check.issue ? ` — ${check.issue}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function RowView({ row, onEdit }: { row: RequestRow; onEdit?: () => void }) {
  const body = (
    <>
      <span className={cn('mt-[5px] size-[7px] shrink-0 rounded-full', DOT[row.provenance])} aria-hidden="true" />
      <span className="w-24 shrink-0 text-caption text-ink-3">{row.label}</span>
      <span className={cn('min-w-0 flex-1 truncate text-caption', row.provenance === 'pending' ? 'italic text-ink-3' : 'text-ink')}>{row.value}</span>
      {onEdit && <Pencil className="mt-0.5 size-3 shrink-0 text-ink-3" aria-hidden="true" />}
    </>
  );
  const tooltip = `${row.value} — ${row.source}`;
  // Only an input is a button: a row the platform decides says where it came
  // from on hover and cannot be typed over.
  return onEdit ? (
    <button
      type="button"
      onClick={onEdit}
      title={tooltip}
      aria-label={`Edit ${row.label}`}
      data-row={row.key}
      className="flex w-full items-start gap-2 rounded-md px-1 py-1.5 text-left hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {body}
    </button>
  ) : (
    <div title={tooltip} data-row={row.key} className="flex w-full items-start gap-2 px-1 py-1.5">{body}</div>
  );
}

function RowEditorView(props: {
  row: RequestRow;
  editor: RowEditor;
  initial: string;
  costCentres: Array<{ id: string; label: string }>;
  deliveryLocations: Array<{ id: string; label: string }>;
  requesterId: string;
  supplierId: string;
  note?: ReactNode;
  onCommit: (value: EditValue) => void;
  onClose: () => void;
}) {
  const { row, editor } = props;
  const [draft, setDraft] = useState(props.initial);
  const createProspective = useCreateProspectiveSupplier();
  const id = `edit-${row.key.replace(/[^a-z0-9]/gi, '-')}`;
  const commit = () => {
    if (editor.kind === 'money') {
      const amount = Number(draft.replace(/[€,\s]/g, ''));
      if (Number.isFinite(amount) && amount >= 0) props.onCommit({ kind: 'number', value: amount });
      else props.onClose();
      return;
    }
    props.onCommit({ kind: 'text', value: draft });
  };

  let control: ReactNode;
  switch (editor.kind) {
    case 'beneficiary':
      control = (
        <UserAutocomplete
          selectedId={props.initial || undefined}
          placeholder="Type a name…"
          onSelect={(user) => props.onCommit({ kind: 'user', id: user.id, name: user.name, country: user.country, countryCode: user.countryCode })}
        />
      );
      break;
    case 'supplier':
      control = (
        <SupplierAutocomplete
          value={props.initial}
          supplierId={props.supplierId}
          onSelect={(supplier) => props.onCommit({ kind: 'supplier', supplier })}
          // A vendor the directory does not hold is created as a prospective
          // supplier — which is what makes vendor onboarding expressible.
          onCreateProspective={async (name) => {
            const created = await createProspective.mutateAsync({ name });
            props.onCommit({ kind: 'supplier', supplier: created });
          }}
        />
      );
      break;
    case 'cost-centre':
    case 'delivery-location': {
      const options = editor.kind === 'cost-centre' ? props.costCentres : props.deliveryLocations;
      control = (
        <select id={id} value={draft} onChange={(e) => setDraft(e.target.value)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-caption text-ink">
          {!options.some((o) => o.id === draft) && <option value="">Choose…</option>}
          {options.map((o) => <option key={o.id} value={o.id}>{editor.kind === 'cost-centre' ? `${o.id} · ${o.label}` : o.label}</option>)}
        </select>
      );
      break;
    }
    case 'toggle':
      control = (
        <select id={id} value={draft} onChange={(e) => setDraft(e.target.value)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-caption text-ink">
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      );
      break;
    case 'date':
      control = <Input id={id} type="date" value={draft} onInput={(e) => setDraft(e.currentTarget.value)} onChange={(e) => setDraft(e.target.value)} className="h-8 text-caption" />;
      break;
    case 'money':
      control = <Input id={id} inputMode="numeric" value={draft} onChange={(e) => setDraft(e.target.value)} className="h-8 text-caption" />;
      break;
    case 'section':
      control = <Textarea id={id} value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} className="text-caption" />;
      break;
    case 'text':
      control = draft.length > 60
        ? <Textarea id={id} value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} className="text-caption" />
        : <Input id={id} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} className="h-8 text-caption" />;
      break;
  }
  const picks = editor.kind === 'beneficiary' || editor.kind === 'supplier';
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-accent-line bg-card px-2.5 py-2" data-editing={row.key}>
      <label htmlFor={id} className="text-caption font-medium text-ink-2">{row.label}</label>
      {control}
      {props.note}
      <div className="flex items-center justify-between gap-2">
        {picks
          ? <Button size="sm" variant="ghost" className="h-7 px-2 text-caption" onClick={props.onClose}>Cancel</Button>
          : <Button size="sm" className="h-7 px-3 text-caption" onClick={commit}>Done</Button>}
        <span className="text-eyebrow text-ink-3">{row.source} · the assistant uses your edit from here on.</span>
      </div>
    </div>
  );
}
