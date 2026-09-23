// The one area of the dashboard the platform owns.
//
// Everything else on this screen is a widget the user placed, and every widget
// is the same card, so nothing could be emphasised: "Suppliers Blocking Work"
// and "Monthly Summary" carried identical weight whether or not either had
// anything in it. This band sits above the grid, cannot be moved or removed,
// and shows only what is waiting on the person reading it.
//
// Two rules it exists to keep:
//   · It is absent when there is nothing — no "all clear" card taking a row to
//     say nothing happened.
//   · It is never absent because a read failed. Silence has to mean "checked,
//     nothing found"; a band that disappears on an unreadable table would say
//     "nothing needs you" about a queue it never saw.
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useApprovals } from '@/lib/db/hooks/use-approvals';
import { useRequests } from '@/lib/db/hooks/use-requests';
import {
  approvalsAwaiting, overdueOnMyPlate, referredBackToMe,
} from '@/lib/procurement/personal-queue';

/** Ordered by how much the delay costs: late, then blocked, then queued. */
interface Item {
  key: string;
  count: number;
  label: string;
  to: string;
  tone: 'stop' | 'warn' | 'accent';
}

const TONE: Record<Item['tone'], { dot: string; text: string }> = {
  stop: { dot: 'bg-stop', text: 'text-stop' },
  warn: { dot: 'bg-warn', text: 'text-warn' },
  accent: { dot: 'bg-accent', text: 'text-accent' },
};

/** Plural without a library: every label here is a countable noun. */
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function AttentionBand() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const approvals = useApprovals();
  const requests = useRequests();

  const failed = approvals.isError || requests.isError;
  const loading = approvals.isLoading || requests.isLoading;

  const approvalRows = approvalsAwaiting(approvals.data ?? [], currentUser.id);
  const overdueRows = overdueOnMyPlate(requests.data ?? [], currentUser.id);
  const referredRows = referredBackToMe(requests.data ?? [], currentUser.id);

  const items: Item[] = ([
    {
      key: 'overdue',
      count: overdueRows.length,
      label: `${plural(overdueRows.length, 'request is', 'requests are')} past the stage SLA`,
      to: '/requests?overdue=1',
      tone: 'stop',
    },
    {
      key: 'referred',
      count: referredRows.length,
      label: `${plural(referredRows.length, 'request was', 'requests were')} sent back to you`,
      to: '/requests?status=referred-back',
      tone: 'warn',
    },
    {
      key: 'approvals',
      count: approvalRows.length,
      label: `${plural(approvalRows.length, 'approval is', 'approvals are')} waiting on you`,
      to: '/approvals',
      tone: 'accent',
    },
  ] as Item[]).filter((item) => item.count > 0);

  // Nothing to say, and the reads that would have said it both succeeded.
  if (!failed && (loading || items.length === 0)) return null;

  if (failed) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-md border border-stop-line bg-stop-soft p-3"
      >
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-stop" />
        <div>
          <p className="text-body font-medium text-stop">Your queue could not be read</p>
          <p className="mt-0.5 text-caption text-ink-3">
            Approvals and requests are not being checked, so an empty dashboard here does not
            mean there is nothing waiting for you.
          </p>
        </div>
      </div>
    );
  }

  // The rail takes the most serious tone present, so the band reads at a glance
  // before any of its text does.
  const rail = TONE[items[0].tone].dot;

  return (
    <section
      aria-label="Needs your attention"
      className="flex overflow-hidden rounded-md border border-line bg-card"
    >
      <span className={`w-1 shrink-0 ${rail}`} aria-hidden="true" />
      <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <span className="text-eyebrow font-semibold uppercase tracking-wide text-ink-3">
          Needs your attention
        </span>
        {items.map((item) => (
          <Link
            key={item.key}
            to={item.to}
            className="group flex items-center gap-2 text-body text-ink-2 hover:text-ink"
          >
            <span className={`size-1.5 rounded-full ${TONE[item.tone].dot}`} aria-hidden="true" />
            <span className={`font-semibold tabular-nums ${TONE[item.tone].text}`}>{item.count}</span>
            <span>{item.label}</span>
            <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  );
}
