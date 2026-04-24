import { useState } from 'react';
import type { ApprovalEntry, ProcurementRequest } from '@/data/types';
import { useApprovalLookup, useApprovals, useUpdateApproval } from '@/lib/db/hooks/use-approvals';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Bell, ArrowRight, Check, X, MessageSquare } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';

interface TabApprovalsProps {
  request: ProcurementRequest;
}

export function TabApprovals({ request }: TabApprovalsProps) {
  useApprovals();
  const { byRequest } = useApprovalLookup();
  const approvals = byRequest(request.id);
  const currentUser = useAuthStore((s) => s.currentUser);

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
              <ApprovalRow
                key={approval.id}
                approval={approval}
                requestTitle={request.title}
                isCurrentUserApprover={approval.approverId === currentUser.id}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface ApprovalRowProps {
  approval: ApprovalEntry;
  requestTitle: string;
  isCurrentUserApprover: boolean;
}

function ApprovalRow({ approval, requestTitle, isCurrentUserApprover }: ApprovalRowProps) {
  const updateApproval = useUpdateApproval();
  const [expanded, setExpanded] = useState<'reject' | 'request-info' | null>(null);
  const [comment, setComment] = useState('');

  const canAct = isCurrentUserApprover && approval.status === 'pending';

  async function handleApprove() {
    try {
      await updateApproval.mutateAsync({
        id: approval.id,
        patch: { status: 'approved', respondedAt: new Date().toISOString() },
      });
      toast.success(`Approved — ${requestTitle}`);
    } catch (err) {
      toast.error(`Approve failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  async function handleReject() {
    if (!comment.trim()) return;
    try {
      await updateApproval.mutateAsync({
        id: approval.id,
        patch: { status: 'rejected', respondedAt: new Date().toISOString(), comments: comment },
      });
      toast.error(`Rejected — ${requestTitle}`);
      setExpanded(null);
      setComment('');
    } catch (err) {
      toast.error(`Reject failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  async function handleRequestInfo() {
    if (!comment.trim()) return;
    try {
      await updateApproval.mutateAsync({
        id: approval.id,
        patch: { status: 'info-requested', comments: comment },
      });
      toast.info(`Information requested — ${requestTitle}`);
      setExpanded(null);
      setComment('');
    } catch (err) {
      toast.error(`Request info failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  function handleRemind() {
    toast.success(`Reminder sent to ${approval.approverName}`);
  }

  return (
    <div className="border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900">{approval.approverName}</span>
            <span className="text-xs text-muted-foreground">{approval.approverRole}</span>
            <StatusBadge status={approval.status} size="sm" />
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>Requested: {formatDate(approval.requestedAt)}</span>
            {approval.respondedAt && <span>Responded: {formatDate(approval.respondedAt)}</span>}
          </div>
          {approval.comments && <p className="text-sm text-gray-700 mt-1">{approval.comments}</p>}
          {approval.delegatedTo && (
            <p className="text-xs text-blue-600 mt-1">Delegated to another approver</p>
          )}
        </div>

        <div className="shrink-0 flex items-center gap-2 flex-wrap justify-end">
          {canAct ? (
            <>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={handleApprove}
                disabled={updateApproval.isPending}
              >
                <Check className="size-3.5" />
                Approve
              </Button>
              <Button
                size="sm"
                variant={expanded === 'reject' ? 'destructive' : 'outline'}
                onClick={() => setExpanded(expanded === 'reject' ? null : 'reject')}
              >
                <X className="size-3.5" />
                Reject
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={expanded === 'request-info' ? 'bg-amber-50' : ''}
                onClick={() => setExpanded(expanded === 'request-info' ? null : 'request-info')}
              >
                <MessageSquare className="size-3.5" />
                Request Info
              </Button>
            </>
          ) : approval.status === 'pending' ? (
            <Button size="sm" variant="outline" onClick={handleRemind}>
              <Bell className="size-3.5" />
              Remind
            </Button>
          ) : null}
        </div>
      </div>

      {canAct && expanded === 'reject' && (
        <div className="mt-3 space-y-2 rounded-md border border-red-200 bg-red-50 p-3">
          <Textarea
            placeholder="Reason for rejection (required)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={handleReject}
              disabled={!comment.trim() || updateApproval.isPending}
            >
              Confirm Rejection
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setExpanded(null);
                setComment('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {canAct && expanded === 'request-info' && (
        <div className="mt-3 space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
          <Textarea
            placeholder="What information do you need?"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleRequestInfo}
              disabled={!comment.trim() || updateApproval.isPending}
            >
              Send Request
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setExpanded(null);
                setComment('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
