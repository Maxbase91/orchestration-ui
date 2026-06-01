import { useState } from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { MatchVisualizer, type MatchField } from './components/match-visualizer';
import { PaymentTracker } from './components/payment-tracker';
import { useInvoices } from '@/lib/db/hooks/use-invoices';
import { formatCurrency } from '@/lib/format';

// Variance tolerance: differences within this fraction are "minor-variance".
// Differences beyond it are "mismatch".
const MINOR_VARIANCE_THRESHOLD = 0.02; // 2 %

function computeAmountStatus(
  po: number,
  gr: number | null,
  invoice: number,
): { status: MatchField['status']; variance?: string } {
  if (gr === null) {
    return { status: 'mismatch', variance: 'No GR' };
  }
  const ref = po;
  if (ref === 0) return { status: 'match' };
  const diff = Math.abs(invoice - ref);
  const ratio = diff / ref;
  if (ratio === 0) return { status: 'match' };
  const sign = invoice > ref ? '+' : '-';
  const varianceStr = `${sign}${formatCurrency(diff)}`;
  if (ratio < MINOR_VARIANCE_THRESHOLD) return { status: 'minor-variance', variance: varianceStr };
  return { status: 'mismatch', variance: varianceStr };
}

interface RawScenario {
  invoiceId: string;
  poId: string;
  supplier: string;
  poAmount: number;
  grAmount: number | null;
  invoiceAmount: number;
  poItems: string;
  grItems: string | null;
  invoiceItems: string;
  poDate: string;
  grDate: string | null;
  invoiceDate: string;
  paymentDates: {
    matchDate?: string;
    approvedDate?: string;
    scheduledDate?: string;
    paidDate?: string;
  };
}

function buildFields(s: RawScenario): MatchField[] {
  const amountResult = computeAmountStatus(s.poAmount, s.grAmount, s.invoiceAmount);

  const grAmountDisplay = s.grAmount !== null ? formatCurrency(s.grAmount) : 'Not received';
  const grItemsDisplay = s.grItems ?? 'N/A';
  const grDateDisplay = s.grDate ?? '-';

  const itemStatus: MatchField['status'] =
    s.grItems === null ? 'mismatch' : s.poItems === s.grItems && s.grItems === s.invoiceItems ? 'match' : 'minor-variance';

  const dateStatus: MatchField['status'] =
    s.grDate === null ? 'minor-variance' : 'match';

  return [
    {
      label: 'Supplier',
      poValue: s.supplier,
      grValue: s.supplier,
      invoiceValue: s.supplier,
      status: 'match',
    },
    {
      label: 'Total Amount',
      poValue: formatCurrency(s.poAmount),
      grValue: grAmountDisplay,
      invoiceValue: formatCurrency(s.invoiceAmount),
      ...amountResult,
    },
    {
      label: 'Line Items',
      poValue: s.poItems,
      grValue: grItemsDisplay,
      invoiceValue: s.invoiceItems,
      status: itemStatus,
      ...(s.grItems !== null && s.poItems !== s.grItems ? { variance: 'Qty mismatch' } : {}),
    },
    {
      label: 'Invoice Date',
      poValue: s.poDate,
      grValue: grDateDisplay,
      invoiceValue: s.invoiceDate,
      status: dateStatus,
      ...(s.grDate === null ? { variance: 'Pre-delivery' } : {}),
    },
  ];
}

const rawScenarios: RawScenario[] = [
  {
    invoiceId: 'INV-001',
    poId: 'PO-001',
    supplier: 'Amazon Web Services (AWS)',
    poAmount: 480000,
    grAmount: 480000,
    invoiceAmount: 120000,
    poItems: '4 items',
    grItems: '4 items received',
    invoiceItems: 'Q3 partial (4 items)',
    poDate: '15 Jun 2024',
    grDate: '30 Sep 2024',
    invoiceDate: '01 Oct 2024',
    paymentDates: { matchDate: '2024-10-05', approvedDate: '2024-10-10', scheduledDate: '2024-10-25', paidDate: '2024-10-28' },
  },
  {
    invoiceId: 'INV-002',
    poId: 'PO-001',
    supplier: 'Amazon Web Services (AWS)',
    poAmount: 120000,
    grAmount: 120000,
    invoiceAmount: 122400,
    poItems: '4 items',
    grItems: '4 items received',
    invoiceItems: '4 items',
    poDate: '15 Jun 2024',
    grDate: '31 Oct 2024',
    invoiceDate: '01 Nov 2024',
    paymentDates: { matchDate: '2024-11-05', approvedDate: '2024-11-10', scheduledDate: '2024-11-20', paidDate: '2024-11-25' },
  },
  {
    invoiceId: 'INV-009',
    poId: 'PO-008',
    supplier: 'Iron Mountain',
    poAmount: 35000,
    grAmount: 28700,
    invoiceAmount: 28700,
    poItems: '2 items',
    grItems: '1 full + 1 partial (320/500)',
    invoiceItems: '2 items',
    poDate: '15 Nov 2024',
    grDate: '10 Jan 2025',
    invoiceDate: '05 Jan 2025',
    paymentDates: {},
  },
  {
    invoiceId: 'INV-014',
    poId: 'PO-013',
    supplier: 'McKinsey & Company',
    poAmount: 1850000,
    grAmount: null,
    invoiceAmount: 450000,
    poItems: '4 phases',
    grItems: null,
    invoiceItems: 'Phase 1 only',
    poDate: '07 Jan 2025',
    grDate: null,
    invoiceDate: '06 Jan 2025',
    paymentDates: {},
  },
];

export function ThreeWayMatchPage() {
  const { data: allInvoices = [] } = useInvoices();
  const [selectedInvoice, setSelectedInvoice] = useState<string>(rawScenarios[0].invoiceId);

  const scenario = rawScenarios.find((s) => s.invoiceId === selectedInvoice);
  const fields = scenario ? buildFields(scenario) : [];
  const withinTolerance =
    scenario !== undefined &&
    fields.every((f) => f.status === 'match') &&
    scenario.grAmount !== null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Three-Way Match"
        subtitle="Compare PO, Goods Receipt, and Invoice"
      />

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Select Invoice:</span>
            <Select value={selectedInvoice} onValueChange={setSelectedInvoice}>
              <SelectTrigger className="w-[300px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rawScenarios.map((s) => {
                  const inv = allInvoices.find((i) => i.id === s.invoiceId);
                  return (
                    <SelectItem key={s.invoiceId} value={s.invoiceId}>
                      {s.invoiceId} - {inv?.supplierName ?? s.supplier} ({formatCurrency(inv?.amount ?? s.invoiceAmount)})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {scenario && (
        <>
          <MatchVisualizer
            fields={fields}
            poId={scenario.poId}
            invoiceId={scenario.invoiceId}
          />

          <div className="flex gap-3">
            {withinTolerance ? (
              <Button>
                <CheckCircle className="size-3.5" />
                Auto-Approve
              </Button>
            ) : (
              <Button variant="destructive">
                <AlertTriangle className="size-3.5" />
                Raise Exception
              </Button>
            )}
            <Button variant="outline">
              Request Clarification
            </Button>
          </div>

          <PaymentTracker
            matchDate={scenario.paymentDates.matchDate}
            approvedDate={scenario.paymentDates.approvedDate}
            scheduledDate={scenario.paymentDates.scheduledDate}
            paidDate={scenario.paymentDates.paidDate}
          />
        </>
      )}
    </div>
  );
}
