// Admin — support-ticket response targets, the SLA data this table still owns.
//
// This page showed the workflow templates' stage SLAs read-only — a copy of
// what the Workflow Designer already shows and edits — while the ticket
// targets, which it actually owns and tickets-core.ts reads at creation, had
// no editor at all. It edits those now, and points to the designer for
// stages.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useTicketSlas, useSaveTicketSla } from '@/lib/db/hooks/use-ticket-slas';
import { TICKET_PRIORITIES } from '@/lib/db/ticket-slas';
import { slaHoursForPriority } from '@/lib/procurement/ticket-sla';

const LABEL: Record<string, string> = {
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
  default: 'Any other priority',
};

export function SlaTargetsPage() {
  const { data: slas = [], isLoading } = useTicketSlas();
  const save = useSaveTicketSla();
  // Edits by priority; a row shows the stored figure until it is edited.
  const [edits, setEdits] = useState<Record<string, string>>({});

  if (isLoading) return (
    <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
      <Loader2 className="size-5 animate-spin" /> <span className="text-sm">Loading support SLAs…</span>
    </div>
  );

  async function handleSave(priority: string) {
    const hours = Number(edits[priority]);
    if (!Number.isFinite(hours) || hours <= 0) { toast.error('Enter a number of hours above zero'); return; }
    try {
      await save.mutateAsync({ priority, hours });
      setEdits((prev) => { const next = { ...prev }; delete next[priority]; return next; });
      toast.success(`${LABEL[priority] ?? priority}: ${hours} hours`);
    } catch (err) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support SLAs"
        subtitle="How soon a support ticket needs a first response, by priority. Applies to tickets raised from now on."
      />

      <Card className="max-w-2xl">
        <CardContent className="divide-y divide-line-2 p-0">
          {TICKET_PRIORITIES.map((priority) => {
            const stored = slas.find((s) => s.priority === priority)?.hours;
            const value = edits[priority] ?? (stored !== undefined ? String(stored) : '');
            // A priority with no row still gets a deadline — the "any other"
            // row, else the built-in figure — so say which, rather than show
            // an empty box that reads as "no SLA".
            const applied = slaHoursForPriority(priority, slas.map((s) => ({ channel: s.priority, hours: s.hours })));
            return (
              <div key={priority} className="flex items-center justify-between gap-4 px-5 py-3">
                <div>
                  <label htmlFor={`sla-${priority}`} className="text-sm font-medium text-ink">{LABEL[priority]}</label>
                  {stored === undefined && (
                    <p className="text-xs text-ink-3">Not set — tickets get {applied} hours</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id={`sla-${priority}`}
                    type="number"
                    min={1}
                    value={value}
                    placeholder={String(applied)}
                    onChange={(e) => setEdits((prev) => ({ ...prev, [priority]: e.target.value }))}
                    className="h-8 w-24 text-right tabular-nums"
                  />
                  <span className="w-10 text-xs text-ink-3">hours</span>
                  <Button size="sm" variant="outline" disabled={edits[priority] === undefined || save.isPending} onClick={() => void handleSave(priority)}>
                    <Save className="size-3.5" /> Save
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex max-w-2xl items-start gap-2 rounded-md border border-line bg-card-2 p-3 text-sm text-ink-2">
        <p className="flex-1 text-xs">
          How long each <span className="font-medium">workflow stage</span> may take is set on the stage itself in the
          Workflow Designer, with its owner and gate — a request&apos;s deadline is counted in working days from the moment it
          enters the stage.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/workflows">Workflow Designer <ExternalLink className="ml-1.5 size-3.5" /></Link>
        </Button>
      </div>
    </div>
  );
}
