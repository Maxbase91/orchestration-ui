import { useState } from 'react';
import { Search, ThumbsUp, ThumbsDown, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';

interface Article {
  id: string;
  title: string;
  content: string;
}

interface KBCategory {
  name: string;
  articles: Article[];
}

const categories: KBCategory[] = [
  {
    name: 'Getting Started',
    articles: [
      {
        id: 'gs-1',
        title: 'How to submit a procurement request',
        content:
          'To submit a new procurement request, navigate to Requests in the sidebar and click "New Request". The request form has four steps: Basic Information (title, description, category, priority), Requirements (specifications, delivery date, budget), Supplier Preferences (preferred suppliers, buying channel), and Review & Submit.\n\nEach request is automatically assigned a unique ID (e.g. REQ-2024-0001) and routed to the appropriate procurement team based on category and value. You can track your request at any time from the "My Requests" page.\n\nTip: The AI assistant can help you fill in commodity codes and suggest the correct buying channel based on your description. Just start typing and watch for the suggestions.',
      },
      {
        id: 'gs-2',
        title: 'Understanding buying channels',
        content:
          'The platform supports five buying channels, each designed for different procurement needs:\n\n1. Procurement-Led: Full procurement support from the Procurement team. Required for consulting, high-value purchases, and strategic sourcing. The procurement team manages the entire process from sourcing to contracting.\n\n2. Business-Led: Self-service procurement with oversight. Suitable for routine services under EUR 50,000 where the business unit has domain expertise. Procurement provides templates and guidance.\n\n3. Direct PO: For pre-approved suppliers with existing agreements. Streamlined process that skips sourcing. Typically used for repeat orders from approved vendors.\n\n4. Framework Call-Off: Orders placed against existing framework agreements. The fastest channel, as terms and pricing are pre-negotiated. Check the framework register before starting new sourcing.\n\n5. Catalogue: Standardised items available through our internal catalogue system. One-click ordering with automatic approval for items under EUR 5,000.',
      },
      {
        id: 'gs-3',
        title: 'Your dashboard explained',
        content:
          'The dashboard provides a real-time overview of your procurement activities. Key sections include:\n\nKPI Cards: Show your open requests, pending approvals, overdue items, and active contracts at a glance. Click any card to drill down into the details.\n\nRequest Pipeline: Visual representation of requests across workflow stages. Hover over any stage to see the count and average time spent. Red indicators highlight bottlenecks.\n\nRecent Activity: A timeline of the latest actions across your requests, including status changes, approvals, and comments. This helps you stay informed without checking each request individually.\n\nSpend Overview: Monthly spend trends with breakdown by category. Useful for tracking budget consumption and identifying areas where framework agreements could reduce costs.',
      },
    ],
  },
  {
    name: 'Requests & Approvals',
    articles: [
      {
        id: 'ra-1',
        title: 'Request lifecycle stages',
        content:
          'Every procurement request moves through up to 10 stages:\n\n1. Draft: Initial creation, not yet submitted. You can save and return to complete later.\n2. Intake: Submitted and being reviewed by the procurement team for completeness and classification.\n3. Validation: Business justification and budget verification. May involve clarification questions.\n4. Approval: Sent to the approval chain based on value and category. Multiple approvers may be required.\n5. Sourcing: Procurement team runs the sourcing process (quotes, RFx, negotiations).\n6. Contracting: Legal review and contract execution with the selected supplier.\n7. PO: Purchase order creation and submission to the supplier.\n8. Receipt: Goods or services delivered and confirmed by the requestor.\n9. Invoice: Supplier invoice received and matched against PO.\n10. Payment: Invoice approved and payment processed.\n\nNot all requests go through every stage. Direct PO and catalogue orders skip the sourcing and contracting stages.',
      },
      {
        id: 'ra-2',
        title: 'How approvals work',
        content:
          'Approvals are routed automatically based on the request value and category. The system uses pre-configured approval chains:\n\nFast-Track (under EUR 10k): Category Manager only.\nStandard (EUR 10k-100k): Budget Owner, then Category Manager, then Finance.\nVP-Level (EUR 100k-500k): Adds VP Procurement to the standard chain.\nBoard-Level (over EUR 500k): Adds CFO and Board approval.\n\nEach approver receives an email notification and can approve directly from the notification or from the Approvals page. SLA timers start when the approval request is sent. If an approver does not respond within 3 business days, an escalation is triggered.\n\nApprovers can also refer a request back for additional information. This resets the request to the validation stage with a note explaining what is needed.',
      },
      {
        id: 'ra-3',
        title: 'Delegating approvals when on leave',
        content:
          'If you will be out of office, you should set up approval delegation to ensure requests are not blocked during your absence.\n\nTo set up delegation: Go to Approvals > Delegation in the sidebar. Select your delegate from the list of eligible users (must have the same or higher authority level). Set the start and end dates for the delegation period. Optionally, limit delegation to specific categories or value ranges.\n\nDelegated approvals are clearly marked in the audit trail with both the original approver and the delegate recorded. The delegate receives all approval notifications during the delegation period.\n\nImportant: Delegation does not transfer permanently. When the delegation period ends, approvals automatically route back to the original approver. You can end a delegation early from the same settings page.',
      },
    ],
  },
  {
    name: 'Suppliers',
    articles: [
      {
        id: 'sup-1',
        title: 'Finding and onboarding suppliers',
        content:
          'The Supplier Directory contains all registered suppliers with their profile information, risk ratings, certifications, and performance scores. Use the search and filter options to find suppliers by category, country, or risk level.\n\nTo onboard a new supplier, submit a supplier onboarding request. The onboarding process includes: company registration and documentation, sanctions and compliance screening, financial stability assessment, Supplier Risk Assessment (SRA), and contract setup.\n\nAverage onboarding time is 3-4 weeks. The supplier receives portal access during onboarding to upload documents and complete their profile. You can track onboarding progress from the Onboarding Pipeline page.\n\nTip: Before requesting a new supplier, check if an existing approved supplier can meet your needs. Using approved suppliers with existing agreements is faster and often provides better pricing.',
      },
      {
        id: 'sup-2',
        title: 'Supplier risk assessments (SRA)',
        content:
          'Supplier Risk Assessments (SRA) are mandatory for all active suppliers. The assessment covers financial health, regulatory compliance, data protection, ESG performance, and business continuity capabilities.\n\nSRA validity: Assessments are valid for 24 months. The system automatically flags suppliers with assessments expiring within 90 days. No new purchase orders can be issued against suppliers with expired SRAs.\n\nRisk ratings: Low (green) indicates minimal risk. Medium (amber) requires monitoring and periodic review. High (red) requires enhanced due diligence and senior management approval. Critical (dark red) may require immediate action or relationship termination.\n\nYou can view SRA status for any supplier on their profile page under the Risk & Compliance tab. The Supplier Risk Dashboard provides an overview of all suppliers by risk rating.',
      },
    ],
  },
  {
    name: 'Contracts & Purchasing',
    articles: [
      {
        id: 'cp-1',
        title: 'Contract types and templates',
        content:
          'The platform supports several contract types, each with its own template:\n\nMaster Service Agreement (MSA): For ongoing service relationships. Includes general terms, SLAs, and pricing schedules. Individual work orders are raised against the MSA.\n\nFramework Agreement: Pre-negotiated terms with one or more suppliers for a category. Call-offs are made as needed without renegotiation.\n\nPurchase Agreement: For one-time goods purchases above EUR 25,000. Includes delivery terms, warranty, and acceptance criteria.\n\nStatement of Work (SOW): Defines specific deliverables, timelines, and acceptance criteria for project-based work under an existing MSA.\n\nNon-Disclosure Agreement (NDA): Required before sharing confidential information with potential suppliers during sourcing.\n\nAll templates are available from the Contracts > Templates page. Legal review is required for any modifications to standard templates.',
      },
      {
        id: 'cp-2',
        title: 'Purchase orders and invoice matching',
        content:
          'Purchase orders (POs) are created after contract execution or for direct purchases from approved suppliers. Each PO includes line items with quantities, unit prices, and delivery dates.\n\nThree-way matching: The system performs automated matching between the PO, goods receipt, and supplier invoice. Matches within a 5% tolerance are auto-approved. Variances above 5% are flagged for manual review.\n\nMatch statuses: Matched (all three documents agree), Partial Match (some line items match), Unmatched (no matching PO or receipt found), Variance (amounts differ beyond tolerance).\n\nTo resolve a match variance: Review the PO, receipt, and invoice side by side on the Three-Way Match page. You can approve the variance with justification, create a credit note request, or dispute the invoice back to the supplier.\n\nPayment terms are typically 30 days from invoice date. Early payment discounts are tracked and reported in the analytics dashboard.',
      },
    ],
  },
  {
    name: 'Admin & Configuration',
    articles: [
      {
        id: 'ac-1',
        title: 'Setting up routing rules',
        content:
          'Routing rules determine how procurement requests are classified and routed to the appropriate buying channel and approval chain. Each rule consists of conditions and actions.\n\nConditions: Define when the rule applies based on request properties such as category, value range, department, commodity code, or priority. Multiple conditions can be combined with AND/OR logic.\n\nActions: Specify the buying channel assignment and approval chain. For example, a rule might route all IT consulting requests above EUR 100,000 to the Procurement-led channel with VP-level approval.\n\nRules are evaluated in priority order. The first matching rule is applied. If no rule matches, the request uses the default routing (Procurement-led with standard approval).\n\nTo create or modify rules, go to Admin > Routing Rules. Test your rules using the simulation feature before activating them.',
      },
      {
        id: 'ac-2',
        title: 'Configuring workflow automations',
        content:
          'Workflow automations allow you to set up automatic actions triggered by events in the procurement process. Common automations include:\n\nSLA Monitoring: Automatically escalate requests that exceed stage time limits. Configure warning thresholds and escalation recipients per stage.\n\nNotifications: Send email and in-app notifications for status changes, approaching deadlines, and required actions. Customise notification templates and recipient lists.\n\nAuto-Assignment: Automatically assign requests to procurement leads based on category, value, or workload balancing. Supports round-robin and expertise-based assignment.\n\nApproval Reminders: Send reminder notifications to approvers after configurable intervals. Escalate to the next level after a set number of reminders.\n\nTo configure automations, go to Admin > Workflow Designer. The visual designer allows you to create workflow chains by connecting trigger events to actions using a drag-and-drop interface.',
      },
    ],
  },
];

export function KnowledgeBasePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);

  const filteredCategories = categories
    .map((cat) => ({
      ...cat,
      articles: cat.articles.filter(
        (a) =>
          !searchQuery ||
          a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.content.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((cat) => cat.articles.length > 0);

  function toggleArticle(id: string) {
    setExpandedArticle((prev) => (prev === id ? null : id));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge Base"
        subtitle="Find answers to common procurement questions"
      />

      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search articles..."
          className="pl-10"
        />
      </div>

      <div className="space-y-6">
        {filteredCategories.map((cat) => (
          <div key={cat.name}>
            <h2 className="mb-3 text-sm font-semibold text-gray-900 uppercase tracking-wide">
              {cat.name}
            </h2>
            <div className="space-y-2">
              {cat.articles.map((article) => {
                const isExpanded = expandedArticle === article.id;
                return (
                  <Card key={article.id} className="overflow-hidden">
                    <button
                      className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50"
                      onClick={() => toggleArticle(article.id)}
                    >
                      <span className="text-sm font-medium">
                        {article.title}
                      </span>
                      <ChevronDown
                        className={`size-4 text-muted-foreground transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isExpanded && (
                      <div className="border-t px-5 py-4 space-y-4">
                        {article.content
                          .split('\n\n')
                          .map((paragraph, idx) => (
                            <p
                              key={idx}
                              className="text-sm text-gray-700 leading-relaxed"
                            >
                              {paragraph}
                            </p>
                          ))}
                        <div className="flex items-center gap-3 border-t pt-3">
                          <span className="text-xs text-muted-foreground">
                            Was this helpful?
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7"
                            onClick={() =>
                              toast.success('Thanks for your feedback!')
                            }
                          >
                            <ThumbsUp className="mr-1 size-3" />
                            Yes
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7"
                            onClick={() =>
                              toast.info(
                                'Thanks. We will improve this article.'
                              )
                            }
                          >
                            <ThumbsDown className="mr-1 size-3" />
                            No
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
        {filteredCategories.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No articles found matching your search.
          </div>
        )}
      </div>
    </div>
  );
}
