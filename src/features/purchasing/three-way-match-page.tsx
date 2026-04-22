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

interface MatchScenario {
  invoiceId: string;
  poId: string;
  fields: MatchField[];
  withinTolerance: boolean;
  paymentDates: {
    matchDate?: string;
    approvedDate?: string;
    scheduledDate?: string;
    paidDate?: string;
  };
}

const matchScenarios: MatchScenario[] = [
  {
    invoiceId: 'INV-001',
    poId: 'PO-001',
    fields: [
      { label: 'Supplier', poValue: 'Amazon Web Services (AWS)', grValue: 'Amazon Web Services (AWS)', invoiceValue: 'Amazon Web Services (AWS)', status: 'match' },
      { label: 'Total Amount', poValue: formatCurrency(480000), grValue: formatCurrency(480000), invoiceValue: formatCurrency(120000), status: 'match' },
      { label: 'Line Items', poValue: '4 items', grValue: '4 items received', invoiceValue: 'Q3 partial (4 items)', status: 'match' },
      { label: 'Invoice Date', poValue: '15 Jun 2024', grValue: '30 Sep 2024', invoiceValue: '01 Oct 2024', status: 'match' },
    ],
    withinTolerance: true,
    paymentDates: { matchDate: '2024-10-05', approvedDate: '2024-10-10', scheduledDate: '2024-10-25', paidDate: '2024-10-28' },
  },
  {
    invoiceId: 'INV-002',
    poId: 'PO-001',
    fields: [
      { label: 'Supplier', poValue: 'Amazon Web Services (AWS)', grValue: 'Amazon Web Services (AWS)', invoiceValue: 'Amazon Web Services (AWS)', status: 'match' },
      { label: 'Total Amount', poValue: formatCurrency(120000), grValue: formatCurrency(120000), invoiceValue: formatCurrency(122400), status: 'minor-variance', variance: '+2,400' },
      { label: 'Line Items', poValue: '4 items', grValue: '4 items received', invoiceValue: '4 items', status: 'match' },
      { label: 'Invoice Date', poValue: '15 Jun 2024', grValue: '31 Oct 2024', invoiceValue: '01 Nov 2024', status: 'match' },
    ],
    withinTolerance: true,
    paymentDates: { matchDate: '2024-11-05', approvedDate: '2024-11-10', scheduledDate: '2024-11-20', paidDate: '2024-11-25' },
  },
  {
    invoiceId: 'INV-009',
    poId: 'PO-008',
    fields: [
      { label: 'Supplier', poValue: 'Iron Mountain', grValue: 'Iron Mountain', invoiceValue: 'Iron Mountain', status: 'match' },
      { label: 'Total Amount', poValue: formatCurrency(35000), grValue: formatCurrency(28700), invoiceValue: formatCurrency(28700), status: 'minor-variance', variance: 'Partial delivery' },
      { label: 'Line Items', poValue: '2 items', grValue: '1 full + 1 partial (320/500)', invoiceValue: '2 items', status: 'minor-variance', variance: 'Qty mismatch' },
      { label: 'Invoice Date', poValue: '15 Nov 2024', grValue: '10 Jan 2025', invoiceValue: '05 Jan 2025', status: 'match' },
    ],
    withinTolerance: false,
    paymentDates: {},
  },
  {
    invoiceId: 'INV-014',
    poId: 'PO-013',
    fields: [
      { label: 'Supplier', poValue: 'McKinsey & Company', grValue: 'McKinsey & Company', invoiceValue: 'McKinsey & Company', status: 'match' },
      { label: 'Total Amount', poValue: formatCurrency(1850000), grValue: 'Not received', invoiceValue: formatCurrency(450000), status: 'mismatch', variance: 'No GR' },
      { label: 'Line Items', poValue: '4 phases', grValue: 'N/A', invoiceValue: 'Phase 1 only', status: 'mismatch', variance: 'GR missing' },
      { label: 'Invoice Date', poValue: '07 Jan 2025', grValue: '-', invoiceValue: '06 Jan 2025', status: 'minor-variance', variance: 'Pre-delivery' },
    ],
    withinTolerance: false,
    paymentDates: {},
  },
];

export function ThreeWayMatchPage() {
  const { data: allInvoices = [] } = useInvoices();
  const [selectedInvoice, setSelectedInvoice] = useState<string>(matchScenarios[0].invoiceId);

  const scenario = matchScenarios.find((s) => s.invoiceId === selectedInvoice);

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
                {matchScenarios.map((s) => {
                  const inv = allInvoices.find((i) => i.id === s.invoiceId);
                  return (
                    <SelectItem key={s.invoiceId} value={s.invoiceId}>
                      {s.invoiceId} - {inv?.supplierName} ({formatCurrency(inv?.amount ?? 0)})
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
            fields={scenario.fields}
            poId={scenario.poId}
            invoiceId={scenario.invoiceId}
          />

          <div className="flex gap-3">
            {scenario.withinTolerance ? (
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
