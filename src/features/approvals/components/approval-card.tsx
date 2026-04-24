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
import { AISuggestionCard } from '@/components/shared/ai-suggestion-card';
import { OOOWarning } from './ooo-warning';
import { formatCurrency } from '@/lib/format';
import { getStatusLabel } from '@/lib/status';
import { useUserLookup, useUsers } from '@/lib/db/hooks/use-users';
import { useUpdateApproval } from '@/lib/db/hooks/use-approvals';
import type { ProcurementRequest, ApprovalEntry } from '@/data/types';

interface ApprovalCardProps {
  request: ProcurementRequest;
  approval: ApprovalEntry;
  aiSummary: string;
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
  urgent: { color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  high: { color: 'bg-amber-100 text-amber-700', icon: Clock },
  medium: { color: 'bg-blue-100 text-blue-700', icon: Clock },
  low: { color: 'bg-gray-100 text-gray-700', icon: Clock },
};

export function ApprovalCard({
  request,
  approval,
  aiSummary,
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
  const lookupUser = useUserLookup();
  const requestor = lookupUser(request.requestorId);
  const priorityCfg = priorityConfig[request.priority] ?? priorityConfig.medium;
  const updateApproval = useUpdateApproval();

  // Check if any approver in the chain is OOO
  const oooApprover = users.find((u) => u.id === approval.approverId && u.isOOO);
  const oooDelegate = oooApprover?.delegateId
    ? lookupUser(oooApprover.delegateId)
    : undefined;

  const handleApprove = async () => {
    try {
      await updateApproval.mutateAsync({
        id: approval.id,
        patch: { status: 'approved', respondedAt: new Date().toISOString() },
      });
      onActionComplete('approved');
      toast.success(`${request.id} approved`, { description: request.title });
    } catch (err) {
      toast.error(`Approve failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  };

  const handleReject = async () => {
    if (!comment.trim()) return;
    try {
      await updateApproval.mutateAsync({
        id: approval.id,
        patch: { status: 'rejected', respondedAt: new Date().toISOString(), comments: comment },
      });
      onActionComplete('rejected');
      toast.error(`${request.id} rejected`, { description: request.title });
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
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onSelectChange(checked === true)}
          className="mt-1"
        />

        <div className="min-w-0 flex-1 space-y-3">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  to={`/requests/${request.id}`}
                  className="group inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 hover:text-blue-700"
                >
                  {request.title}
                  <ExternalLink className="size-3 text-gray-400 group-hover:text-blue-600" />
                </Link>
                <Link
                  to={`/requests/${request.id}`}
                  className="text-xs text-gray-500 hover:text-blue-700 hover:underline"
                >
                  {request.id}
                </Link>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Requested by {requestor?.name ?? 'Unknown'} &middot;{' '}
                {approval.approverRole}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {request.slaDeadline && (
                <SLACountdown deadline={request.slaDeadline} compact />
              )}
              {request.isOverdue && !request.slaDeadline && (
                <span className="text-xs font-medium text-red-600">Overdue</span>
              )}
            </div>
          </div>

          {/* Badges row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">
              {formatCurrency(request.value, request.currency)}
            </span>
            <Badge variant="secondary" className={priorityCfg.color}>
              {getStatusLabel(request.priority)}
            </Badge>
            <Badge variant="outline">
              {categoryLabels[request.category] ?? request.category}
            </Badge>
            <StatusBadge status={approval.status} size="sm" />
          </div>

          {/* AI Summary */}
          <AISuggestionCard confidence={0.92}>
            <p>{aiSummary}</p>
          </AISuggestionCard>

          {/* Key data points */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 sm:grid-cols-4">
            <div>
              <span className="text-gray-400">Cost Centre:</span>{' '}
              {request.costCentre}
            </div>
            <div>
              <span className="text-gray-400">Budget Owner:</span>{' '}
              {request.budgetOwner}
            </div>
            <div>
              <span className="text-gray-400">Channel:</span>{' '}
              {getStatusLabel(request.buyingChannel)}
            </div>
            <div>
              <span className="text-gray-400">Delivery:</span>{' '}
              {request.deliveryDate}
            </div>
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

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
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
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
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

          {/* Expanded inline forms */}
          {expandedAction === 'reject' && (
            <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3">
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
            <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
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
