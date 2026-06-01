import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useSlaTargets, useUpsertSlaTarget } from '@/lib/db/hooks/use-sla-targets';
import type { SlaTarget } from '@/lib/db/sla-targets';

const STAGE_LABELS: Record<string, string> = {
  intake: 'Intake', validation: 'Validation', approval: 'Approval',
  sourcing: 'Sourcing', contracting: 'Contracting', po: 'PO Creation',
  receipt: 'Goods Receipt', invoice: 'Invoice', payment: 'Payment',
};

export function SlaTargetsPage() {
  const { data: targets = [], isLoading } = useSlaTargets();
  const upsert = useUpsertSlaTarget();

  async function handleChange(stage: string, days: number) {
    if (isNaN(days) || days < 1) return;
    try {
      await upsert.mutateAsync({ stage, channel: 'default', days });
      toast.success(`SLA for ${STAGE_LABELS[stage] ?? stage} updated to ${days} days`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to update SLA target');
    }
  }

  const orderedStages = Object.keys(STAGE_LABELS);

  if (isLoading) return (
    <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
      <Loader2 className="size-5 animate-spin" /> <span className="text-sm">Loading SLA targets…</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="SLA Targets"
        subtitle="Set the maximum days allowed per workflow stage before a request is flagged as overdue"
      />

      <Card className="max-w-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Default SLA (days) per stage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {orderedStages.map((stage) => {
            const current = (targets as SlaTarget[]).find((t) => t.stage === stage && t.channel === 'default')?.days ?? 5;
            return (
              <div key={stage} className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-gray-700 w-36">{STAGE_LABELS[stage]}</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    defaultValue={current}
                    className="h-8 w-20 text-sm text-center"
                    onBlur={(e) => handleChange(stage, parseInt(e.target.value))}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  />
                  <span className="text-xs text-muted-foreground">days</span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
