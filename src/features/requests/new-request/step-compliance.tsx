import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Info, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Sparkles, Circle, MinusCircle, Clock, Recycle, Download } from 'lucide-react';
import { toast } from 'sonner';
import { ComplianceCheckResult } from './components/compliance-check-result';
import { formatCurrency } from '@/lib/format';
import { useSourceData } from '@/lib/integrations';
import { gapsAgainstFinal } from '@/lib/procurement/demand-signals';

/** Display names for the description's sections, for the gap message. */
const SOW_SECTION_LABELS: Record<string, string> = {
  objective: 'Objective', scope: 'Scope', deliverables: 'Deliverables',
  timeline: 'Timeline', resources: 'Resources', acceptanceCriteria: 'Acceptance Criteria',
  pricingModel: 'Pricing Model', location: 'Location', dependencies: 'Dependencies',
};
import { buildDeterminationExport } from '@/lib/procurement/determination-export';
import { buyingChannelPlain } from '@/lib/routing/evaluate-routing-rules';
import type { Supplier, Contract } from '@/data/types';
import { useFormTemplate } from '@/lib/db/hooks/use-form-templates';
import type { IntakeDetermination, MatchingRiskAssessmentSummary } from '@/lib/procurement/intake-determination';
import { DynamicForm } from '@/components/shared/dynamic-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { SupplierRecommenderCard } from './components/supplier-recommender-card';
import type { MiniIrqAnswers } from './intake-form-data';

// Re-exported so consumers that only need the summary shape do not have to know
// where the determination lives.
export type { MatchingRiskAssessmentSummary };


interface StepComplianceProps {
  category: string;
  estimatedValue: number;
  supplierId: string;
  supplier?: string;
  serviceDescription?: {
    objective?: string;
    scope?: string;
    deliverables?: string;
    resources?: string;
    narrative?: string;
  } | null;
  /**
   * Sections the capture-time signals made mandatory (from generation). The
   * final materiality is computed here and can demand more than the preliminary
   * read did — those gaps are reported, not silently generated, because a
   * document that rewrites itself after the requester thought it was finished is
   * worse than one that says what is missing.
   */
  requiredSections?: string[];
  /** From generation — carried into the export so the gate travels with it. */
  qualityScore?: number;
  /** How the current supplier got here — a named one is a suggestion to confirm. */
  supplierProvenance?: 'named' | 'chosen';
  /** Choosing a supplier. This step is the only place it happens. */
  onSelectSupplier?: (supplier: Supplier) => void;
  requestTitle?: string;
  /**
   * The determination, computed once by the page. Null while the supplier's
   * reusable-assessment lookup is still resolving.
   */
  determination: IntakeDetermination | null;
  /**
   * Which half of this screen to render.
   *
   * The split is by KIND, not by screen: `inputs` is everything the requester
   * is asked for, `conclusions` is everything the platform worked out. It used
   * to be `'risk' | 'determination'`, which put one question (the mini-IRQ)
   * on a screen with seven blocks of computed output and no way to tell them
   * apart — the reported complaint that users could not see what they had to
   * fill in and what the results meant.
   */
  section: 'inputs' | 'conclusions';
  /**
   * How much evidence to show. Presentation only: every block here is rendered
   * from the same determination, and nothing below decides anything. Simple
   * sees the conclusion and what it means; Expert also sees the workings.
   */
  /**
   * Whether this step asks the residual risk questions.
   *
   * False on the chat path, where the conversation asks them as its tail — two
   * places to answer one governance question is how the answers disagree.
   * The form paths (contract renewal, supplier onboarding) have no conversation,
   * so the card is still where they are asked.
   */
  askRiskQuestions?: boolean;
  /**
   * Whether supplier selection is on screen yet.
   *
   * False until the conversation is finished, so the requester is asked for one
   * thing at a time. It is never a *gate* — leaving the supplier open is a
   * valid answer and sourcing will identify candidates.
   */
  revealSupplier?: boolean;
  miniIrq: MiniIrqAnswers;
  onMiniIrqChange: (m: MiniIrqAnswers) => void;
}

/** The supplier's SRA state, in the vocabulary the triage form displays. */
function mapSraStatus(status: string | undefined): string {
  switch (status) {
    case 'valid': return 'yes-valid';
    case 'expiring': return 'yes-expiring';
    case 'expired':
    case 'not-assessed':
      return 'no';
    default: return 'unknown';
  }
}



export function StepCompliance({
  category,
  estimatedValue,
  supplierId,
  supplier,
  serviceDescription,
  requiredSections = [],
  qualityScore,
  supplierProvenance,
  onSelectSupplier,
  requestTitle,
  determination,
  section,
  askRiskQuestions = true,
  revealSupplier = true,
  miniIrq,
  onMiniIrqChange,
}: StepComplianceProps) {
  // The supplier directory is still read here: the export and the triage view
  // name the selected supplier. Every *decision* arrives as a prop.
  const { data: suppliers = [] } = useSourceData<Supplier>('supplier');
  const result = determination;
  const loading = determination === null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <Loader2 className="size-8 animate-spin text-blue-500" />
        <p className="mt-4 text-sm font-medium">Running compliance checks...</p>
        <p className="mt-1 text-xs text-gray-400">
          Checking buying channel, SRA, policy rules, and duplicate requests
        </p>
      </div>
    );
  }

  if (!result) return null;

  const allPassed = result.policyChecks.every((c) => c.passed);

  const handleExport = () => {
    const supplierName = suppliers.find((s) => s.id === supplierId)?.name ?? supplier;
    const { markdown, filename } = buildDeterminationExport({
      requestTitle,
      category,
      estimatedValue,
      supplierName,
      buyingChannel: result.buyingChannelResult,
      referral: result.referral,
      contractType: result.contractType,
      sourcingType: result.sourcingType,
      contractCoverage: result.secondContractCheck
        ? {
            recommendation: result.secondContractCheck.recommendation,
            reason: result.secondContractCheck.reason,
            candidates: result.secondContractCheck.candidates.map((c) => ({ title: c.title, kind: c.kind })),
          }
        : undefined,
      materiality: result.materiality,
      inherentRisk: result.inherentRisk,
      operationalRisk: result.operationalRisk,
      riskOutcome: result.riskOutcome
        ? { decision: result.riskOutcome.decision, reasons: result.riskOutcome.reasons }
        : undefined,
      approvalToSource: result.approvalToSource,
      handoffSteps: result.handoffSteps,
      policyChecks: result.policyChecks,
      serviceDescription: serviceDescription
        ? {
            narrative: serviceDescription.narrative,
            qualityScore,
            sections: Object.entries(SOW_SECTION_LABELS).map(([id, label]) => ({
              label,
              body: (serviceDescription as Record<string, string | undefined>)[id] ?? '',
              required: requiredSections.includes(id),
            })),
          }
        : undefined,
      generatedAt: new Date().toISOString().slice(0, 10),
    });
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Determination exported');
  };

  return (
    <div className="space-y-6">
      {section === 'inputs' && (<>
      {/* Mini-IRQ (delta only) — the two inherent-risk attributes that cannot be
          inferred from the service description. Answers refine the cascade live.
          On the chat path the conversation asks these instead, so this renders
          only for the form-based categories. */}
      {askRiskQuestions && <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Mini risk questionnaire</CardTitle>
          <p className="text-xs text-muted-foreground">
            We only ask what we couldn&apos;t derive from your service description.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {(result.residualQuestions?.length ?? 0) === 0 ? (
            <p className="text-sm text-gray-500">
              No further questions — your service description already covers what we need to assess.
            </p>
          ) : (
            result.residualQuestions!.map((q) => {
              const switchId = q.id === 'privileged-access' ? 'mini-irq-access' : 'mini-irq-critical';
              return (
                <div key={q.id} className="flex items-center justify-between gap-4">
                  <label htmlFor={switchId} className="text-sm text-gray-700">
                    {q.question}
                    <span className="block text-xs text-gray-400">Asked because: {q.reason}</span>
                  </label>
                  <Switch
                    id={switchId}
                    checked={miniIrq[q.field] ?? false}
                    onCheckedChange={(v) => onMiniIrqChange({ ...miniIrq, [q.field]: v })}
                  />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>}

      </>)}
      {section === 'conclusions' && (<>
      {/* The determination is exportable — an operator action, not something a
          requester submitting their own demand reaches for. */}
      {(
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900">Determination</p>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-3.5 mr-1.5" /> Export
          </Button>
        </div>
      )}

      {/* Sections the governance read requires that the description does not
          have. Uses the same list generation was given, so the two cannot
          disagree about what "required" means. */}
      {(() => {
        const gaps = gapsAgainstFinal(
          requiredSections,
          (serviceDescription ?? {}) as Record<string, string | undefined>,
        );
        if (gaps.length === 0) return null;
        const labelFor = (id: string) =>
          SOW_SECTION_LABELS[id] ?? id.replace(/([A-Z])/g, ' $1').toLowerCase();
        return (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-900">
              The service description is missing {gaps.length} required section
              {gaps.length === 1 ? '' : 's'}
            </p>
            <p className="mt-0.5 text-xs text-amber-800">
              This demand&apos;s materiality, risk and sourcing make {gaps.length === 1 ? 'it' : 'these'}{' '}
              mandatory: <strong>{gaps.map(labelFor).join(', ')}</strong>. Go back to the service
              description to add {gaps.length === 1 ? 'it' : 'them'} — the request can still be
              submitted, but a reviewer will ask.
            </p>
          </div>
        );
      })()}

      <SectionHeader
        label="How you'll buy"
        meaning="The route this request takes from here, and roughly how long that takes. Everything below follows from it."
      />
      {/* Demand disposition — proceed / request-change / refer-back. The
          headline routing decision: can this demand move to its next step? */}
      {result.referral && (
        <div className={`rounded-lg border p-3 ${
          result.referral.outcome === 'refer-back' ? 'border-red-200 bg-red-50/60'
            : result.referral.outcome === 'request-change' ? 'border-amber-200 bg-amber-50/60'
              : 'border-green-200 bg-green-50/60'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
              result.referral.outcome === 'refer-back' ? 'bg-red-100 text-red-700'
                : result.referral.outcome === 'request-change' ? 'bg-amber-100 text-amber-700'
                  : 'bg-green-100 text-green-700'
            }`}>
              {result.referral.outcome === 'refer-back' ? 'Refer back'
                : result.referral.outcome === 'request-change' ? 'Request change' : 'Proceed'}
            </span>
            <span className="text-xs text-gray-600">{result.referral.reason}</span>
          </div>
        </div>
      )}
      {/* Buying Channel Classification.
          Leads in the requester's language and states the whole journey before
          the submit button — the reported gap: the channel is the single most
          consequential thing decided here, and it was presented as a
          classification label with a rule id under it. */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0 text-blue-500" />
          <div>
            {(() => {
              const plain = buyingChannelPlain(result.buyingChannelSlug);
              return (
                <>
                  <p className="text-sm font-semibold text-gray-900">{plain.headline}</p>
                  <p className="mt-0.5 text-sm text-gray-700">{plain.detail}</p>
                </>
              );
            })()}
            {/* The full process, before submission, so nobody is surprised by
                a step after they have committed to the request. */}
            {result.handoffSteps.length > 0 && (
              <p className="mt-2 text-xs text-gray-600">
                <span className="font-medium text-gray-700">What happens next:</span>{' '}
                {result.handoffSteps.map((step) => step.label).join(' → ')}
              </p>
            )}
            {(<>
            <p className="mt-2 text-sm text-gray-700">
              Based on value ({formatCurrency(estimatedValue)}), category ({category}), this is classified as:{' '}
              <span className="font-semibold text-blue-700">{result.buyingChannelResult}</span>
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              {result.matchedRuleName
                ? `Matched routing rule: ${result.matchedRuleName}`
                : 'No admin routing rule matched — using default fallback.'}
            </p>
            {result.materiality && (
              <p className="mt-1 text-sm text-gray-700">
                Materiality:{' '}
                <span className={result.materiality.material ? 'font-semibold text-amber-700' : 'font-medium text-gray-600'}>
                  {result.materiality.material
                    ? `Material — ${result.materiality.criticality} (regulatory flag raised)`
                    : 'Not material'}
                </span>
                {result.materiality.material && (
                  <span className="text-xs text-gray-500"> · {result.materiality.reasons.join('; ')}</span>
                )}
              </p>
            )}
            {result.contractType && result.sourcingType && (
              <p className="mt-1 text-sm text-gray-700">
                Contract type: <span className="font-semibold text-gray-900">{result.contractType.type}</span>
                <span className="text-xs text-gray-500"> ({result.contractType.reason})</span>
                {' · '}Sourcing: <span className="font-semibold text-gray-900">{result.sourcingType.type}</span>
                <span className="text-xs text-gray-500"> ({result.sourcingType.reason})</span>
              </p>
            )}
            {/* The inherent tier and its drivers are stated once, under Risk
                directly below — the same sentence appeared here too, so the
                screen said it twice. This card keeps only the inputs that are
                specific to the CHANNEL decision. */}
            {result.screening && (
              <p className="mt-1 text-sm text-gray-700">
                Supplier screening:{' '}
                <span className={`font-semibold ${
                  result.screening.blocking ? 'text-red-700'
                    : result.screening.cleared ? 'text-green-700' : 'text-amber-700'
                }`}>{result.screening.status}</span>
                <span className="text-xs text-gray-500"> · {result.screening.message}</span>
              </p>
            )}
            </>)}
          </div>
        </div>
      </div>

      <SectionHeader
        label="Risk"
        meaning="What the risk read found, and whether it adds anything to your request."
      />
      {/* The risk read, as a consequence rather than a tier.
          "Inherent risk: medium · Internal data; Moderate contract value" is
          precise and tells a requester nothing about what happens to their
          request. This says what it means for them; the tier and its drivers
          are the workings below. */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm font-medium text-gray-900">
          {result.riskAssessmentRequired
            ? 'A risk assessment is required before this can proceed'
            : result.matchingRiskAssessments.length > 0
              ? 'No new risk assessment needed'
              : 'No separate risk assessment is required'}
        </p>
        <p className="mt-1 text-sm text-gray-600">
          {result.riskAssessmentRequired
            ? 'Nothing for you to do now — the assigned owner runs it, and it happens alongside the rest of the process.'
            : result.matchingRiskAssessments.length > 0
              ? `An existing assessment for this supplier covers it (${result.matchingRiskAssessments.length} match${result.matchingRiskAssessments.length === 1 ? '' : 'es'}).`
              : result.triageReason}
        </p>
        {result.supplierOnboardingRequired && (
          <p className="mt-1.5 text-sm text-gray-600">
            The supplier also needs onboarding before any contract or order can be raised.
          </p>
        )}
      </div>

      {/* Inherent risk — what the mini-IRQ answers on the previous step
          produced, stated where every other conclusion is. */}
      {result.inherentRisk && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-900">Inherent risk</p>
          <p className="mt-1 text-sm text-gray-700">
            <span className={`font-semibold ${
              result.inherentRisk.tier === 'critical' ? 'text-red-700'
                : result.inherentRisk.tier === 'high' ? 'text-amber-700'
                  : 'text-gray-900'
            }`}>{result.inherentRisk.tier}</span>
            <span className="text-xs text-gray-500"> · {result.inherentRisk.drivers.join('; ')}</span>
          </p>
          {result.riskOutcome && (
            <p className="mt-0.5 text-xs text-gray-500">
              Assessment outcome: <span className="font-medium text-gray-700">{result.riskOutcome.decision}</span> ({result.riskOutcome.reasons[0]})
            </p>
          )}
        </div>
      )}

      {/* Preliminary operational risk assessment — per-dimension operational view
          (continuity, data, concentration, regulatory, access). The workings
          behind the sentence above. */}
      {result.operationalRisk && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-gray-900">Preliminary operational risk</p>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
              result.operationalRisk.overall === 'high' ? 'bg-red-100 text-red-700'
                : result.operationalRisk.overall === 'medium' ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-500'
            }`}>
              {result.operationalRisk.overall}
            </span>
          </div>
          <ul className="mt-3 space-y-1.5">
            {result.operationalRisk.dimensions.map((d) => (
              <li key={d.key} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-sm text-gray-700">{d.label}</span>
                  <span className="block text-xs text-gray-400">{d.reason}</span>
                </div>
                <span className={`shrink-0 text-xs font-medium ${
                  d.rating === 'high' ? 'text-red-600'
                    : d.rating === 'medium' ? 'text-amber-600'
                      : 'text-gray-400'
                }`}>
                  {d.rating}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <SectionHeader
        label="Routing & approvals"
        meaning="Who has to agree before this can proceed, and what happens next once they do."
      />
      {/* Approval to source — the pre-sourcing gate (DET-05): which
          approvals are required before the demand can move into sourcing. */}
      {result.approvalToSource && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-gray-900">Approval to source</p>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
              result.approvalToSource.tier === 'full' ? 'bg-amber-100 text-amber-700'
                : result.approvalToSource.tier === 'light' ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-500'
            }`}>
              {result.approvalToSource.tier === 'none' ? 'not required' : `${result.approvalToSource.tier} gate`}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">{result.approvalToSource.rationale}</p>
          {result.approvalToSource.gates.length > 0 && (
            <ul className="mt-3 space-y-2">
              {result.approvalToSource.gates.map((gate) => (
                <li key={gate.id} className="border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                  <p className="text-sm font-medium text-gray-800">{gate.label}</p>
                  <p className="text-xs text-gray-500">{gate.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Next steps — the structured handoff panel: each step, its system,
          status and deep-link. R1 routes (deep-links), it does not write. */}
      {result.handoffSteps && result.handoffSteps.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-900">Next steps</p>
          <ul className="mt-3 space-y-2">
            {result.handoffSteps.map((step) => (
              <li key={step.key} className="flex items-start justify-between gap-3 border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">{step.label}</p>
                  <p className="text-xs text-gray-500">{step.system} · {step.detail}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    step.status === 'required' ? 'bg-amber-100 text-amber-700'
                      : step.status === 'recommended' ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-500'
                  }`}>
                    {step.status}
                  </span>
                  {step.deepLink && (
                    <Link to={step.deepLink} className="text-xs font-medium text-blue-600 hover:underline">
                      Open
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Second contract check — transactable contracts vs frameworks/MSAs. */}
      {result.secondContractCheck && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-900">Contract coverage</p>
          <p className="mt-0.5 text-xs text-gray-500">
            Recommendation: <span className="font-medium text-gray-700">{result.secondContractCheck.recommendation}</span> — {result.secondContractCheck.reason}
          </p>
          {result.secondContractCheck.candidates.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {result.secondContractCheck.candidates.map((c) => (
                <li key={c.contractId} className="flex items-start justify-between gap-3 border-b border-gray-50 pb-1.5 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800">{c.title}</p>
                    <p className="text-xs text-gray-500">{c.reason}</p>
                  </div>
                  <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    c.kind === 'transactable' ? 'bg-green-100 text-green-700'
                      : c.kind === 'framework' ? 'bg-blue-100 text-blue-700'
                        : 'bg-amber-100 text-amber-700'
                  }`}>
                    {c.kind}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* SRA Status */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm font-medium text-gray-900">SRA Status</p>
        <p className="mt-1 text-sm text-gray-600">{result.sraStatus}</p>
      </div>

      {/* Matching Risk Assessments (reuse) */}
      {result.matchingRiskAssessments.length > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="flex items-start gap-2">
            <Recycle className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-900">
                {result.matchingRiskAssessments.length} existing risk assessment
                {result.matchingRiskAssessments.length > 1 ? 's' : ''} eligible for reuse
              </p>
              <p className="mt-0.5 text-xs text-emerald-800/80">
                These assessments are valid and cover the selected supplier. A new SRA is not required at intake.
              </p>
              <ul className="mt-2 space-y-1.5">
                {result.matchingRiskAssessments.map((ra) => (
                  <li
                    key={ra.id}
                    className="flex items-center justify-between gap-2 rounded-md bg-white/70 px-2.5 py-1.5 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">{ra.title}</p>
                      <p className="text-[11px] text-gray-500">
                        {ra.id} · {ra.category} · {ra.riskLevel} risk · valid until {ra.validUntil}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <SectionHeader
        label="Checks we ran"
        meaning="What was actually checked at intake. A check that did not run says so rather than showing as clear."
      />
      {/* Policy Checks */}
      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-sm font-medium text-gray-700">Policy Checks</p>
          {result.validatorAgentName && (
            <p className="text-[11px] text-gray-400">
              {result.validatorAgentStatus === 'active'
                ? `via ${result.validatorAgentName} (AI-002)`
                : `${result.validatorAgentName} is ${result.validatorAgentStatus}`}
            </p>
          )}
        </div>
        <div className="space-y-2">
          {result.policyChecks.map((check) => (
            <ComplianceCheckResult
              key={check.label}
              label={check.label}
              passed={check.passed}
              detail={check.detail}
            />
          ))}
        </div>
      </div>

      {/* Summary */}
      {allPassed ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center text-sm font-medium text-green-700">
          All compliance checks passed. You may proceed to the next step.
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center text-sm font-medium text-amber-700">
          Some checks require attention. Review the warnings above before proceeding.
        </div>
      )}

      {/* Risk Assessment Triage — gated on whether a triage is actually
          required. Pre-filled from the collected SOW when shown. */}
      {(() => {
        // Read from the determination rather than re-running the gate. This
        // block used to call `isTriageRequired` again with its own inputs — a
        // second derivation of a governance answer, free to disagree with the
        // one the record keeps.
        const selectedSupplier = suppliers.find((s) => s.id === supplierId);
        const sensitivity = result.dataSensitivity;
        if (!result.triageRequired) {
          return (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle className="size-4 text-green-600" />
                  Risk Assessment Not Required
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700">{result.triageReason} — no new triage needed at intake.</p>
                {result.matchingRiskAssessments.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-gray-600">
                    {result.matchingRiskAssessments.map((ra) => (
                      <li key={ra.id}>
                        <span className="font-medium text-gray-800">{ra.title}</span>
                        {' · '}
                        {ra.id} · {ra.category} · {ra.riskLevel} risk · valid until {ra.validUntil}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-[11px] text-gray-400">
                  Data sensitivity inferred from SOW: <strong>{sensitivity}</strong>.
                </p>
              </CardContent>
            </Card>
          );
        }
        return (
          <RiskAssessmentTriageSection
            supplierRegistered={!!supplierId}
            supplierSraStatus={selectedSupplier?.sraStatus}
            inferredDataSensitivity={sensitivity}
            triageReason={result.triageReason}
            reuseCount={result.matchingRiskAssessments.length}
          />
        );
      })()}

      {/* Smart Assessment — a projection of the journey, i.e. workings. */}
      {(
      <SmartAssessmentSection
        supplier={supplier ?? ''}
        supplierId={supplierId}
        category={category}
        estimatedValue={estimatedValue}
      />
      )}

      </>)}
      {section === 'inputs' && (<>
      {/* IT Security Assessment (software only) — a form the requester fills,
          so it belongs with the questions, not with the findings. */}
      {category === 'software' && (
        <ITSecurityAssessmentSection />
      )}

      {revealSupplier && <><SectionHeader
        label="Supplier"
        meaning="Who you expect to buy from, if you already know. Leaving it open is fine — sourcing will identify candidates."
      />
      {/* THE single supplier surface. Selection used to live in step-details
          while this card only listed recommendations with no way to act on
          them. Everything that should inform the choice — PSL status, screening,
          risk tier, master-data completeness — is computed on this step. */}
      <SupplierRecommenderCard
        category={category}
        estimatedValue={estimatedValue}
        selectedSupplierId={supplierId}
        selectedSupplierName={supplier}
        supplierProvenance={supplierProvenance}
        onSelect={onSelectSupplier}
      /></>}

      {/* The workflow is PRE-DEFINED from the input (derived by category in the
          effect above) and attached silently — it is not user-selectable. */}
      </>)}
    </div>
  );
}

/** A small labelled divider that breaks the determination into scannable
 *  sections (item 10 — the screen was a flat, unstructured stack of cards). */
/**
 * A group heading, and what the group means.
 *
 * The label alone told a requester which pile of cards they were looking at,
 * never why it mattered. `meaning` is one plain sentence answering "so what
 * does this mean for me" — the reported gap between seeing a determination and
 * understanding it.
 */
function SectionHeader({ label, meaning }: { label: string; meaning?: string }) {
  return (
    <div className="pt-1">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          {label}
        </span>
        <span className="h-px flex-1 bg-gray-100" />
      </div>
      {meaning && <p className="mt-1 text-xs text-gray-500">{meaning}</p>}
    </div>
  );
}

// ── Risk Assessment Triage Section ──────────────────────────────────

function RiskAssessmentTriageSection({
  supplierRegistered,
  supplierSraStatus,
  inferredDataSensitivity,
  triageReason,
  reuseCount,
}: {
  supplierRegistered: boolean;
  supplierSraStatus?: string;
  inferredDataSensitivity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  triageReason: string;
  reuseCount: number;
}) {
  // Everything here is DERIVED — the requester is never asked to state the
  // supplier's SRA status or the data sensitivity (they wouldn't know). We show
  // what the system determined, with the reason, and conclude whether a risk
  // assessment is due. The only user inputs are the mini-IRQ deltas above.
  const rows: { label: string; value: string; reason: string }[] = [
    {
      label: 'Data sensitivity',
      value: inferredDataSensitivity,
      reason: 'inferred from your service description',
    },
    {
      label: 'Risk assessment on file',
      value: supplierRegistered ? mapSraStatus(supplierSraStatus) : 'no supplier selected yet',
      reason: supplierRegistered
        ? "read from the supplier's record"
        : 'a supplier is selected later, during validation',
    },
    {
      label: 'Reusable assessment',
      value: reuseCount > 0 ? `${reuseCount} available` : 'none found',
      reason: reuseCount > 0
        ? 'a valid assessment matches this supplier + category'
        : 'no valid assessment covers this demand',
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Risk assessment</CardTitle>
        <p className="text-xs text-muted-foreground">
          Derived from your service description and the supplier — there&apos;s no questionnaire to fill in.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-sm text-gray-700">{r.label}</span>
                <span className="block text-xs text-gray-400">{r.reason}</span>
              </div>
              <span className="shrink-0 text-sm font-medium capitalize text-gray-900">{r.value}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-800">A risk assessment is required</p>
            <p className="mt-1 text-xs text-amber-700">
              {reuseCount > 0
                ? `A reusable assessment exists, but a fresh one is needed here because ${triageReason}.`
                : 'No assessment can be reused, so a risk assessment is carried out — it appears as a step in the workflow.'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Smart Assessment Section ──────────────────────────────────────────

function SmartAssessmentSection({
  supplier,
  supplierId,
  category,
  estimatedValue,
}: {
  supplier: string;
  supplierId: string;
  category: string;
  estimatedValue: number;
}) {
  const { data: suppliers = [] } = useSourceData<Supplier>('supplier');
  const { data: contracts = [] } = useSourceData<Contract>('contract');
  const assessment = useMemo(() => {
    // Vendor match
    const matchedSupplier = supplierId
      ? suppliers.find((s) => s.id === supplierId)
      : supplier
        ? suppliers.find((s) => s.name.toLowerCase().includes(supplier.toLowerCase()))
        : null;

    // Contract coverage
    const matchedContracts = matchedSupplier
      ? contracts.filter((c) => c.supplierId === matchedSupplier.id && (c.status === 'active' || c.status === 'expiring'))
      : [];
    const hasActiveContract = matchedContracts.some((c) => c.status === 'active');
    const hasExpiringContract = matchedContracts.some((c) => c.status === 'expiring');

    // Buying channel determines sourcing need
    const needsSourcing = estimatedValue >= 25000 && category !== 'contingent-labour' && !hasActiveContract;
    const needsContracting = !hasActiveContract;
    const needsVPApproval = estimatedValue > 100000;

    // Build steps
    const steps = [
      { name: 'Intake', status: 'completed' as const, days: 0, detail: 'Completed' },
      { name: 'Validation', status: 'current' as const, days: 2, detail: 'Buying channel classification + vendor check' },
      { name: 'Approval', status: 'future' as const, days: needsVPApproval ? 5 : 3, detail: needsVPApproval ? 'Budget Owner → Finance → VP Procurement' : 'Budget Owner → Finance' },
      { name: 'Sourcing', status: (needsSourcing ? 'future' : 'skipped') as 'future' | 'skipped', days: 10, detail: needsSourcing ? 'Procurement-Led Sourcing via SAP Ariba' : `Skipped — ${hasActiveContract ? 'framework agreement available' : 'below threshold'}` },
      { name: 'Contracting', status: (needsContracting ? 'future' : 'skipped') as 'future' | 'skipped', days: 15, detail: needsContracting ? 'Contract required — via Sirion CLM' : `Skipped — existing contract (${matchedContracts[0]?.title ?? 'active'})` },
      { name: 'Purchase Order', status: 'future' as const, days: 2, detail: 'PO creation in SAP S/4HANA' },
      { name: 'Receipt & Payment', status: 'future' as const, days: 5, detail: 'Goods receipt + invoice matching + payment' },
    ];

    const totalDays = steps.filter((s) => s.status !== 'skipped').reduce((sum, s) => sum + s.days, 0);

    return { matchedSupplier, matchedContracts, hasActiveContract, hasExpiringContract, steps, totalDays };
  }, [supplier, supplierId, category, estimatedValue, suppliers, contracts]);

  // Vendor onboarding — derived from the supplier's onboardingStatus (data),
  // surfaced so a new/unonboarded supplier is flagged before engagement.
  const onboarding = (() => {
    const s = assessment.matchedSupplier;
    if (!s) return { tone: 'amber' as const, message: 'Vendor onboarding — a new supplier must be onboarded before a PO can be raised.' };
    if (s.onboardingStatus === 'completed') return { tone: 'green' as const, message: `Onboarding complete — ${s.name} is ready to transact.` };
    if (s.onboardingStatus === 'in-progress') return { tone: 'amber' as const, message: 'Onboarding in progress — complete before engagement.' };
    return { tone: 'red' as const, message: `Onboarding required — ${s.name} is not yet onboarded.` };
  })();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="size-4 text-[#2D5F8A]" />
          Smart Assessment — Estimated Processing Path
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Vendor Match */}
        {(supplier || supplierId) && (
          <div className={`flex items-start gap-2 rounded-lg border p-3 ${assessment.matchedSupplier ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
            {assessment.matchedSupplier ? (
              <CheckCircle className="size-4 text-green-600 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="size-4 text-amber-600 mt-0.5 shrink-0" />
            )}
            <div>
              <p className={`text-sm font-medium ${assessment.matchedSupplier ? 'text-green-800' : 'text-amber-800'}`}>
                {assessment.matchedSupplier
                  ? `Existing vendor — ${assessment.matchedSupplier.name}, ${assessment.matchedSupplier.country}, Risk: ${assessment.matchedSupplier.riskRating}, ${assessment.matchedSupplier.activeContracts} active contracts`
                  : 'New vendor — supplier onboarding will be required'}
              </p>
            </div>
          </div>
        )}

        {/* Contract Coverage */}
        {assessment.matchedSupplier && (
          <div className={`flex items-start gap-2 rounded-lg border p-3 ${assessment.hasActiveContract ? 'border-green-200 bg-green-50' : assessment.hasExpiringContract ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}`}>
            {assessment.hasActiveContract ? (
              <CheckCircle className="size-4 text-green-600 mt-0.5 shrink-0" />
            ) : assessment.hasExpiringContract ? (
              <AlertTriangle className="size-4 text-amber-600 mt-0.5 shrink-0" />
            ) : (
              <MinusCircle className="size-4 text-red-600 mt-0.5 shrink-0" />
            )}
            <div>
              <p className={`text-sm font-medium ${assessment.hasActiveContract ? 'text-green-800' : assessment.hasExpiringContract ? 'text-amber-800' : 'text-red-800'}`}>
                {assessment.hasActiveContract
                  ? `Active contract — ${assessment.matchedContracts[0]?.title}, valid until ${assessment.matchedContracts[0]?.endDate}, ${assessment.matchedContracts[0]?.utilisationPercentage}% utilised`
                  : assessment.hasExpiringContract
                    ? `Contract expiring — ${assessment.matchedContracts[0]?.title}, renewal recommended`
                    : 'No existing contract — contracting step required'}
              </p>
            </div>
          </div>
        )}

        {/* SRA Status */}
        {assessment.matchedSupplier && (
          <div className={`flex items-start gap-2 rounded-lg border p-3 ${assessment.matchedSupplier.sraStatus === 'valid' ? 'border-green-200 bg-green-50' : assessment.matchedSupplier.sraStatus === 'expiring' ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}`}>
            {assessment.matchedSupplier.sraStatus === 'valid' ? (
              <CheckCircle className="size-4 text-green-600 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="size-4 text-amber-600 mt-0.5 shrink-0" />
            )}
            <p className={`text-sm font-medium ${assessment.matchedSupplier.sraStatus === 'valid' ? 'text-green-800' : 'text-amber-800'}`}>
              {assessment.matchedSupplier.sraStatus === 'valid'
                ? `SRA valid until ${assessment.matchedSupplier.sraExpiryDate}`
                : assessment.matchedSupplier.sraStatus === 'expiring'
                  ? `SRA expiring on ${assessment.matchedSupplier.sraExpiryDate} — renewal recommended`
                  : 'SRA assessment required before engagement'}
            </p>
          </div>
        )}

        {/* Vendor onboarding (always shown — a new supplier needs onboarding) */}
        <div className={`flex items-start gap-2 rounded-lg border p-3 ${
          onboarding.tone === 'green' ? 'border-green-200 bg-green-50'
            : onboarding.tone === 'amber' ? 'border-amber-200 bg-amber-50'
              : 'border-red-200 bg-red-50'
        }`}>
          {onboarding.tone === 'green' ? (
            <CheckCircle className="size-4 text-green-600 mt-0.5 shrink-0" />
          ) : onboarding.tone === 'amber' ? (
            <AlertTriangle className="size-4 text-amber-600 mt-0.5 shrink-0" />
          ) : (
            <MinusCircle className="size-4 text-red-600 mt-0.5 shrink-0" />
          )}
          <p className={`text-sm font-medium ${
            onboarding.tone === 'green' ? 'text-green-800'
              : onboarding.tone === 'amber' ? 'text-amber-800' : 'text-red-800'
          }`}>{onboarding.message}</p>
        </div>

        {/* Estimated Journey */}
        <div className="space-y-2 pt-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Estimated Processing Steps</p>
          <div className="space-y-1">
            {assessment.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3 py-1.5">
                <div className="mt-0.5 shrink-0">
                  {step.status === 'completed' && <CheckCircle className="size-4 text-green-500" />}
                  {step.status === 'current' && <Circle className="size-4 text-blue-500 fill-blue-500" />}
                  {step.status === 'future' && <Circle className="size-4 text-gray-300" />}
                  {step.status === 'skipped' && <MinusCircle className="size-4 text-gray-300" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${step.status === 'skipped' ? 'text-gray-400 line-through' : step.status === 'completed' ? 'text-green-700' : step.status === 'current' ? 'text-blue-700' : 'text-gray-700'}`}>
                      {step.name}
                    </span>
                    {step.status === 'future' && step.days > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                        <Clock className="size-3" />~{step.days}d
                      </span>
                    )}
                    {step.status === 'skipped' && (
                      <span className="text-[10px] text-gray-400 italic">skipped</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <Clock className="size-4 text-[#2D5F8A]" />
            <span className="text-sm font-semibold text-gray-900">
              Estimated total: ~{assessment.totalDays} business days
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── IT Security Assessment Section ──────────────────────────────────

function ITSecurityAssessmentSection() {
  const [collapsed, setCollapsed] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { data: template } = useFormTemplate('FORM-006');
  if (!template) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-between text-left"
        >
          <CardTitle className="text-sm">IT Security Assessment</CardTitle>
          {collapsed ? (
            <ChevronDown className="size-4 text-gray-400" />
          ) : (
            <ChevronUp className="size-4 text-gray-400" />
          )}
        </button>
        <p className="text-xs text-muted-foreground">
          Required for software and SaaS procurement to ensure IT security compliance.
        </p>
      </CardHeader>
      {!collapsed && (
        <CardContent>
          {!submitted ? (
            <DynamicForm
              template={template}
              onSubmit={() => setSubmitted(true)}
            />
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
              <CheckCircle className="mt-0.5 size-4 shrink-0 text-green-600" />
              <p className="text-sm font-medium text-green-800">
                IT Security Assessment submitted.
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
