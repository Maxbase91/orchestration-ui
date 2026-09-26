// The Channel page for a full request — procurement-led or business-led — the
// step that replaced Review & submit.
//
// Every value here comes from what submit uses: the channel and the checks
// from the intake determination submit records, the landing from
// `firstActionableStage` (the intake writer's own rule), the approvers from the
// derivation submit writes, and who sourcing will invite from
// `sourcingInvitees`, the function the sourcing event calls. Submit itself is
// the page's existing atomic intake submit.
import { useMemo, useState } from 'react';
import type { IntakeDetermination } from '@/lib/procurement/intake-determination';
import type { Supplier } from '@/data/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency, formatDate } from '@/lib/format';
import { parseDeliveryDate } from '@/lib/parse-delivery-date';
import { useChannelStageMap } from '@/lib/db/hooks/use-channel-stage-map';
import { useApproversOnSubmit } from '@/lib/db/hooks/use-derived-approvers';
import { requestChecks } from '@/lib/procurement/channel-checks';
import { gapsAgainstFinal } from '@/lib/procurement/demand-signals';
import { sectionValuesOf } from '@/lib/procurement/service-description-seed';
import { isPreferredSupplierOverride } from '@/lib/procurement/supplier-preference';
import { sourcingInvitees } from '@/lib/procurement/sourcing-invitees';
import { firstActionableStage, INTAKE_ENTRY_CONDITIONS } from '@/lib/workflow/channel-stages';
import { onboardingRequired } from '@/lib/workflow/onboarding-stage';
import { submitNoteFor, type PlanInput } from '@/lib/workflow/channel-plan';
import type { IntakeFormData } from '../intake-form-data';
import { ChannelPage, ChecksList, FactList, PanelGroup, SupplierList } from './channel-page';
import { ChannelWorkings } from './channel-workings';
import { useChannelPlan } from './use-channel-plan';

interface StepChannelRequestProps {
  formData: IntakeFormData;
  determination: IntakeDetermination;
  suppliers: Supplier[];
  preferredSupplierIds: readonly string[];
  /** The category's service-description sections, in template order. */
  sections: Array<{ id: string; label: string }>;
  costCentres: Array<{ id: string; label: string }>;
  requester: { id: string; name: string };
  onBack: () => void;
  onSubmit: () => void;
  onSaveDraft: () => void;
  submitting: boolean;
}

const INVITE_TAG = { named: 'You named them', shortlist: 'On your shortlist', preferred: 'Preferred' } as const;

export function StepChannelRequest(props: StepChannelRequestProps) {
  const { formData, determination: d } = props;
  const channel = d.buyingChannelSlug;
  const { data: stageMap } = useChannelStageMap();
  const supplier = props.suppliers.find((s) => s.id === formData.supplierId);

  // Onboarding is decided when the engine leaves risk, from the request's
  // supplier then (engine.ts needsOnboarding). With a supplier chosen that is
  // knowable now, by the same function; with none it is walked both ways.
  const input = useMemo<PlanInput>(() => ({
    entryStage: firstActionableStage(stageMap, channel, { riskAssessmentRequired: d.riskAssessmentRequired }),
    entryConditions: INTAKE_ENTRY_CONDITIONS,
    context: {
      value: formData.estimatedValue,
      category: formData.category,
      riskRequired: d.riskAssessmentRequired,
      onboardingRequired: supplier ? onboardingRequired(supplier) : undefined,
      supplierId: formData.supplierId || undefined,
      commodityCode: formData.commodityCode || undefined,
      isUrgent: formData.isUrgent,
      riskTier: d.inherentRisk.tier,
    },
    unknown: supplier ? [] : ['onboardingRequired'],
  }), [stageMap, channel, d, formData.estimatedValue, formData.category, formData.supplierId, formData.commodityCode, formData.isUrgent, supplier]);
  const { template, plan, copy, config, isLoading } = useChannelPlan(channel, input);

  const override = isPreferredSupplierOverride(formData.supplierId, props.preferredSupplierIds);
  const overrideNeedsApproval = override && config.preferredSupplierOverrideNeedsApproval;
  const { data: approvers } = useApproversOnSubmit(
    { requestId: 'preview', category: formData.category, costCentre: formData.costCentre, contractId: formData.contractId || null, supplierOverride: overrideNeedsApproval },
    d.approvalChain,
    formData.estimatedValue,
  );

  const lookup = (id: string | undefined) => props.suppliers.find((s) => s.id === id);
  const sourced = Boolean(plan?.stages.some((s) => s.status === 'sourcing' && s.applicability.kind !== 'skipped'));
  const invitees = sourced
    ? sourcingInvitees({ namedSupplierId: formData.supplierId, shortlistIds: formData.supplierCandidateIds, preferredIds: props.preferredSupplierIds, lookup })
    : null;

  const sd = sectionValuesOf(formData.serviceDescription);
  const labelOf = (id: string) => props.sections.find((s) => s.id === id)?.label ?? id;
  const required = formData.sowRequiredSections ?? [];
  const missing = gapsAgainstFinal(required, sd).map(labelOf);
  const checks = requestChecks({
    determination: d,
    approvers: approvers ?? null,
    missingSections: missing,
    supplierPreferred: formData.supplierId ? !override : null,
    overrideNeedsApproval,
    sourcingInvites: invitees ? { total: invitees.length, preferred: invitees.filter((i) => i.reason === 'preferred').length } : null,
  });

  const [readingSections, setReadingSections] = useState(false);
  const narrative = formData.serviceDescription?.narrative?.trim() ?? '';
  const needBy = parseDeliveryDate(formData.deliveryDate);
  const centre = props.costCentres.find((c) => c.id === formData.costCentre);
  const forSomeoneElse = formData.beneficiaryId && formData.beneficiaryId !== props.requester.id;

  return (
    <>
      <ChannelPage
        headline={copy.headline}
        detail={copy.detail}
        templateName={template ? `${template.id} ${template.name}` : null}
        plan={plan}
        loading={isLoading}
        value={formData.estimatedValue}
        config={config}
        hints={{ riskReused: !d.riskAssessmentRequired && d.matchingRiskAssessments.length > 0 }}
        backLabel="Back to the conversation"
        onBack={props.onBack}
        submitLabel="Submit the request"
        submitNote={submitNoteFor(plan, 'request')}
        onSubmit={props.onSubmit}
        canSubmit
        submitting={props.submitting}
        onSaveDraft={props.onSaveDraft}
        changeLabel="Change in the conversation"
        onChange={props.onBack}
      >
        {narrative && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-card px-3 py-2.5">
            <span className="text-eyebrow font-semibold uppercase tracking-[0.08em] text-ink-3">Service description — executive summary</span>
            <p className="line-clamp-6 text-caption leading-relaxed text-ink-2">{narrative}</p>
            <span className="text-eyebrow text-ink-3">
              Written from your answers
              {required.length > 0 && ` · ${required.length - missing.length} of ${required.length} required sections`}
              {' · '}
              <button type="button" className="font-medium text-accent hover:underline" onClick={() => setReadingSections(true)}>
                Read all sections
              </button>
            </span>
          </div>
        )}

        <PanelGroup title="The request">
          <FactList rows={[
            { label: 'Title', value: formData.title },
            { label: 'Category', value: [formData.categoryDescription || formData.category, formData.commodityCodeLabel].filter(Boolean).join(' · ') },
            { label: 'Value', value: formatCurrency(formData.estimatedValue, formData.currency) },
            { label: 'Need by', value: needBy ? formatDate(needBy) : formData.deliveryDate || '—' },
            ...(formData.isUrgent ? [{ label: 'Urgency', value: 'Urgent' }] : []),
          ]} />
        </PanelGroup>

        <PanelGroup title="Who and where">
          <FactList rows={[
            { label: 'Buying for', value: forSomeoneElse ? formData.beneficiaryName || formData.beneficiaryId : `${props.requester.name} (you)` },
            { label: 'Charged to', value: centre ? `${centre.id} · ${centre.label}` : formData.costCentre || '—' },
          ]} />
        </PanelGroup>

        <PanelGroup title="Supplier">
          <FactList rows={[{
            label: 'Supplier',
            value: formData.supplier
              ? formData.supplier
              : <span className="italic text-ink-3">{sourced ? 'Not chosen — sourcing selects one' : 'Not chosen yet — you choose one'}</span>,
          }]} />
          {invitees ? (
            <SupplierList
              title="Invited when sourcing starts"
              items={invitees.map((i) => ({ id: i.id, name: i.name, tag: INVITE_TAG[i.reason], tone: i.reason === 'preferred' ? 'ok' : 'accent' }))}
              note={invitees.length > 0
                ? 'Everyone here goes into the sourcing event; procurement can add others.'
                : 'This category has no preferred suppliers and you named none, so procurement chooses who to invite.'}
            />
          ) : (
            <SupplierList
              title="Preferred suppliers for this category"
              items={props.preferredSupplierIds
                .map((id) => lookup(id))
                .filter((s): s is Supplier => Boolean(s))
                .map((s) => ({ id: s.id, name: s.name, tag: s.id === formData.supplierId ? 'Your choice' : 'Preferred', tone: s.id === formData.supplierId ? 'accent' : 'ok' }))}
              note={props.preferredSupplierIds.length > 0
                ? `Choosing a supplier outside this list needs a reason${config.preferredSupplierOverrideNeedsApproval ? ', and the category manager approves the choice' : ''}.`
                : undefined}
            />
          )}
        </PanelGroup>

        <PanelGroup title="Checks">
          <ChecksList checks={checks} />
        </PanelGroup>

        <ChannelWorkings
          determination={d}
          requestTitle={formData.title}
          category={formData.category}
          estimatedValue={formData.estimatedValue}
          supplierName={supplier?.name ?? (formData.supplier || undefined)}
          sections={props.sections.map((s) => ({ label: s.label, body: sd[s.id] ?? '', required: required.includes(s.id) }))}
          narrative={narrative || undefined}
          qualityScore={formData.sowQualityScore}
        />
      </ChannelPage>

      <Dialog open={readingSections} onOpenChange={setReadingSections}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Service description</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {props.sections.map((section) => (
              <div key={section.id} className="flex flex-col gap-1">
                <h3 className="text-caption font-semibold text-ink">
                  {section.label}
                  {required.includes(section.id) && <span className="ml-1.5 font-normal text-ink-3">required</span>}
                </h3>
                <p className="whitespace-pre-line text-caption leading-relaxed text-ink-2">
                  {sd[section.id]?.trim() || <span className="italic text-ink-3">Not written</span>}
                </p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
