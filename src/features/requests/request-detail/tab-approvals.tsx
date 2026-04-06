import type { ProcurementRequest } from '@/data/types';
import { getApprovalsByRequestId } from '@/data/approval-entries';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, ArrowRight } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { toast } from 'sonner';

interface TabApprovalsProps {
  request: ProcurementRequest;
}

export function TabApprovals({ request }: TabApprovalsProps) {
  const approvals = getApprovalsByRequestId(request.id);

  function handleRemind(approverName: string) {
    toast.success(`Reminder sent to ${approverName}`);
  }

  if (approvals.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">No approval entries for this request.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Approval Chain Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Approval Chain</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap">
            {approvals.map((approval, index) => (
              <div key={approval.id} className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                  <StatusBadge status={approval.status} size="sm" />
                  <div>
                    <p className="text-sm font-medium">{approval.approverName}</p>
                    <p className="text-xs text-muted-foreground">{approval.approverRole}</p>
                  </div>
                </div>
                {index < approvals.length - 1 && (
                  <ArrowRight className="size-4 text-muted-foreground shrink-0" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Approval Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {approvals.map((approval) => (
              <div key={approval.id} className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">
                      {approval.approverName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {approval.approverRole}
                    </span>
                    <StatusBadge status={approval.status} size="sm" />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Requested: {formatDate(approval.requestedAt)}</span>
                    {approval.respondedAt && (
                      <span>Responded: {formatDate(approval.respondedAt)}</span>
                    )}
                  </div>
                  {approval.comments && (
                    <p className="text-sm text-gray-700 mt-1">{approval.comments}</p>
                  )}
                  {approval.delegatedTo && (
                    <p className="text-xs text-blue-600 mt-1">
                      Delegated to another approver
                    </p>
                  )}
                </div>
                {approval.status === 'pending' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRemind(approval.approverName)}
                  >
                    <Bell className="size-3.5" />
                    Remind
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
