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
import { approvalEntries } from '@/data/approval-entries';
import { requests } from '@/data/requests';
import type { ApprovalStatus, ProcurementRequest, ApprovalEntry } from '@/data/types';

// AI summaries for each request in approval stage
const aiSummaries: Record<string, string> = {
  'REQ-2024-0007':
    'Contingent labour engagement with Randstad for 8 senior Java developers supporting digital transformation. €960K over the programme period. Budget owner confirms headcount need. Programme timeline at risk without approval.',
  'REQ-2024-0014':
    'Management consulting engagement with McKinsey for operating model redesign across 3 business units. €1.85M over 6 months. CEO-sponsored transformation programme targeting €20M cost reduction. Finance has already approved; dual VP sign-off required.',
  'REQ-2024-0023':
    'Industrial IoT sensor procurement from Siemens for factory floor predictive maintenance. €140K for 200 sensors. ROI projection shows 45% reduction in unplanned downtime and €1.2M annual maintenance savings. SRA valid.',
  'REQ-2024-0031':
    'Salesforce CRM expansion including 200 additional licenses and Service Cloud module. €540K annually, up from €420K. Sales team growth drives the license increase. Budget allocated under CC-SALES-001.',
};

type UrgencyFilter = 'all' | 'urgent' | 'high' | 'medium' | 'low';
type ValueFilter = 'all' | 'under-100k' | '100k-500k' | '500k-1m' | 'over-1m';
type CategoryFilter = 'all' | string;

interface ApprovalItem {
  request: ProcurementRequest;
  approval: ApprovalEntry;
}

export function ApprovalsPage() {
  const [statusFilter, setStatusFilter] = useState<'all' | ApprovalStatus>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('all');
  const [valueFilter, setValueFilter] = useState<ValueFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

  // Build joined list of approvals with their requests
  const allItems: ApprovalItem[] = useMemo(() => {
    return approvalEntries
      .map((a) => {
        const req = requests.find((r) => r.id === a.requestId);
        if (!req) return null;
        return { request: req, approval: a };
      })
      .filter((item): item is ApprovalItem => item !== null);
  }, []);

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

  const handleBulkApprove = () => {
    selectedPendingItems.forEach((item) => {
      setDismissedIds((prev) => new Set(prev).add(item.approval.id));
    });
    setSelectedIds(new Set());
    setBulkDialogOpen(false);
    toast.success(`${selectedPendingItems.length} requests approved`);
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
          <Badge variant="secondary" className="bg-amber-100 text-amber-700">
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
          <div className="flex items-center gap-3 rounded-md border border-green-200 bg-green-50 px-4 py-2 mt-4">
            <span className="text-sm font-medium text-green-800">
              {selectedPendingItems.length} selected
            </span>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
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
              <div className="flex items-center justify-center rounded-md border border-dashed py-12">
                <p className="text-sm text-gray-500">No approvals match the current filters.</p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <ApprovalCard
                  key={item.approval.id}
                  request={item.request}
                  approval={item.approval}
                  aiSummary={
                    aiSummaries[item.request.id] ??
                    `${item.request.description} Value: ${item.request.value.toLocaleString('en-IE', { style: 'currency', currency: item.request.currency, minimumFractionDigits: 0 })}. Category: ${categoryLabels[item.request.category] ?? item.request.category}.`
                  }
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
