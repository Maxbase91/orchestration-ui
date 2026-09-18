import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  X,
  MessageSquare,
  UserPlus,
  Clock,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/status-badge';
import { SLACountdown } from '@/components/shared/sla-countdown';
import { OOOWarning } from './ooo-warning';
import { formatCurrency } from '@/lib/format';
import { getStatusLabel } from '@/lib/status';
import { useUserLookup, useUsers } from '@/lib/db/hooks/use-users';
import { useUpdateApproval } from '@/lib/db/hooks/use-approvals';
import { useAuthStore } from '@/stores/auth-store';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateRequestViews } from '@/lib/query-client';
import { canActOnApproval } from '@/lib/procurement/approval-derivation';
import { recordApprovalDecision } from '@/lib/workflow/approval-decision';
import type { ProcurementRequest, ApprovalEntry } from '@/data/types';

interface ApprovalCardProps {
  request: ProcurementRequest;
  approval: ApprovalEntry;
  selected: boolean;
  onSelectChange: (checked: boolean) => void;
  onActionComplete: (action: string) => void;
}

const categoryLabels: Record<string, string> = {
  goods: 'Goods',
  services: 'Services',
  software: 'Software',
  consulting: 'Consulting',
  'contingent-labour': 'Contingent Labour',
  'contract-renewal': 'Contract Renewal',
  'supplier-onboarding': 'Supplier Onboarding',
};

const priorityConfig: Record<string, { color: string; icon: typeof AlertTriangle }> = {
  urgent: { color: 'bg-stop-soft text-stop', icon: AlertTriangle },
  high: { color: 'bg-warn-soft text-warn', icon: Clock },
  medium: { color: 'bg-accent-soft text-accent-solid', icon: Clock },
  low: { color: 'bg-idle-soft text-ink-2', icon: Clock },
};

export function ApprovalCard({
  request,
  approval,
  selected,
  onSelectChange,
  onActionComplete,
}: ApprovalCardProps) {
  const [expandedAction, setExpandedAction] = useState<
    'reject' | 'request-info' | 'delegate' | null
  >(null);
  const [comment, setComment] = useState('');
  const [delegateId, setDelegateId] = useState('');
  const [showOOOWarning, setShowOOOWarning] = useState(false);

  const { data: users = [] } = useUsers();
  const { currentUser, currentRole } = useAuthStore();
  const queryClient = useQueryClient();
  // Only the assigned approver can act (matches the request-detail Approvals tab).
  const isCurrentUserApprover = canActOnApproval(
    { assignmentMode: approval.assignmentMode, approverId: approval.approverId,
      delegatedTo: approval.delegatedTo, role: approval.approverRole, status: approval.status },
    { id: currentUser.id, role: currentRole },
  ) || approval.status !== 'pending';
  const lookupUser = useUserLookup();
  const requestor = lookupUser(request.requestorId);
  const priorityCfg = priorityConfig[request.priority] ?? priorityConfig.medium;
  const updateApproval = useUpdateApproval();

  // Check if any approver in the chain is OOO
  const oooApprover = users.find((u) => u.id === approval.approverId && u.isOOO);
  const oooDelegate = oooApprover?.delegateId
    ? lookupUser(oooApprover.delegateId)
    : undefined;

  // Through the shared path: this card used to stamp the entry and advance
  // nothing, so approving the last outstanding step left the request parked in
  // `approval` while the queue showed it as done.
  const decide = async (decision: 'approved' | 'rejected', comments?: string) => {
    const result = await recordApprovalDecision({
      approval, request, decision, comments,
      actor: { id: currentUser.id, name: currentUser.name },
    });
    invalidateRequestViews(queryClient);
    return result;
  };

  const handleApprove = async () => {
    try {
      const result = await decide('approved');
      onActionComplete('approved');
      toast.success(result.advanced ? `${request.id} approved and moved on` : `${request.id} — your approval is recorded`,
        { description: result.advanced ? request.title : `${result.outstanding} approver(s) still to go.` });
    } catch (err) {
      toast.error(`Approve failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  };

  const handleReject = async () => {
    if (!comment.trim()) return;
    try {
      await decide('rejected', comment);
      onActionComplete('rejected');
      toast.error(`${request.id} rejected`, { description: 'It goes back to the requester with your reason.' });
      setExpandedAction(null);
      setComment('');
    } catch (err) {
      toast.error(`Reject failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  };

  const handleRequestInfo = async () => {
    if (!comment.trim()) return;
    try {
      await updateApproval.mutateAsync({
        id: approval.id,
        patch: { status: 'info-requested', comments: comment },
      });
      onActionComplete('info-requested');
      toast.info(`Information requested for ${request.id}`, { description: request.title });
      setExpandedAction(null);
      setComment('');
    } catch (err) {
      toast.error(`Request info failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  };

  const handleDelegate = async () => {
    if (!delegateId) return;
    const delegate = lookupUser(delegateId);
    try {
      await updateApproval.mutateAsync({
        id: approval.id,
        patch: { status: 'delegated', delegatedTo: delegateId },
      });
      onActionComplete('delegated');
      toast.success(`${request.id} delegated to ${delegate?.name}`, { description: request.title });
      setExpandedAction(null);
      setDelegateId('');
    } catch (err) {
      toast.error(`Delegate failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onSelectChange(checked === true)}
          className="mt-1"
        />

        <div className="min-w-0 flex-1 space-y-3">
          {/* Header.
              Three tiers, so the row answers "what am I approving, how much,
              and how urgently" before anything else is read:
                1. the request, and the amount — tabular figures, so a column of
                   decisions can be compared down the page;
                2. which decision this is (step and role) and who asked;
                3. everything else, below.
              The amount was already on the card, as a small span among the
              badges. It is the fact this screen exists to present, so it leads
              rather than sits in a row of chips. */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  to={`/requests/${request.id}`}
                  className="group inline-flex items-center gap-1.5 text-body font-semibold text-ink hover:text-accent-solid"
                >
                  {request.title}
                  <ExternalLink className="size-3 text-ink-3 group-hover:text-accent-solid" aria-hidden="true" />
                </Link>
                <Link
                  to={`/requests/${request.id}`}
                  className="font-mono text-caption text-ink-3 hover:text-accent-solid hover:underline"
                >
                  {request.id}
                </Link>
              </div>
              <p className="text-caption text-ink-3 mt-0.5">
                {approval.approverRole} &middot; requested by{' '}
                {requestor?.name ?? 'Unknown'}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0 text-right">
              <span className="text-heading font-semibold tabular-nums text-ink leading-none">
                {formatCurrency(request.value, request.currency)}
              </span>
              {request.slaDeadline && (
                <SLACountdown deadline={request.slaDeadline} compact />
              )}
              {request.isOverdue && !request.slaDeadline && (
                <span className="text-caption font-medium text-stop">Overdue</span>
              )}
            </div>
          </div>

          {/* Badges row.
              The amount used to sit here, as a small span among the badges. It
              has moved to the header — same fact, given the weight the decision
              deserves — so it is not repeated here. */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className={priorityCfg.color}>
              {getStatusLabel(request.priority)}
            </Badge>
            <Badge variant="outline">
              {categoryLabels[request.category] ?? request.category}
            </Badge>
            <StatusBadge status={approval.status} size="sm" />
          </div>

          {/* Key data points. An empty one renders an em dash rather than a
              bare label: "Budget Owner:" followed by nothing reads as a broken
              field, and every cost centre in the seed is in fact unowned. */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-caption text-ink-2 sm:grid-cols-4">
            {[
              ['Cost centre', request.costCentre],
              ['Budget owner', request.budgetOwner],
              ['Channel', getStatusLabel(request.buyingChannel)],
              ['Needed by', request.deliveryDate],
            ].map(([label, value]) => (
              <div key={label}>
                <span className="text-ink-3">{label}:</span>{' '}
                {value || <span className="text-ink-3">&mdash;</span>}
              </div>
            ))}
          </div>

          {/* OOO Warning */}
          {oooApprover && oooDelegate && !showOOOWarning && (
            <OOOWarning
              approverName={oooApprover.name}
              delegateName={oooDelegate.name}
              onAcceptDelegate={() => {
                setShowOOOWarning(true);
                toast.success(`Routed to ${oooDelegate.name}`);
              }}
              onDismiss={() => setShowOOOWarning(true)}
            />
          )}

          {/* Action buttons — only the assigned approver can act on a pending
              approval. Others see who it's with (consistent with the
              request-detail Approvals tab); resolved approvals show no actions. */}
          {approval.status !== 'pending' ? null : !isCurrentUserApprover ? (
            <p className="text-caption text-ink-3">
              Awaiting <span className="font-medium text-ink-2">{approval.approverName || approval.approverRole}</span>
              {' '}— switch to that role to act on it.
            </p>
          ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              className="bg-ok text-paper hover:brightness-110"
              onClick={handleApprove}
            >
              <Check className="size-3.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant={expandedAction === 'reject' ? 'destructive' : 'outline'}
              onClick={() =>
                setExpandedAction(expandedAction === 'reject' ? null : 'reject')
              }
            >
              <X className="size-3.5" />
              Reject
            </Button>
            <Button
              size="sm"
              variant={expandedAction === 'request-info' ? 'default' : 'outline'}
              className={
                expandedAction === 'request-info'
                  ? 'bg-warn text-paper hover:brightness-110'
                  : ''
              }
              onClick={() =>
                setExpandedAction(
                  expandedAction === 'request-info' ? null : 'request-info'
                )
              }
            >
              <MessageSquare className="size-3.5" />
              Request Info
            </Button>
            <Button
              size="sm"
              variant={expandedAction === 'delegate' ? 'secondary' : 'outline'}
              onClick={() =>
                setExpandedAction(expandedAction === 'delegate' ? null : 'delegate')
              }
            >
              <UserPlus className="size-3.5" />
              Delegate
            </Button>
          </div>
          )}

          {/* Expanded inline forms */}
          {expandedAction === 'reject' && (
            <div className="space-y-2 rounded-md border border-stop-line bg-stop-soft p-3">
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
                  disabled={!comment.trim()}
                >
                  Confirm Rejection
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setExpandedAction(null);
                    setComment('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {expandedAction === 'request-info' && (
            <div className="space-y-2 rounded-md border border-warn-line bg-warn-soft p-3">
              <Textarea
                placeholder="What information do you need?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="bg-warn text-paper hover:brightness-110"
                  onClick={handleRequestInfo}
                  disabled={!comment.trim()}
                >
                  Send Request
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setExpandedAction(null);
                    setComment('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {expandedAction === 'delegate' && (
            <div className="space-y-2 rounded-md border p-3">
              <Select value={delegateId} onValueChange={setDelegateId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select delegate" />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter((u) => u.id !== approval.approverId && !u.isOOO)
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleDelegate}
                  disabled={!delegateId}
                >
                  Confirm Delegation
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setExpandedAction(null);
                    setDelegateId('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
