// Payment tracker: matched → approved → scheduled → paid stepper for an
// invoice. Stage state is inferred purely from which dates are present, so
// the caller only supplies the milestones it knows about.
import { ProcessStepper, type Step } from '@/components/shared/process-stepper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PaymentTrackerProps {
  matchDate?: string;
  approvedDate?: string;
  scheduledDate?: string;
  paidDate?: string;
}

export function PaymentTracker({ matchDate, approvedDate, scheduledDate, paidDate }: PaymentTrackerProps) {
  const steps: Step[] = [
    {
      id: 'matched',
      label: 'Matched',
      // Any later milestone implies matching already happened, even when the
      // match date itself was never recorded.
      status: matchDate ? 'completed' : paidDate || scheduledDate || approvedDate ? 'completed' : 'current',
      date: matchDate,
    },
    {
      id: 'approved',
      label: 'Approved',
      status: approvedDate ? 'completed' : matchDate ? 'current' : 'future',
      date: approvedDate,
    },
    {
      id: 'scheduled',
      label: 'Scheduled',
      status: scheduledDate ? 'completed' : approvedDate ? 'current' : 'future',
      date: scheduledDate,
    },
    {
      id: 'paid',
      label: 'Paid',
      status: paidDate ? 'completed' : scheduledDate ? 'current' : 'future',
      date: paidDate,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Payment Status</CardTitle>
      </CardHeader>
      <CardContent>
        <ProcessStepper steps={steps} />
      </CardContent>
    </Card>
  );
}
