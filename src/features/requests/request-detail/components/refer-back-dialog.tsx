// Dialog for sending a request back to an earlier lifecycle stage (e.g. more
// information needed). Requires a coded reason so referrals are reportable,
// with optional free text for context. It offers only the rework stages the
// request's own channel runs before where it is (`referBackTargets`), the rule
// api/workflow-action.ts enforces — a fixed list used to offer later stages
// and ones the channel skips.
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
import { invalidateRequestViews, queryClient } from '@/lib/query-client';
import { useChannelStageMap } from '@/lib/db/hooks/use-channel-stage-map';
import { referBackTargets } from '@/lib/workflow/channel-stages';
import { stageLabelShort } from '@/lib/workflow/stage-labels';

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
  const { data: stageMap } = useChannelStageMap();
  const targets = referBackTargets(stageMap, request.buyingChannel, request.status);

  async function handleSubmit() {
    if (!step || !reason) return;
    setSubmitting(true);
    // Keep the coded reason as the notes prefix so the audit trail stays
    // machine-filterable even when free text is added.
    const notes = explanation ? `${reason}: ${explanation}` : reason;
    try {
      await apiWorkflowAction({
        requestId: request.id,
        action: 'referred-back',
        newStatus: step as RequestStatus,
        notes,
      });
      invalidateRequestViews(queryClient);
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
            {targets.length === 0 && (
              <p className="text-caption text-ink-3">There is no earlier stage to refer this request back to.</p>
            )}
            <Select value={step} onValueChange={setStep} disabled={targets.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder="Select stage..." />
              </SelectTrigger>
              <SelectContent>
                {targets.map((target) => (
                  <SelectItem key={target} value={target}>
                    {stageLabelShort(target)}
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
          <Button onClick={handleSubmit} disabled={!step || !reason || submitting} className="bg-warn hover:bg-warn text-paper">
            {submitting ? 'Referring back...' : 'Refer Back'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
