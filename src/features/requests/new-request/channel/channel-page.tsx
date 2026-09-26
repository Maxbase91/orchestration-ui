// The Channel page's layout (Intake Prototype, "Door 1 — channel, then submit"):
// how this will be bought and every stage it goes through on the left, what is
// being submitted and the checks on the right, and Submit with what happens
// next. It draws a plan and decides nothing — the wrappers
// (step-channel-request.tsx, step-channel-call-off.tsx) supply the plan from the
// rules submit uses, and the checks from the object submit records.
import type { ReactNode } from 'react';
import { ArrowLeft, Loader2, Save, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import type { PolicyConfig } from '@/lib/procurement/policy-config';
import type { ChannelCheck } from '@/lib/procurement/channel-checks';
import {
  applicabilityTag,
  applyCountLabel,
  type ApplicabilityHints,
  type ChannelPlan,
  type PlannedStage,
} from '@/lib/workflow/channel-plan';

const TAG_TONE: Record<PlannedStage['applicability']['kind'], string> = {
  here: 'bg-accent-soft text-accent',
  applies: 'bg-ok-soft text-ok',
  conditional: 'bg-warn-soft text-warn',
  skipped: 'bg-idle-soft text-ink-3',
};

const CHECK_DOT: Record<ChannelCheck['tone'], string> = {
  ok: 'bg-ok', warn: 'bg-warn', stop: 'bg-stop', neutral: 'bg-idle',
};

interface ChannelPageProps {
  headline: string;
  detail: string;
  /** "WF-001 Standard Procurement" — where the stages come from. */
  templateName: string | null;
  plan: ChannelPlan | null;
  loading: boolean;
  value: number;
  config: PolicyConfig;
  hints: ApplicabilityHints;
  backLabel: string;
  onBack: () => void;
  submitLabel: string;
  submitNote: string;
  onSubmit: () => void;
  canSubmit: boolean;
  submitting: boolean;
  onSaveDraft?: () => void;
  changeLabel: string;
  onChange: () => void;
  /** The right-hand panel below its header: summary, supplier, checks. */
  children: ReactNode;
}

export function ChannelPage(props: ChannelPageProps) {
  const { plan } = props;
  return (
    <div className="grid overflow-hidden rounded-xl border border-line bg-card shadow-[var(--shadow)] lg:grid-cols-[minmax(0,1fr)_400px]">
      <section aria-label="How it will be bought" className="flex min-w-0 flex-col">
        <div className="flex flex-col gap-4 p-6">
          {/* The navy of the navigation rail: this band is the page's one
              statement, and it reads the same in both themes. */}
          <div className="grid items-end gap-x-6 gap-y-3 rounded-xl bg-gradient-to-br from-navy-800 to-navy-900 px-5 py-4 text-white md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-eyebrow uppercase tracking-[0.1em] text-navy-200">How this will be bought</span>
              <h2 className="text-heading font-bold tracking-tight text-balance">{props.headline}</h2>
              {props.detail && <p className="text-caption text-navy-200">{props.detail}</p>}
            </div>
            <dl className="flex gap-6">
              <Figure label="Value" value={formatCurrency(props.value)} />
              <Figure label="Stages that apply" value={plan ? applyCountLabel(plan) : '—'} />
              <Figure label="Stage targets" value={plan?.targetDays != null ? `${plan.targetDays}d` : '—'} />
            </dl>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="text-body font-semibold text-ink">
              Step by step
              {props.templateName && <span className="font-normal text-ink-3"> · {props.templateName}</span>}
            </h3>
            <span className="text-caption text-ink-3">Stage · what it is for · owner · target working days — from the workflow template</span>
          </div>

          {props.loading ? (
            <p className="flex items-center gap-2 py-6 text-caption text-ink-3" role="status">
              <Loader2 className="size-3.5 animate-spin" /> Reading the workflow…
            </p>
          ) : !plan ? (
            // Nothing claims the channel. Said, rather than drawing another
            // channel's stages — the Designer reports the gap to the admin.
            <p className="rounded-lg border border-warn-line bg-warn-soft px-4 py-3 text-caption text-warn">
              No workflow template runs this channel yet, so its stages cannot be shown. An administrator assigns one in the Workflow Designer.
            </p>
          ) : (
            <ol aria-label="Stages" className="flex flex-col">
              {plan.stages.map((stage, index) => (
                <StageRow key={stage.node.id} stage={stage} n={index + 1} config={props.config} hints={props.hints} />
              ))}
            </ol>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-1.5 border-t border-line bg-card-2 px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" onClick={props.onBack}>
              <ArrowLeft className="size-4" /> {props.backLabel}
            </Button>
            <div className="flex items-center gap-2">
              {props.onSaveDraft && (
                <Button variant="ghost" onClick={props.onSaveDraft} disabled={props.submitting}>
                  <Save className="size-4" /> Save as draft
                </Button>
              )}
              <Button onClick={props.onSubmit} disabled={!props.canSubmit || props.submitting}>
                {props.submitting
                  ? <><Loader2 className="size-4 animate-spin" /> Submitting…</>
                  : <><Send className="size-4" /> {props.submitLabel}</>}
              </Button>
            </div>
          </div>
          {/* Under the button it describes, so it never pushes the button
              onto a line of its own. */}
          <p className="text-right text-caption text-ink-3">{props.submitNote}</p>
        </div>
      </section>

      <aside aria-label="What you are submitting" className="flex min-w-0 flex-col border-t border-line bg-card-2 lg:border-l lg:border-t-0">
        <div className="flex items-center justify-between gap-3 border-b border-line-2 px-4 py-2.5">
          <h2 className="text-body font-semibold text-ink">What you are submitting</h2>
          <button type="button" onClick={props.onChange} className="text-caption font-medium text-accent hover:underline">
            {props.changeLabel}
          </button>
        </div>
        <div className="flex flex-col gap-4 px-4 py-3">{props.children}</div>
      </aside>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-eyebrow uppercase tracking-[0.08em] text-navy-200">{label}</dt>
      <dd className="mt-0.5 text-heading font-bold tabular-nums">{value}</dd>
    </div>
  );
}

function StageRow({ stage, n, config, hints }: { stage: PlannedStage; n: number; config: PolicyConfig; hints: ApplicabilityHints }) {
  const kind = stage.applicability.kind;
  const tag = applicabilityTag(stage.applicability, config, hints);
  const { node } = stage;
  return (
    <li
      data-stage={stage.status}
      data-applicability={kind}
      className={cn(
        'grid grid-cols-[28px_minmax(0,1fr)_minmax(0,150px)_44px] items-center gap-3 border-b border-line-2 py-2.5 last:border-b-0',
        kind === 'skipped' && 'opacity-70',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-6 items-center justify-center rounded-full text-eyebrow font-semibold tabular-nums',
          kind === 'here' ? 'bg-accent-solid text-paper ring-[3px] ring-accent-soft'
            : kind === 'skipped' ? 'border-[1.5px] border-dashed border-line bg-card text-ink-3'
              : 'border-[1.5px] border-line bg-card text-ink-3',
        )}
      >
        {n}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn('text-body font-semibold text-ink', kind === 'skipped' && 'text-ink-3 line-through')}>{node.label}</span>
          {tag && <span className={cn('whitespace-nowrap rounded-full px-2 py-px text-eyebrow font-medium', TAG_TONE[kind])}>{tag}</span>}
        </span>
        {node.purpose && <span className="truncate text-caption text-ink-2" title={node.purpose}>{node.purpose}</span>}
        {/* What the requester does here, from the stage itself — never on a
            stage this request skips. */}
        {node.requesterAction && kind !== 'skipped' && (
          <span className="text-caption text-accent">You: {node.requesterAction}</span>
        )}
      </span>
      <span className="truncate text-caption text-ink-3" title={node.role}>{node.role ?? '—'}</span>
      <span className="text-right font-mono text-caption tabular-nums text-ink-2">
        {kind === 'skipped' || node.slaDays == null ? '—' : `${node.slaDays}d`}
      </span>
    </li>
  );
}

// ── The right-hand panel's pieces ────────────────────────────────────────────

export function PanelGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <h3 className="pb-1 text-eyebrow font-semibold uppercase tracking-[0.08em] text-ink-3">{title}</h3>
      {children}
    </div>
  );
}

export function FactList({ rows }: { rows: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl>
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[96px_minmax(0,1fr)] gap-2 border-b border-line-2 py-1.5 last:border-b-0">
          <dt className="text-caption text-ink-3">{row.label}</dt>
          <dd className="text-caption text-ink [overflow-wrap:anywhere]">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SupplierList({ title, items, note }: {
  title: string;
  items: Array<{ id: string; name: string; tag: string; tone: 'ok' | 'accent' | 'idle' }>;
  note?: string;
}) {
  const tone = { ok: 'bg-ok-soft text-ok', accent: 'bg-accent-soft text-accent', idle: 'bg-idle-soft text-ink-3' };
  return (
    <div className="flex flex-col gap-1.5 pt-2">
      {items.length > 0 && <span className="text-caption text-ink-3">{title}</span>}
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-2 rounded-md border border-line bg-card px-2.5 py-1.5">
          <span className="truncate text-caption font-medium text-ink">{item.name}</span>
          <span className={cn('whitespace-nowrap rounded-full px-2 py-px text-eyebrow font-medium', tone[item.tone])}>{item.tag}</span>
        </div>
      ))}
      {note && <p className="text-caption leading-relaxed text-ink-3">{note}</p>}
    </div>
  );
}

export function ChecksList({ checks }: { checks: ChannelCheck[] }) {
  return (
    <ul aria-label="Checks" className="flex flex-col gap-2">
      {checks.map((check) => (
        <li key={`${check.verdict}:${check.reason}`} className="grid grid-cols-[8px_minmax(0,1fr)] gap-x-2.5">
          <span aria-hidden="true" className={cn('mt-[7px] size-2 rounded-full', CHECK_DOT[check.tone])} />
          <span className="flex flex-col">
            <span className="text-caption font-semibold text-ink">{check.verdict}</span>
            <span className="text-caption leading-relaxed text-ink-2">{check.reason}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
