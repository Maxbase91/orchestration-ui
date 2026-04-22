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
import { useUsers } from '@/lib/db/hooks/use-users';
import { toast } from 'sonner';
import type { ProcurementRequest } from '@/data/types';
import { apiWorkflowAction } from '@/lib/api';
import { queryClient } from '@/lib/query-client';

interface ReassignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: ProcurementRequest;
}

export function ReassignDialog({ open, onOpenChange, request }: ReassignDialogProps) {
  const { data: users = [] } = useUsers();
  const [userId, setUserId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!userId || !reason.trim()) return;
    const user = users.find((u) => u.id === userId);
    setSubmitting(true);
    try {
      await apiWorkflowAction({
        requestId: request.id,
        action: 'reassigned',
        newStatus: request.status,
        ownerId: userId,
        notes: reason,
      });
      await queryClient.invalidateQueries({ queryKey: ['requests'] });
      toast.success(`Request reassigned to ${user?.name ?? 'user'}`);
      setUserId('');
      setReason('');
      onOpenChange(false);
    } catch (err) {
      toast.error(`Reassign failed: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reassign Request</DialogTitle>
          <DialogDescription>
            Transfer ownership of this request to another team member.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>New owner</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select user..." />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} - {u.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reason for reassignment</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this being reassigned?"
              className="min-h-[80px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!userId || !reason.trim() || submitting}>
            {submitting ? 'Reassigning...' : 'Reassign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
