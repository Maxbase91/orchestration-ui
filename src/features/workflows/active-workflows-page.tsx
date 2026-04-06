import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, DollarSign, ArrowUpCircle } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { ViewToggle } from '@/components/shared/view-toggle';
import { FilterBar, type FilterConfig } from '@/components/shared/filter-bar';
import { Button } from '@/components/ui/button';
import { requests } from '@/data/requests';
import { KanbanView } from './kanban-view';
import { TableView } from './table-view';
import { TimelineView } from './timeline-view';
import { cn } from '@/lib/utils';

const VIEWS = [
  { id: 'kanban', label: 'Kanban', icon: 'kanban' },
  { id: 'table', label: 'Table', icon: 'table' },
  { id: 'timeline', label: 'Timeline', icon: 'timeline' },
];

const FILTER_CONFIG: FilterConfig[] = [
  {
    key: 'category',
    label: 'Category',
    type: 'select',
    options: [
      { value: 'goods', label: 'Goods' },
      { value: 'services', label: 'Services' },
      { value: 'software', label: 'Software' },
      { value: 'consulting', label: 'Consulting' },
      { value: 'contingent-labour', label: 'Contingent Labour' },
      { value: 'contract-renewal', label: 'Contract Renewal' },
      { value: 'supplier-onboarding', label: 'Supplier Onboarding' },
    ],
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'select',
    options: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
      { value: 'urgent', label: 'Urgent' },
    ],
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'intake', label: 'Intake' },
      { value: 'validation', label: 'Validation' },
      { value: 'approval', label: 'Approval' },
      { value: 'sourcing', label: 'Sourcing' },
      { value: 'contracting', label: 'Contracting' },
      { value: 'po', label: 'PO' },
      { value: 'receipt', label: 'Receipt' },
      { value: 'invoice', label: 'Invoice' },
      { value: 'payment', label: 'Payment' },
    ],
  },
];

// Active statuses (exclude draft, completed, cancelled, referred-back for workflow view)
const ACTIVE_STATUSES = new Set([
  'intake',
  'validation',
  'approval',
  'sourcing',
  'contracting',
  'po',
  'receipt',
  'invoice',
  'payment',
]);

const CURRENT_USER_ID = 'u1'; // Anna Muller — simulate logged-in user

export function ActiveWorkflowsPage() {
  const [activeView, setActiveView] = useState('kanban');
  const [activeFilters, setActiveFilters] = useState<Record<string, string | string[]>>({});
  const [quickFilter, setQuickFilter] = useState<string | null>(null);
  const navigate = useNavigate();

  // Base set: active requests only
  const activeRequests = useMemo(
    () => requests.filter((r) => ACTIVE_STATUSES.has(r.status)),
    [],
  );

  // Quick filter counts
  const stuckCount = activeRequests.filter((r) => r.daysInStage > 5).length;
  const myActionCount = activeRequests.filter(
    (r) => r.ownerId === CURRENT_USER_ID,
  ).length;
  const highValueCount = activeRequests.filter(
    (r) => r.value >= 500000,
  ).length;
  const escalatedCount = activeRequests.filter(
    (r) => r.isOverdue && r.priority === 'urgent',
  ).length;

  // Apply filters
  const filteredRequests = useMemo(() => {
    let result = activeRequests;

    // Quick filter
    if (quickFilter === 'stuck') {
      result = result.filter((r) => r.daysInStage > 5);
    } else if (quickFilter === 'my-action') {
      result = result.filter((r) => r.ownerId === CURRENT_USER_ID);
    } else if (quickFilter === 'high-value') {
      result = result.filter((r) => r.value >= 500000);
    } else if (quickFilter === 'escalated') {
      result = result.filter(
        (r) => r.isOverdue && r.priority === 'urgent',
      );
    }

    // Dropdown filters
    const { category, priority, status } = activeFilters;
    if (category) {
      result = result.filter((r) => r.category === category);
    }
    if (priority) {
      result = result.filter((r) => r.priority === priority);
    }
    if (status) {
      result = result.filter((r) => r.status === status);
    }

    return result;
  }, [activeRequests, activeFilters, quickFilter]);

  function handleFilterChange(key: string, value: string | string[]) {
    setActiveFilters((prev) => ({ ...prev, [key]: value }));
  }

  function handleClearFilters() {
    setActiveFilters({});
    setQuickFilter(null);
  }

  function toggleQuickFilter(filter: string) {
    setQuickFilter((prev) => (prev === filter ? null : filter));
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Active Workflows"
        subtitle={`${filteredRequests.length} active requests across the procurement pipeline`}
        actions={
          <ViewToggle
            views={VIEWS}
            activeView={activeView}
            onChange={setActiveView}
          />
        }
      />

      {/* Quick filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <QuickFilterButton
          label={`Stuck > 5 days (${stuckCount})`}
          icon={<Clock className="size-3.5" />}
          active={quickFilter === 'stuck'}
          onClick={() => toggleQuickFilter('stuck')}
        />
        <QuickFilterButton
          label={`Awaiting my action (${myActionCount})`}
          icon={<ArrowUpCircle className="size-3.5" />}
          active={quickFilter === 'my-action'}
          onClick={() => toggleQuickFilter('my-action')}
        />
        <QuickFilterButton
          label={`High value (${highValueCount})`}
          icon={<DollarSign className="size-3.5" />}
          active={quickFilter === 'high-value'}
          onClick={() => toggleQuickFilter('high-value')}
        />
        <QuickFilterButton
          label={`Escalated (${escalatedCount})`}
          icon={<AlertTriangle className="size-3.5" />}
          active={quickFilter === 'escalated'}
          onClick={() => toggleQuickFilter('escalated')}
        />
      </div>

      {/* Dropdown filters */}
      <FilterBar
        filters={FILTER_CONFIG}
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
        onClear={handleClearFilters}
      />

      {/* View */}
      <div>
        {activeView === 'kanban' && (
          <KanbanView
            requests={filteredRequests}
            onCardClick={(id) => navigate(`/requests/${id}`)}
          />
        )}
        {activeView === 'table' && <TableView requests={filteredRequests} />}
        {activeView === 'timeline' && (
          <TimelineView requests={filteredRequests} />
        )}
      </div>
    </div>
  );
}

function QuickFilterButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant={active ? 'default' : 'outline'}
      size="sm"
      onClick={onClick}
      className={cn(
        'gap-1.5 text-xs',
        active && 'bg-[#1B2A4A] text-white hover:bg-[#1B2A4A]/90',
      )}
    >
      {icon}
      {label}
    </Button>
  );
}
