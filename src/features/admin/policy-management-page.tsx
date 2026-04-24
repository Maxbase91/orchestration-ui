import { useState } from 'react';
import {
  Archive,
  ChevronDown,
  ChevronRight,
  Download,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/status-badge';
import { PageHeader } from '@/components/shared/page-header';

interface Policy {
  id: string;
  title: string;
  status: 'active' | 'draft';
  lastUpdated: string;
  version: string;
  owner: string;
  description: string;
  fullText: string;
}

const policies: Policy[] = [
  {
    id: 'pol-1',
    title: 'Procurement Thresholds & Buying Channels',
    status: 'active',
    lastUpdated: '2025-11-15',
    version: '3.2',
    owner: 'Christine Dupont',
    description:
      'Defines spending thresholds and the appropriate buying channel for each value band.',
    fullText:
      'All procurement requests must be routed through the correct buying channel based on estimated value. Requests under EUR 10,000 may use the catalogue or direct PO channel. Requests between EUR 10,000 and EUR 100,000 require Procurement-led procurement with standard approval. Requests above EUR 100,000 require competitive tendering and VP-level approval.\n\nFramework agreements take priority over ad-hoc procurement wherever an approved framework exists. Business units must check the framework register before initiating new sourcing activities.\n\nExceptions to buying channel rules require documented justification and approval from the VP Procurement. All exceptions are tracked and reported quarterly.',
  },
  {
    id: 'pol-2',
    title: 'Supplier Risk Assessment Policy',
    status: 'active',
    lastUpdated: '2025-09-20',
    version: '2.1',
    owner: 'Lisa Nakamura',
    description:
      'Mandatory supplier risk assessment (SRA) requirements for all suppliers.',
    fullText:
      'All suppliers must undergo a Supplier Risk Assessment (SRA) before any contract can be executed. The assessment covers financial stability, sanctions screening, data protection compliance, ESG criteria, and business continuity capabilities.\n\nSRA assessments are valid for 24 months and must be renewed before expiry. Suppliers with expiring assessments will be flagged 90 days in advance. No new purchase orders may be issued against suppliers with expired SRAs.\n\nHigh-risk suppliers require enhanced due diligence including on-site audits and independent verification of financial statements. Critical suppliers must maintain a minimum performance score of 70/100.',
  },
  {
    id: 'pol-3',
    title: 'Contract Management Standards',
    status: 'active',
    lastUpdated: '2025-10-01',
    version: '4.0',
    owner: 'Marcus Johnson',
    description:
      'Standards for contract creation, review, execution, and lifecycle management.',
    fullText:
      'All contracts must be created using approved templates and follow the standard review process. Contracts above EUR 50,000 require legal review. Contracts above EUR 250,000 require both legal and finance review.\n\nContract renewals must be initiated at least 90 days before expiry. Auto-renewal clauses are discouraged and require explicit approval. All contracts must include termination for convenience clauses with a maximum 90-day notice period.\n\nContract utilisation is monitored monthly. Contracts with utilisation below 50% after 6 months are flagged for review. Unused framework positions must be reported to the procurement lead quarterly.',
  },
  {
    id: 'pol-4',
    title: 'Travel & Expense Procurement',
    status: 'active',
    lastUpdated: '2025-08-12',
    version: '2.0',
    owner: 'Anna Mueller',
    description:
      'Guidelines for travel-related procurement including flights, hotels, and ground transport.',
    fullText:
      'All corporate travel must be booked through the approved Travel Management Company (TMC). Direct bookings are only permitted in emergency situations with documented justification. Economy class is the default for flights under 6 hours; premium economy may be approved for flights over 6 hours.\n\nHotel bookings must comply with the city-specific rate caps published quarterly. Conference and event venues require competitive quotes for events exceeding EUR 10,000 in total value.\n\nExpense claims must be submitted within 30 days of travel completion. All claims over EUR 500 require line manager approval.',
  },
  {
    id: 'pol-5',
    title: 'IT Software & SaaS Purchasing',
    status: 'active',
    lastUpdated: '2025-12-05',
    version: '3.0',
    owner: 'Sarah Chen',
    description:
      'Policies governing software licensing, SaaS subscriptions, and cloud service procurement.',
    fullText:
      'All software and SaaS purchases must be reviewed by IT Procurement regardless of value. Shadow IT is not permitted. Business units must submit a procurement request for any new software tool, including free-tier services that process company data.\n\nSaaS contracts must include data portability clauses, processing agreements compliant with GDPR, and maximum annual price escalation caps of 5%. Multi-year commitments exceeding EUR 100,000 require market benchmarking.\n\nLicense true-ups must be reconciled quarterly. Unused licenses identified during reviews must be terminated at the next renewal opportunity.',
  },
  {
    id: 'pol-6',
    title: 'Consulting Engagement Policy',
    status: 'active',
    lastUpdated: '2025-07-18',
    version: '2.5',
    owner: 'Marcus Johnson',
    description:
      'Requirements for engaging external consultants and advisory firms.',
    fullText:
      'All consulting engagements must be Procurement-led regardless of value. A detailed scope of work, deliverables, and success criteria must be defined before procurement begins. Rate cards must be benchmarked against market data annually.\n\nFor engagements above EUR 100,000, a minimum of three competitive proposals is required. Single-source justifications require VP Procurement approval. Engagements above EUR 500,000 require dual VP approval.\n\nPerformance reviews are mandatory at project milestones. Consultants with performance scores below 60/100 will be removed from the approved panel.',
  },
  {
    id: 'pol-7',
    title: 'Sustainable Procurement Guidelines',
    status: 'draft',
    lastUpdated: '2026-01-10',
    version: '0.9',
    owner: 'Christine Dupont',
    description:
      'Framework for incorporating sustainability criteria into procurement decisions.',
    fullText:
      'All procurement events above EUR 50,000 must include sustainability evaluation criteria with a minimum weighting of 10%. Suppliers must demonstrate commitment to carbon reduction targets aligned with the Paris Agreement.\n\nISO 14001 certification is preferred for all Tier 1 and Tier 2 suppliers. Packaging reduction and recyclability requirements apply to all goods procurement. Single-use plastics are prohibited in catering and facilities contracts.\n\nAnnual sustainability scorecards will be published for the top 20 suppliers by spend. Suppliers failing to meet minimum ESG thresholds will be placed on a remediation programme.',
  },
  {
    id: 'pol-8',
    title: 'Emergency Purchasing Procedure',
    status: 'draft',
    lastUpdated: '2026-02-28',
    version: '0.5',
    owner: 'Anna Mueller',
    description:
      'Procedures for urgent and emergency procurement outside standard processes.',
    fullText:
      'Emergency procurement is defined as situations where delay would cause immediate harm to business operations, health and safety, or regulatory compliance. The requesting business unit must document the nature of the emergency and the consequences of delay.\n\nEmergency purchases up to EUR 25,000 may be approved by the Category Manager alone. Above EUR 25,000, VP Procurement approval is required within 24 hours. All emergency purchases must be regularised through a standard procurement request within 5 business days.\n\nEmergency procurement usage is monitored monthly. Departments with more than 3 emergency requests per quarter will be subject to process review.',
  },
];

export function PolicyManagementPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Policy Management"
        subtitle="View and manage procurement policies"
      />

      <div className="space-y-3">
        {policies.map((policy) => {
          const isExpanded = expandedId === policy.id;

          return (
            <Card key={policy.id} className="overflow-hidden">
              <button
                className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-gray-50"
                onClick={() => toggleExpand(policy.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isExpanded ? (
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{policy.title}</p>
                      <StatusBadge status={policy.status} size="sm" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {policy.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-xs text-muted-foreground">
                  <span>v{policy.version}</span>
                  <span>{policy.owner}</span>
                  <span>Updated {policy.lastUpdated}</span>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t px-5 py-4 space-y-4">
                  <div className="prose prose-sm max-w-none">
                    {policy.fullText.split('\n\n').map((paragraph, idx) => (
                      <p key={idx} className="text-sm text-gray-700 mb-3">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                  <div className="flex gap-2 border-t pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      title="Policy editing ships with the policy-management backend (future phase)."
                    >
                      <Pencil className="mr-1.5 size-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      title="Policy archive ships with the policy-management backend (future phase)."
                    >
                      <Archive className="mr-1.5 size-3.5" />
                      Archive
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      title="Policy download ships with the document-storage phase."
                    >
                      <Download className="mr-1.5 size-3.5" />
                      Download
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
