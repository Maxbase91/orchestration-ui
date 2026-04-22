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
import { toast } from 'sonner';
import type { ProcurementRequest } from '@/data/types';
import { createNotification } from '@/lib/db/notifications';
import { useUpdateRequest } from '@/lib/db/hooks/use-requests';
import { queryClient } from '@/lib/query-client';

const ESCALATION_LEVELS = [
  { value: 'team-lead', label: 'Team Lead' },
  { value: 'department-head', label: 'Department Head' },
  { value: 'vp', label: 'VP' },
];

const URGENCY_LEVELS = [
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

interface EscalateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: ProcurementRequest;
}

export function EscalateDialog({ open, onOpenChange, request }: EscalateDialogProps) {
  const [level, setLevel] = useState('');
  const [urgency, setUrgency] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const updateRequest = useUpdateRequest();

  async function handleSubmit() {
    if (!level || !reason.trim()) return;
    const levelLabel = ESCALATION_LEVELS.find((l) => l.value === level)?.label ?? level;
    setSubmitting(true);
    try {
      await createNotification({
        id: `NOT-ESC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'escalation',
        title: `${request.id} escalated to ${levelLabel}`,
        description: `${urgency ? `[${urgency.toUpperCase()}] ` : ''}${reason}`,
        timestamp: new Date().toISOString(),
        isRead: false,
        relatedId: request.id,
        actionUrl: `/requests/${request.id}`,
      });
      if (urgency === 'critical' && request.priority !== 'urgent') {
        await updateRequest.mutateAsync({ id: request.id, patch: { priority: 'urgent', isUrgent: true } });
      }
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      await queryClient.invalidateQueries({ queryKey: ['requests'] });
      toast.success(`Request escalated to ${levelLabel}`);
      setLevel('');
      setUrgency('');
      setReason('');
      onOpenChange(false);
    } catch (err) {
      toast.error(`Escalate failed: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Escalate Request</DialogTitle>
          <DialogDescription>
            Escalate this request to a higher authority for expedited resolution.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Escalation level</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger>
                <SelectValue placeholder="Select level..." />
              </SelectTrigger>
              <SelectContent>
                {ESCALATION_LEVELS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Urgency</Label>
            <Select value={urgency} onValueChange={setUrgency}>
              <SelectTrigger>
                <SelectValue placeholder="Select urgency..." />
              </SelectTrigger>
              <SelectContent>
                {URGENCY_LEVELS.map((u) => (
                  <SelectItem key={u.value} value={u.value}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reason for escalation</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why does this need escalation?"
              className="min-h-[80px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!level || !reason.trim() || submitting}>
            {submitting ? 'Escalating...' : 'Escalate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
