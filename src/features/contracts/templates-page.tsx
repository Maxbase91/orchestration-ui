import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, Scale, Shield, Handshake, ScrollText, ClipboardList } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string;
  lastUpdated: string;
  icon: typeof FileText;
  previewContent: string;
}

const templates: Template[] = [
  {
    id: 'tpl-1',
    name: 'Standard Services Agreement',
    description: 'General-purpose services agreement for professional and managed services engagements.',
    lastUpdated: '2025-11-15',
    icon: FileText,
    previewContent: `STANDARD SERVICES AGREEMENT

This Standard Services Agreement ("Agreement") is entered into as of [Date] between [Company Name] ("Client") and [Supplier Name] ("Supplier").

1. SCOPE OF SERVICES
The Supplier shall provide the services described in Schedule A attached hereto.

2. TERM
This Agreement shall commence on [Start Date] and continue for [Duration] unless terminated earlier.

3. FEES AND PAYMENT
Client shall pay Supplier the fees set forth in Schedule B. Payment terms: Net 30 days from invoice date.

4. CONFIDENTIALITY
Both parties agree to maintain the confidentiality of all proprietary information.

5. LIMITATION OF LIABILITY
Neither party's aggregate liability shall exceed the total fees paid under this Agreement in the 12 months preceding the claim.`,
  },
  {
    id: 'tpl-2',
    name: 'Software License Agreement',
    description: 'License agreement for enterprise software including SaaS, on-premise, and hybrid deployments.',
    lastUpdated: '2025-10-20',
    icon: Scale,
    previewContent: `SOFTWARE LICENSE AGREEMENT

This Software License Agreement ("Agreement") governs the use of [Software Name] provided by [Licensor].

1. GRANT OF LICENSE
Licensor grants Client a non-exclusive, non-transferable license to use the Software for [number] users.

2. SUBSCRIPTION FEES
Annual subscription fee: [Amount]. Renewal pricing subject to [X]% cap.

3. DATA PROTECTION
Licensor shall comply with GDPR and applicable data protection regulations. Data processing addendum attached as Schedule C.

4. SERVICE LEVELS
Uptime commitment: 99.9%. Support response times defined in Schedule D.

5. INTELLECTUAL PROPERTY
All IP in the Software remains with Licensor. Client retains ownership of Client Data.`,
  },
  {
    id: 'tpl-3',
    name: 'Consulting Services Agreement',
    description: 'Agreement for advisory and consulting engagements with defined deliverables and milestones.',
    lastUpdated: '2025-12-01',
    icon: Handshake,
    previewContent: `CONSULTING SERVICES AGREEMENT

1. ENGAGEMENT SCOPE
The Consultant shall provide advisory services as described in the Statement of Work.

2. DELIVERABLES
Consultant shall deliver the following milestone-based deliverables:
- Phase 1: Discovery & Assessment
- Phase 2: Recommendations Report
- Phase 3: Implementation Support

3. FEES
Time and materials basis at rates specified in Schedule A. Monthly invoicing with detailed timesheets.

4. PERSONNEL
Key personnel assigned to the engagement may not be reassigned without Client's prior written consent.

5. CONFLICT OF INTEREST
Consultant warrants it has no conflicts of interest that would affect its ability to perform services.`,
  },
  {
    id: 'tpl-4',
    name: 'Non-Disclosure Agreement (NDA)',
    description: 'Mutual or one-way NDA for protecting confidential information during evaluations and negotiations.',
    lastUpdated: '2025-09-10',
    icon: Shield,
    previewContent: `NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement is entered into between [Disclosing Party] and [Receiving Party].

1. DEFINITION OF CONFIDENTIAL INFORMATION
"Confidential Information" means any non-public information disclosed by either party, including but not limited to technical data, trade secrets, business plans, and financial information.

2. OBLIGATIONS
The Receiving Party shall: (a) hold Confidential Information in strict confidence; (b) not disclose to third parties without prior written consent; (c) use only for the Purpose defined herein.

3. TERM
This Agreement shall remain in effect for [2] years from the date of execution.

4. EXCLUSIONS
Information that is publicly available, independently developed, or rightfully received from a third party.`,
  },
  {
    id: 'tpl-5',
    name: 'Master Services Agreement (MSA)',
    description: 'Framework agreement for ongoing supplier relationships with multiple work streams.',
    lastUpdated: '2025-11-28',
    icon: ScrollText,
    previewContent: `MASTER SERVICES AGREEMENT

1. PURPOSE
This MSA establishes the general terms under which [Supplier] will provide services to [Client] under individual Statements of Work.

2. ORDERING PROCESS
Services shall be ordered through individual SOWs that reference this MSA and specify scope, timeline, and pricing.

3. GOVERNANCE
Joint steering committee meetings quarterly. Operational reviews monthly. Escalation process per Schedule E.

4. PRICING FRAMEWORK
Rate card attached as Schedule B. Volume discounts apply per tier thresholds.

5. TERMINATION
Either party may terminate an individual SOW with 30 days notice. MSA termination requires 90 days notice.`,
  },
  {
    id: 'tpl-6',
    name: 'Statement of Work (SOW)',
    description: 'Detailed work order template for use with Master Services Agreements.',
    lastUpdated: '2025-12-05',
    icon: ClipboardList,
    previewContent: `STATEMENT OF WORK #[NUMBER]

Under Master Services Agreement dated [MSA Date]

1. PROJECT OVERVIEW
[Brief description of the work to be performed]

2. SCOPE
In scope: [List items]
Out of scope: [List exclusions]

3. DELIVERABLES & MILESTONES
| Milestone | Deliverable | Target Date | Acceptance Criteria |
|-----------|-------------|-------------|---------------------|
| M1        | [...]       | [Date]      | [Criteria]          |

4. PRICING
Fixed price / Time & Materials: [Amount]
Payment schedule: [Upon milestone completion / Monthly]

5. ASSUMPTIONS & DEPENDENCIES
[List key assumptions and client dependencies]`,
  },
];

function formatTemplateDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function TemplatesPage() {
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader title="Contract Templates" subtitle="Standardised templates for common agreement types" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((tpl) => {
          const Icon = tpl.icon;
          return (
            <div
              key={tpl.id}
              className="rounded-md border bg-white p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setPreviewTemplate(tpl)}
            >
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-gray-100 p-2">
                  <Icon className="size-5 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900">{tpl.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{tpl.description}</p>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Last updated: {formatTemplateDate(tpl.lastUpdated)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewTemplate(tpl);
                  }}
                >
                  Use Template
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={previewTemplate !== null} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {previewTemplate && (
            <>
              <DialogHeader>
                <DialogTitle>{previewTemplate.name}</DialogTitle>
              </DialogHeader>
              <pre className="mt-4 whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 rounded-md p-4 font-mono leading-relaxed">
                {previewTemplate.previewContent}
              </pre>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPreviewTemplate(null)}>
                  Close
                </Button>
                <Button onClick={() => setPreviewTemplate(null)}>
                  Use This Template
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
