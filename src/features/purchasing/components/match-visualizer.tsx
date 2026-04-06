import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MatchField {
  label: string;
  poValue: string;
  grValue: string;
  invoiceValue: string;
  status: 'match' | 'minor-variance' | 'mismatch';
  variance?: string;
}

interface MatchVisualizerProps {
  fields: MatchField[];
  poId: string;
  invoiceId: string;
}

const statusStyles = {
  match: 'bg-green-50 border-green-200',
  'minor-variance': 'bg-amber-50 border-amber-200',
  mismatch: 'bg-red-50 border-red-200',
};

const statusLabels = {
  match: 'Matched',
  'minor-variance': 'Minor Variance',
  mismatch: 'Mismatch',
};

const statusLabelColors = {
  match: 'text-green-700',
  'minor-variance': 'text-amber-700',
  mismatch: 'text-red-700',
};

export function MatchVisualizer({ fields, poId, invoiceId }: MatchVisualizerProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Three-Way Match: {invoiceId} vs {poId}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-0 text-sm">
          <div className="border-b p-2 font-medium text-muted-foreground">Field</div>
          <div className="border-b p-2 font-medium text-center text-muted-foreground">Purchase Order</div>
          <div className="border-b p-2 font-medium text-center text-muted-foreground">Goods Receipt</div>
          <div className="border-b p-2 font-medium text-center text-muted-foreground">Invoice</div>

          {fields.map((field) => (
            <div key={field.label} className={cn('contents')}>
              <div className={cn('border-b p-2 font-medium flex items-center gap-2', statusStyles[field.status])}>
                {field.label}
                <span className={cn('text-xs', statusLabelColors[field.status])}>
                  {statusLabels[field.status]}
                  {field.variance && ` (${field.variance})`}
                </span>
              </div>
              <div className={cn('border-b p-2 text-center', statusStyles[field.status])}>
                {field.poValue}
              </div>
              <div className={cn('border-b p-2 text-center', statusStyles[field.status])}>
                {field.grValue}
              </div>
              <div className={cn('border-b p-2 text-center', statusStyles[field.status])}>
                {field.invoiceValue}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export type { MatchField };
