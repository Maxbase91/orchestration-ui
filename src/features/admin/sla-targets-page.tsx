// Admin — stage SLAs, read-only, sourced from the workflow templates.
//
// This page used to write `sla_targets` and its subtitle said the values
// "drive the overdue flags and SLA countdowns". They did not. Every countdown
// reads `requests.sla_deadline`, which transition.ts computes from the workflow
// template node's `slaDays`; the table was read only by four chart components
// that recomputed locally against numbers nothing else used. Editing this grid
// changed nothing anyone would see.
//
// The template won that contest — an SLA is a property of a stage, and the
// stage is defined in the Workflow Designer. So the page shows what the
// templates say and sends you there to change it, rather than offering an input
// that writes to a column no consumer reads.
import { Loader2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useStageSlas } from '@/lib/db/hooks/use-stage-slas';
import { useWorkflowTemplates } from '@/lib/db/hooks/use-workflow-templates';
import { stageLabel } from '@/lib/workflow/stage-labels';


export function SlaTargetsPage() {
  const { data: slas, isLoading } = useStageSlas();
  const { data: templates = [] } = useWorkflowTemplates();

  if (isLoading) return (
    <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
      <Loader2 className="size-5 animate-spin" /> <span className="text-sm">Loading stage SLAs…</span>
    </div>
  );

  const templateName = (id: string) => templates.find((t) => t.id === id)?.name ?? id;
  const byTemplate = new Map<string, typeof slas>();
  for (const sla of slas) {
    byTemplate.set(sla.templateId, [...(byTemplate.get(sla.templateId) ?? []), sla]);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stage SLAs"
        subtitle="How many working days each stage allows, as defined by the workflow templates"
      />

      <div className="flex items-start gap-2 rounded-md border border-line bg-card-2 p-3 text-sm text-ink-2">
        <div className="flex-1">
          <p className="font-medium">Set in the Workflow Designer</p>
          <p className="text-xs text-muted-foreground">
            An SLA belongs to the stage that has it, so it is edited on the workflow node
            alongside that stage&apos;s role and gate. A request&apos;s deadline is calculated in
            working days from the moment it enters the stage.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/workflows">
            Workflow Designer <ExternalLink className="ml-1.5 size-3.5" />
          </Link>
        </Button>
      </div>

      {byTemplate.size === 0 && (
        <Card className="max-w-2xl">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No workflow template defines a stage SLA yet. Add one to a stage node in the
            Workflow Designer and it will appear here.
          </CardContent>
        </Card>
      )}

      {[...byTemplate.entries()].map(([templateId, stages]) => (
        <Card key={templateId} className="max-w-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              {templateName(templateId)}{' '}
              <span className="font-mono text-xs font-normal text-muted-foreground">{templateId}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stages.map((sla) => (
              <div key={`${templateId}-${sla.stage}`} className="flex items-center justify-between gap-4 border-b border-line-2 pb-2 last:border-0 last:pb-0">
                <span className="text-sm font-medium text-ink-2">
                  {stageLabel(sla.stage)}
                </span>
                <span className="text-sm tabular-nums text-ink">
                  {sla.days} <span className="text-xs text-muted-foreground">working days</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
