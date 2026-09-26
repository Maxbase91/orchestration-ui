// The Channel page for a contract call-off. Its submit used to sit on the
// call-off form, whose button read "Review request" and submitted instead, so a
// call-off was the one Door 1 route whose requester never saw where it would go.
// The details are now captured in the conversation, and changed there.
//
// The governed decision is built by `buildCallOff`, the same builder submit
// calls, and the request lands where `checkoutEntryStage` puts it — the rule
// the checkout endpoint writes with. Approvers are derived only when the
// decision asks for approval, exactly as the endpoint does.
import { useMemo } from 'react';
import type { Contract, Supplier } from '@/data/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { useApproversOnSubmit } from '@/lib/db/hooks/use-derived-approvers';
import { callOffChecks } from '@/lib/procurement/channel-checks';
import { checkoutEntryStage, CHECKOUT_ENTRY_CONDITIONS } from '@/lib/procurement/governed-checkout';
import { onboardingRequired } from '@/lib/workflow/onboarding-stage';
import { submitNoteFor, type PlanInput } from '@/lib/workflow/channel-plan';
import type { CallOff } from '../call-off';
import type { ContractCallOffDraft } from '../conversation/call-off-agenda';
import { ChannelPage, ChecksList, FactList, PanelGroup, SupplierList } from './channel-page';
import { useChannelPlan } from './use-channel-plan';

interface StepChannelCallOffProps {
  callOff: CallOff;
  draft: ContractCallOffDraft;
  contract: Contract;
  supplier: Supplier;
  costCentres: Array<{ id: string; label: string }>;
  deliveryLocations: Array<{ id: string; label: string }>;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}

export function StepChannelCallOff(props: StepChannelCallOffProps) {
  const { callOff, draft, contract, supplier } = props;
  const { decision } = callOff;
  const input = useMemo<PlanInput>(() => ({
    entryStage: checkoutEntryStage('contract-call-off', decision.status),
    entryConditions: CHECKOUT_ENTRY_CONDITIONS,
    context: {
      value: decision.totalValue,
      category: callOff.request.category,
      riskRequired: decision.riskReviewRequired,
      contractAmendmentRequired: decision.contractAmendmentRequired,
      onboardingRequired: onboardingRequired(supplier),
      supplierId: supplier.id,
      contractId: contract.id,
    },
  }), [decision, callOff.request.category, supplier, contract.id]);
  const { template, plan, copy, config, isLoading } = useChannelPlan('framework-call-off', input);

  const { data: approvers } = useApproversOnSubmit(
    decision.approvalRequired
      ? { requestId: 'preview', route: 'contract-call-off', category: callOff.request.category ?? null, contractId: contract.id, costCentre: decision.resolved.costCentre ?? null }
      : null,
    null,
    decision.totalValue,
  );
  const checks = callOffChecks({
    decision,
    contract: { title: contract.title, supplierName: contract.supplierName, endDate: formatDate(contract.endDate) },
    riskAssessment: callOff.riskAssessment ? { title: callOff.riskAssessment.title, validUntil: formatDate(callOff.riskAssessment.validUntil) } : null,
    approvers: approvers ?? null,
    directCallOffLimit: config.directCallOffLimit,
    autoApprovalThreshold: config.catalogueAutoApprovalThreshold,
  });

  // An auto-approved call-off has its purchase order raised in the same write
  // (api/governed-checkout.ts), so "sends it to PO Creation" would undersell it.
  const submitNote = plan?.entry?.status === 'po'
    ? 'Submitting raises the purchase order against the contract straight away.'
    : submitNoteFor(plan, 'call-off');
  const centre = props.costCentres.find((c) => c.id === draft.costCentre);
  const location = props.deliveryLocations.find((l) => l.id === draft.deliveryLocation);

  return (
    <ChannelPage
      headline={copy.headline}
      detail={copy.detail}
      templateName={template ? `${template.id} ${template.name}` : null}
      plan={plan}
      loading={isLoading}
      value={decision.totalValue}
      config={config}
      hints={{ riskReused: !decision.riskReviewRequired && Boolean(callOff.riskAssessment) }}
      backLabel="Back to the conversation"
      onBack={props.onBack}
      submitLabel="Submit the call-off"
      submitNote={submitNote}
      onSubmit={props.onSubmit}
      // The server refuses what the decision refuses; the button says so first.
      canSubmit={decision.ok}
      submitting={props.submitting}
      changeLabel="Change in the conversation"
      onChange={props.onBack}
    >
      <PanelGroup title="The call-off">
        <FactList rows={[
          { label: 'Title', value: draft.title },
          { label: 'Contract', value: contract.title },
          { label: 'Value', value: formatCurrency(decision.totalValue, decision.currency) },
          { label: 'Need by', value: draft.needBy ? formatDate(draft.needBy) : '—' },
          ...(draft.serviceStartDate || draft.serviceEndDate
            ? [{ label: 'Service', value: [draft.serviceStartDate, draft.serviceEndDate].filter(Boolean).map((d) => formatDate(d)).join(' – ') }]
            : []),
          { label: 'Purpose', value: draft.purpose },
        ]} />
      </PanelGroup>

      <PanelGroup title="Who and where">
        <FactList rows={[
          { label: 'For', value: draft.recipient },
          { label: 'Charged to', value: centre ? `${centre.id} · ${centre.label}` : draft.costCentre },
          { label: 'Deliver to', value: location?.label ?? draft.deliveryLocation },
        ]} />
      </PanelGroup>

      <PanelGroup title="Supplier">
        <FactList rows={[{ label: 'Supplier', value: `${supplier.name} — from the contract` }]} />
        <SupplierList
          title=""
          items={[]}
          note="A call-off uses the contract's supplier, so nothing is sourced and nobody is invited."
        />
      </PanelGroup>

      <PanelGroup title="Checks">
        <ChecksList checks={checks} />
      </PanelGroup>
    </ChannelPage>
  );
}
