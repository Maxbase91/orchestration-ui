// Confirmation dialog for bulk approval from the approvals queue. Lists every
// selected request and the combined value so the approver sees the aggregate
// exposure before committing in one click.
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import type { ProcurementRequest } from '@/data/types';

interface BulkApproveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requests: ProcurementRequest[];
  onConfirm: () => void;
}

export function BulkApproveDialog({
  open,
  onOpenChange,
  requests,
  onConfirm,
}: BulkApproveDialogProps) {
  const totalValue = requests.reduce((sum, r) => sum + r.value, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve {requests.length} requests</DialogTitle>
          <DialogDescription>
            You are about to approve the following requests with a combined value of{' '}
            <span className="font-semibold text-ink">{formatCurrency(totalValue)}</span>.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 max-h-60 overflow-y-auto">
          {requests.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-body"
            >
              <div>
                <span className="font-medium text-ink">{r.title}</span>
                <span className="ml-2 text-ink-3">{r.id}</span>
              </div>
              <span className="shrink-0 text-ink-2">{formatCurrency(r.value)}</span>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-ok text-paper hover:brightness-110"
            onClick={onConfirm}
          >
            Approve All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
