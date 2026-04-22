import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ProcurementRequest, RequestStatus } from '@/data/types';
import { toast } from 'sonner';
import { apiWorkflowAction } from '@/lib/api';
import { queryClient } from '@/lib/query-client';

const PREVIOUS_STEPS = [
  { value: 'intake', label: 'Intake' },
  { value: 'validation', label: 'Validation' },
  { value: 'approval', label: 'Approval' },
  { value: 'sourcing', label: 'Sourcing' },
  { value: 'contracting', label: 'Contracting' },
];

const REASONS = [
  { value: 'incomplete', label: 'Incomplete information' },
  { value: 'incorrect-category', label: 'Incorrect category' },
  { value: 'classification-mismatch', label: 'Classification mismatch' },
  { value: 'sra-required', label: 'Risk assessment required' },
  { value: 'other', label: 'Other' },
];

interface ReferBackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: ProcurementRequest;
}

export function ReferBackDialog({ open, onOpenChange, request }: ReferBackDialogProps) {
  const [step, setStep] = useState('');
  const [reason, setReason] = useState('');
  const [explanation, setExplanation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!step || !reason) return;
    setSubmitting(true);
    const notes = explanation ? `${reason}: ${explanation}` : reason;
    try {
      await apiWorkflowAction({
        requestId: request.id,
        action: 'referred-back',
        newStatus: step as RequestStatus,
        notes,
      });
      await queryClient.invalidateQueries({ queryKey: ['requests'] });
      await queryClient.invalidateQueries({ queryKey: ['stage-history'] });
      toast.success(`Request ${request.id} referred back to ${step}`);
      setStep('');
      setReason('');
      setExplanation('');
      onOpenChange(false);
    } catch (err) {
      toast.error(`Refer back failed: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refer Back</DialogTitle>
          <DialogDescription>
            Return this request to a previous stage for additional information or corrections.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Return to stage</Label>
            <Select value={step} onValueChange={setStep}>
              <SelectTrigger>
                <SelectValue placeholder="Select stage..." />
              </SelectTrigger>
              <SelectContent>
                {PREVIOUS_STEPS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Additional explanation (optional)</Label>
            <Textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Provide additional context..."
              className="min-h-[80px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!step || !reason || submitting} className="bg-amber-600 hover:bg-amber-700 text-white">
            {submitting ? 'Referring back...' : 'Refer Back'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
