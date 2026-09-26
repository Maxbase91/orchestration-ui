// "How this was worked out" — the determination's workings, one click down on
// the Channel page, and its export.
//
// The Review step laid every one of these out as a card at the same weight as
// the channel decision, which is why a requester could not find what mattered
// to them. The Checks carry the conclusions now; these are the reasons behind
// them — materiality, the risk readings, approval to source, the contract and
// sourcing type, every policy check that ran, and the next steps — kept on the
// page because procurement reads them, and because a tracked story promises
// them (DET-04/05/08, RSK-02, RSK-06, RTE-06).
import { Link } from 'react-router-dom';
import { ChevronRight, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import { buildDeterminationExport } from '@/lib/procurement/determination-export';
import type { IntakeDetermination } from '@/lib/procurement/intake-determination';

interface ChannelWorkingsProps {
  determination: IntakeDetermination;
  requestTitle: string;
  category: string;
  estimatedValue: number;
  supplierName?: string;
  /** The description's sections, labelled, with whether each is required — for the export. */
  sections: Array<{ label: string; body: string; required: boolean }>;
  narrative?: string;
  qualityScore?: number;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line-2 py-2 last:border-b-0">
      <span className="text-eyebrow font-semibold uppercase tracking-[0.08em] text-ink-3">{label}</span>
      <div className="text-caption leading-relaxed text-ink-2">{children}</div>
    </div>
  );
}

export function ChannelWorkings(props: ChannelWorkingsProps) {
  const d = props.determination;

  const handleExport = () => {
    const { markdown, filename } = buildDeterminationExport({
      requestTitle: props.requestTitle,
      category: props.category,
      estimatedValue: props.estimatedValue,
      supplierName: props.supplierName,
      buyingChannel: d.buyingChannelResult,
      referral: d.referral,
      contractType: d.contractType,
      sourcingType: d.sourcingType,
      contractCoverage: {
        recommendation: d.secondContractCheck.recommendation,
        reason: d.secondContractCheck.reason,
        candidates: d.secondContractCheck.candidates.map((c) => ({ title: c.title, kind: c.kind })),
      },
      materiality: d.materiality,
      inherentRisk: d.inherentRisk,
      operationalRisk: d.operationalRisk,
      riskOutcome: d.riskOutcome ? { decision: d.riskOutcome.decision, reasons: d.riskOutcome.reasons } : undefined,
      approvalToSource: d.approvalToSource,
      handoffSteps: d.handoffSteps,
      policyChecks: d.policyChecks,
      serviceDescription: props.narrative || props.sections.some((s) => s.body)
        ? { narrative: props.narrative, qualityScore: props.qualityScore, sections: props.sections }
        : undefined,
      generatedAt: new Date().toISOString().slice(0, 10),
    });
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Determination exported');
  };

  const passed = d.policyChecks.filter((c) => c.passed).length;
  return (
    <details className="group rounded-lg border border-line bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-caption font-medium text-ink-2 hover:text-ink">
        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" aria-hidden="true" />
        How this was worked out
      </summary>
      <div className="border-t border-line-2 px-3 pb-3">
        <Row label="Materiality">
          {d.materiality.material
            ? `Material — ${d.materiality.criticality}. ${d.materiality.reasons.join('; ')}.`
            : 'Not material.'}
        </Row>
        <Row label="Inherent risk">
          <span className="font-medium text-ink">{d.inherentRisk.tier}</span>
          {d.inherentRisk.drivers.length > 0 && ` — ${d.inherentRisk.drivers.join('; ')}`}
        </Row>
        <Row label="Operational risk">
          <span className="font-medium text-ink">{d.operationalRisk.overall}</span>
          <ul className="mt-1 flex flex-col gap-0.5">
            {d.operationalRisk.dimensions.map((dim) => (
              <li key={dim.key}>{dim.label}: {dim.rating} — {dim.reason}</li>
            ))}
          </ul>
        </Row>
        <Row label="Approval to source">
          <span className="font-medium text-ink">{d.approvalToSource.tier === 'none' ? 'Not required' : `${d.approvalToSource.tier} gate`}</span>
          {' — '}{d.approvalToSource.rationale}
          {d.approvalToSource.gates.length > 0 && (
            <ul className="mt-1 flex flex-col gap-0.5">
              {d.approvalToSource.gates.map((gate) => <li key={gate.id}>{gate.label}: {gate.reason}</li>)}
            </ul>
          )}
        </Row>
        <Row label="Contract and sourcing">
          Contract: <span className="font-medium text-ink">{d.contractType.type}</span> ({d.contractType.reason}).
          {' '}Sourcing: <span className="font-medium text-ink">{d.sourcingType.type}</span> ({d.sourcingType.reason}).
        </Row>
        <Row label="Supplier assessment">{d.sraStatus}</Row>
        <Row label={`Policy checks — ${passed} of ${d.policyChecks.length} passed`}>
          <ul className="flex flex-col gap-0.5">
            {d.policyChecks.map((check) => (
              <li key={check.label} className={cn(!check.passed && 'text-warn')}>
                {check.passed ? 'Passed' : 'Needs attention'} · {check.label} — {check.detail}
              </li>
            ))}
          </ul>
        </Row>
        {d.handoffSteps.length > 0 && (
          <Row label="Next steps">
            <ul className="flex flex-col gap-1">
              {d.handoffSteps.map((step) => (
                <li key={step.key}>
                  <span className="font-medium text-ink">{step.label}</span> · {step.system} · {step.status}
                  {step.deepLink && <> · <Link to={step.deepLink} className="text-accent hover:underline">Open</Link></>}
                  <span className="block text-ink-3">{step.detail}</span>
                </li>
              ))}
            </ul>
          </Row>
        )}
        <div className="flex items-center justify-between gap-2 pt-2">
          <span className="text-eyebrow text-ink-3">At {formatCurrency(props.estimatedValue)}, as the checks ran just now.</span>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-3.5" /> Export
          </Button>
        </div>
      </div>
    </details>
  );
}
