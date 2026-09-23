import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { ApprovalCard } from './components/approval-card';
import { BulkApproveDialog } from './components/bulk-approve-dialog';
import { useApprovals, useUpdateApproval } from '@/lib/db/hooks/use-approvals';
import { useRequests } from '@/lib/db/hooks/use-requests';
import { useAuthStore } from '@/stores/auth-store';
import { isMyApproval } from '@/lib/procurement/personal-queue';
import type { ApprovalStatus, ProcurementRequest, ApprovalEntry } from '@/data/types';


type UrgencyFilter = 'all' | 'urgent' | 'high' | 'medium' | 'low';
type ValueFilter = 'all' | 'under-100k' | '100k-500k' | '500k-1m' | 'over-1m';
type CategoryFilter = 'all' | string;

interface ApprovalItem {
  request: ProcurementRequest;
  approval: ApprovalEntry;
}

export function ApprovalsPage() {
  const { data: approvalEntries = [] } = useApprovals();
  const { data: requests = [] } = useRequests();
  const currentUser = useAuthStore((s) => s.currentUser);
  const updateApproval = useUpdateApproval();
  // Lead with the actionable queue (pending), not resolved history — an
  // approvals inbox should open on "what needs my decision". Approved/rejected
  // stay available via their tabs.
  const [statusFilter, setStatusFilter] = useState<'all' | ApprovalStatus>('pending');
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('all');
  const [valueFilter, setValueFilter] = useState<ValueFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

  // Build joined list of approvals with their requests — scoped to the current
  // user's queue (assigned to them, or delegated to them while an approver is
  // out of office). "My Approvals" means mine: switch role to see another
  // queue. Approver identities are the canonical switchable users (one set).
  const allItems: ApprovalItem[] = useMemo(() => {
    return approvalEntries
      .filter((a) => isMyApproval(a, currentUser.id))
      .map((a) => {
        const req = requests.find((r) => r.id === a.requestId);
        if (!req) return null;
        return { request: req, approval: a };
      })
      .filter((item): item is ApprovalItem => item !== null);
  }, [approvalEntries, requests, currentUser.id]);

  // Apply filters
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      // Status filter
      if (statusFilter !== 'all' && item.approval.status !== statusFilter) return false;

      // Urgency filter
      if (urgencyFilter !== 'all' && item.request.priority !== urgencyFilter) return false;

      // Value filter
      const v = item.request.value;
      if (valueFilter === 'under-100k' && v >= 100000) return false;
      if (valueFilter === '100k-500k' && (v < 100000 || v >= 500000)) return false;
      if (valueFilter === '500k-1m' && (v < 500000 || v >= 1000000)) return false;
      if (valueFilter === 'over-1m' && v < 1000000) return false;

      // Category filter
      if (categoryFilter !== 'all' && item.request.category !== categoryFilter) return false;

      // Dismissed filter
      if (dismissedIds.has(item.approval.id)) return false;

      return true;
    });
  }, [allItems, statusFilter, urgencyFilter, valueFilter, categoryFilter, dismissedIds]);

  const pendingCount = allItems.filter((i) => i.approval.status === 'pending').length;

  const handleSelectChange = (approvalId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(approvalId);
      else next.delete(approvalId);
      return next;
    });
  };

  const handleActionComplete = (approvalId: string, _action: string) => {
    setDismissedIds((prev) => new Set(prev).add(approvalId));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(approvalId);
      return next;
    });
  };

  const selectedPendingItems = filteredItems.filter(
    (item) => selectedIds.has(item.approval.id) && item.approval.status === 'pending'
  );

  const handleBulkApprove = async () => {
    const timestamp = new Date().toISOString();
    const results = await Promise.allSettled(
      selectedPendingItems.map((item) =>
        updateApproval.mutateAsync({
          id: item.approval.id,
          patch: { status: 'approved', respondedAt: timestamp },
        }),
      ),
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - ok;
    selectedPendingItems.forEach((item) => {
      setDismissedIds((prev) => new Set(prev).add(item.approval.id));
    });
    setSelectedIds(new Set());
    setBulkDialogOpen(false);
    if (failed === 0) {
      toast.success(`${ok} requests approved`);
    } else {
      toast.warning(`${ok} approved, ${failed} failed`);
    }
  };

  // Get unique categories from items for filter
  const categories = useMemo(() => {
    const cats = new Set(allItems.map((i) => i.request.category));
    return Array.from(cats).sort();
  }, [allItems]);

  const categoryLabels: Record<string, string> = {
    goods: 'Goods',
    services: 'Services',
    software: 'Software',
    consulting: 'Consulting',
    'contingent-labour': 'Contingent Labour',
    'contract-renewal': 'Contract Renewal',
    'supplier-onboarding': 'Supplier Onboarding',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Approvals"
        badge={
          <Badge variant="secondary" className="bg-warn-soft text-warn">
            {pendingCount} pending
          </Badge>
        }
        actions={
          <Button variant="outline" asChild>
            <Link to="/approvals/delegation">
              <Calendar className="size-4" />
              Delegation Settings
            </Link>
          </Button>
        }
      />

      <Tabs
        value={statusFilter}
        onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="all">
              All ({allItems.length - dismissedIds.size})
            </TabsTrigger>
            <TabsTrigger value="pending">
              Pending ({allItems.filter((i) => i.approval.status === 'pending' && !dismissedIds.has(i.approval.id)).length})
            </TabsTrigger>
            <TabsTrigger value="approved">
              Approved ({allItems.filter((i) => i.approval.status === 'approved' && !dismissedIds.has(i.approval.id)).length})
            </TabsTrigger>
            <TabsTrigger value="rejected">
              Rejected ({allItems.filter((i) => i.approval.status === 'rejected' && !dismissedIds.has(i.approval.id)).length})
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Select value={urgencyFilter} onValueChange={(v) => setUrgencyFilter(v as UrgencyFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Urgency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All urgencies</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={valueFilter} onValueChange={(v) => setValueFilter(v as ValueFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Value" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All values</SelectItem>
                <SelectItem value="under-100k">Under €100K</SelectItem>
                <SelectItem value="100k-500k">€100K - €500K</SelectItem>
                <SelectItem value="500k-1m">€500K - €1M</SelectItem>
                <SelectItem value="over-1m">Over €1M</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as CategoryFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {categoryLabels[c] ?? c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedPendingItems.length > 0 && (
          <div className="flex items-center gap-3 rounded-md border border-ok-line bg-ok-soft px-4 py-2 mt-4">
            <span className="text-body font-medium text-ok">
              {selectedPendingItems.length} selected
            </span>
            <Button
              size="sm"
              className="bg-ok text-paper hover:brightness-110"
              onClick={() => setBulkDialogOpen(true)}
            >
              Approve Selected ({selectedPendingItems.length})
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear selection
            </Button>
          </div>
        )}

        {/* Use a single content area that renders for all tab values */}
        {(['all', 'pending', 'approved', 'rejected'] as const).map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-3 mt-4">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed py-12">
                <p className="text-body text-ink-3">
                  No approvals in {currentUser.name}&rsquo;s queue match the current filters.
                </p>
                <p className="text-caption text-ink-3">Switch role to view another approver&rsquo;s queue.</p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <ApprovalCard
                  key={item.approval.id}
                  request={item.request}
                  approval={item.approval}
                  selected={selectedIds.has(item.approval.id)}
                  onSelectChange={(checked) =>
                    handleSelectChange(item.approval.id, checked)
                  }
                  onActionComplete={(action) =>
                    handleActionComplete(item.approval.id, action)
                  }
                />
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>

      <BulkApproveDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        requests={selectedPendingItems.map((i) => i.request)}
        onConfirm={handleBulkApprove}
      />
    </div>
  );
}
