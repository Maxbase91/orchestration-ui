// The Overview tab: the request's facts, grouped as a reader asks about them —
// what is being bought, who is involved, and when — and its service
// description.
//
// Removed: an "AI-generated · Request Summary" panel. It was a sentence template
// in lib/mock-ai.ts filled with fields already on this tab, in their raw ids
// ("the "risk" stage", "buying channel: procurement-led"), under a claim that a
// model had written it. Same defect, same decision, as the approvals card.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Copy, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { ProcurementRequest } from '@/data/types';
import { useUserLookup, useUsers } from '@/lib/db/hooks/use-users';
import { useSupplierLookup, useSuppliers } from '@/lib/db/hooks/use-suppliers';
import { formatCurrency, formatDate } from '@/lib/format';
import { useCategoryLabel } from '@/lib/db/hooks/use-procurement-categories';
import { buyingChannelLabel } from '@/lib/routing/evaluate-routing-rules';
import { useServiceDescription } from '@/lib/db/hooks/use-service-descriptions';
import { SupplierFacts } from '@/components/shared/supplier-facts';
import { useChannelStageMap } from '@/lib/db/hooks/use-channel-stage-map';
import { getStagesForChannel } from '@/lib/workflow/channel-stages';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// The sourcing route determined at intake. Requests created before this was
// persisted have no value, so the fact renders an em dash rather than being
// hidden — consistent with every other Fact.
const SOURCING_TYPE_LABELS: Record<string, string> = {
  'new-event': 'New Event',
  renewal: 'Renewal',
  benchmarking: 'Benchmarking',
  none: 'None',
};

interface TabOverviewProps {
  request: ProcurementRequest;
}

/** One fact: label over value, so a group reads down a narrow column. */
function Fact({
  label,
  value,
  to,
}: {
  label: string;
  value: string | undefined;
  /** When set and `value` is present, the value links (e.g. to the supplier's profile). */
  to?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-caption text-ink-3">{label}</dt>
      <dd className="mt-0.5 truncate text-body text-ink" title={value}>
        {value && to ? (
          <Link to={to} className="text-accent hover:underline">{value}</Link>
        ) : (
          // An em dash, not a hyphen: a hyphen reads as a value in a column of values.
          value ?? <span className="text-ink-3">—</span>
        )}
      </dd>
    </div>
  );
}

/** A titled group of facts, laid out as one of three columns. */
function FactGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-eyebrow font-semibold uppercase tracking-wide text-ink-3">{title}</h3>
      <dl className="space-y-3">{children}</dl>
    </div>
  );
}

const SOW_LABELS: Record<string, string> = {
  objective: 'Objective',
  scope: 'Scope of Work',
  deliverables: 'Deliverables',
  timeline: 'Timeline',
  resources: 'Resources',
  acceptanceCriteria: 'Acceptance Criteria',
  pricingModel: 'Pricing Model',
  location: 'Location',
  dependencies: 'Dependencies',
};

export function TabOverview({ request }: TabOverviewProps) {
  useSuppliers();
  const { data: stageMap, isLoading: stageMapLoading } = useChannelStageMap();
  useUsers();
  const lookupSupplier = useSupplierLookup();
  const lookupUser = useUserLookup();
  const requestor = lookupUser(request.requestorId);
  const owner = lookupUser(request.ownerId);
  const supplier = lookupSupplier(request.supplierId);
  const categoryLabel = useCategoryLabel();
  const { data: svcDesc } = useServiceDescription(request.id);
  const [sowExpanded, setSowExpanded] = useState(true);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <div className="grid grid-cols-1 gap-x-10 gap-y-6 md:grid-cols-2 xl:grid-cols-4">
            <FactGroup title="What">
              <Fact label="Category" value={categoryLabel(request.category)} />
              <Fact label="Commodity / service family" value={`${request.commodityCode} · ${request.commodityCodeLabel}`} />
              <Fact label="Value" value={formatCurrency(request.value, request.currency)} />
              <Fact label="Buying channel" value={buyingChannelLabel(request.buyingChannel)} />
              <Fact
                label="Sourcing type"
                value={request.sourcingType ? SOURCING_TYPE_LABELS[request.sourcingType] ?? request.sourcingType : undefined}
              />
            </FactGroup>
            <FactGroup title="Who">
              <Fact label="Requester" value={requestor?.name} />
              <Fact
                label="Buying for"
                value={
                  request.beneficiaryId && request.beneficiaryId !== request.requestorId
                    ? `${request.beneficiaryName ?? 'Someone else'}${request.beneficiaryCountry ? ` · ${request.beneficiaryCountry}` : ''}`
                    : `${requestor?.name ?? 'Requester'} (self)`
                }
              />
              {request.requesterCountry && <Fact label="Requester location" value={request.requesterCountry} />}
              <Fact label="Current owner" value={owner?.name} />
              <Fact label="Budget owner" value={request.budgetOwner} />
              <Fact label="Cost centre" value={request.costCentre} />
            </FactGroup>
            <section className="space-y-3" aria-label="Supplier">
              <h3 className="text-eyebrow font-semibold uppercase tracking-wide text-ink-3">Supplier</h3>
              {/* Whether preferred suppliers are invited depends on whether this
                  request's workflow has a Sourcing stage — read from the
                  template that claims its channel, not from a list of channels. */}
              <SupplierFacts
                supplierId={request.supplierId}
                category={request.category}
                sourcing={stageMapLoading ? 'unknown'
                  : getStagesForChannel(stageMap, request.buyingChannel).includes('sourcing') ? 'will-source' : 'no-sourcing'}
              />
              {supplier && (
                <Link to={`/suppliers/${supplier.id}`} className="text-caption text-accent hover:underline">
                  Open the supplier's profile
                </Link>
              )}
            </section>
            <FactGroup title="When">
              <Fact label="Needed by" value={formatDate(request.deliveryDate)} />
              <Fact label="Days in current stage" value={String(request.daysInStage)} />
              <Fact label="Created" value={formatDate(request.createdAt)} />
              <Fact label="Last updated" value={formatDate(request.updatedAt)} />
            </FactGroup>
          </div>
          {!svcDesc?.narrative && request.businessJustification && (
            <div className="mt-6 border-t border-line-2 pt-4">
              <p className="mb-1 text-caption text-ink-3">Request description</p>
              <p className="max-w-[75ch] text-body text-ink-2">{request.businessJustification}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Service Description / SOW */}
      {svcDesc && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSowExpanded(!sowExpanded)}
                className="flex items-center gap-2 text-left"
              >
                <FileText className="size-4 text-accent" />
                <CardTitle className="text-base">Service Description</CardTitle>
                {/* This read `quality_score` through a double cast on a record the
                    mapper had already camel-cased, so it was always undefined
                    and the badge never rendered once. */}
                {svcDesc.qualityScore != null && (
                  <span className={`ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-eyebrow font-semibold ${
                    svcDesc.qualityScore >= 80 ? 'bg-ok-soft text-ok'
                      : svcDesc.qualityScore >= 60 ? 'bg-warn-soft text-warn'
                        : 'bg-stop-soft text-stop'
                  }`}>
                    <ShieldCheck className="size-3" aria-hidden="true" />
                    Quality {svcDesc.qualityScore}/100
                  </span>
                )}
                {sowExpanded ? <ChevronUp className="size-4 text-ink-3" /> : <ChevronDown className="size-4 text-ink-3" />}
              </button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => {
                  navigator.clipboard.writeText(svcDesc.narrative);
                  toast.success('Narrative copied to clipboard');
                }}
              >
                <Copy className="size-3.5" />
                Copy Summary
              </Button>
            </div>
          </CardHeader>
          {sowExpanded && (
            <CardContent className="space-y-4">
              {/* Structured Sections */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {Object.entries(SOW_LABELS).map(([key, label]) => {
                  // SOW_LABELS names only the text sections; the record also
                  // carries the quality gate and the signals, which are not
                  // section bodies and must not be rendered as one.
                  const value = svcDesc[key as keyof typeof svcDesc];
                  if (typeof value !== 'string' || !value || key === 'narrative') return null;
                  return (
                    // No green tick per section: it read as "checked and passed"
                    // when all it meant was "this field has text".
                    <div key={key} className="space-y-1">
                      <p className="text-eyebrow font-semibold uppercase tracking-wide text-ink-3">{label}</p>
                      <p className="text-body leading-relaxed text-ink-2">{value}</p>
                    </div>
                  );
                })}
              </div>

              {/* Narrative Summary */}
              <div className="pt-4 border-t border-line-2">
                <p className="mb-2 text-eyebrow font-semibold uppercase tracking-wide text-ink-3">Narrative summary</p>
                <div className="rounded-lg bg-card-2 border border-line p-4">
                  <p className="max-w-[75ch] whitespace-pre-wrap text-body leading-relaxed text-ink-2">{svcDesc.narrative}</p>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
