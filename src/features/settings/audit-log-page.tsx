import { useState, useMemo } from 'react';
import { Download } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable, type Column } from '@/components/shared/data-table';
import { formatDate } from '@/lib/format';
import { useDatabaseAdminStore } from '@/stores/database-admin-store';
import { useAuditEntries } from '@/lib/db/hooks/use-audit-entries';

interface AuditRow {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  objectType: string;
  objectId: string;
  detail: string;
  ipAddress: string;
  [key: string]: unknown;
}

// Static seed examples — shown alongside Supabase-persisted rows for
// entries that predate the audit_entries table. Drop once sufficient
// history has accumulated in Supabase.
const seedAuditEntries: AuditRow[] = [
  { id: 'AUD-001', timestamp: '2025-01-08T09:15:00Z', user: 'Marcus Johnson', action: 'Submitted', objectType: 'Request', objectId: 'REQ-2024-0014', detail: 'Submitted new request: Org design transformation', ipAddress: '10.0.1.45' },
  { id: 'AUD-002', timestamp: '2025-01-08T09:10:00Z', user: 'Anna Müller', action: 'Approved', objectType: 'Request', objectId: 'REQ-2024-0013', detail: 'Approved Microsoft 365 E5 upgrade', ipAddress: '10.0.1.22' },
  { id: 'AUD-003', timestamp: '2025-01-08T08:45:00Z', user: 'System', action: 'SLA Breach', objectType: 'Request', objectId: 'REQ-2024-0006', detail: 'SLA breached: 42 days in sourcing stage', ipAddress: '-' },
  { id: 'AUD-004', timestamp: '2025-01-08T08:30:00Z', user: 'Sarah Chen', action: 'Updated', objectType: 'Request', objectId: 'REQ-2024-0009', detail: 'Referred back to requestor for additional justification', ipAddress: '10.0.1.31' },
  { id: 'AUD-005', timestamp: '2025-01-08T08:00:00Z', user: 'System', action: 'Escalated', objectType: 'Request', objectId: 'REQ-2024-0007', detail: 'Auto-escalated to VP Procurement due to SLA breach', ipAddress: '-' },
  { id: 'AUD-006', timestamp: '2025-01-07T16:45:00Z', user: 'Anna Müller', action: 'Stage Change', objectType: 'Request', objectId: 'REQ-2024-0013', detail: 'Moved from approval to contracting', ipAddress: '10.0.1.22' },
  { id: 'AUD-007', timestamp: '2025-01-07T15:30:00Z', user: 'AI Agent', action: 'Duplicate Detected', objectType: 'Request', objectId: 'REQ-2024-0022', detail: '78% similarity with archived request found', ipAddress: '-' },
  { id: 'AUD-008', timestamp: '2025-01-07T14:20:00Z', user: 'Elena Petrova', action: 'Commented', objectType: 'Request', objectId: 'REQ-2024-0001', detail: 'Added comment with migration report attachment', ipAddress: '10.0.2.15' },
  { id: 'AUD-009', timestamp: '2025-01-07T11:00:00Z', user: 'Marcus Johnson', action: 'Submitted', objectType: 'Request', objectId: 'REQ-2024-0031', detail: 'Submitted Salesforce expansion request', ipAddress: '10.0.1.45' },
  { id: 'AUD-010', timestamp: '2025-01-07T10:00:00Z', user: 'Lisa Nakamura', action: 'Updated', objectType: 'Supplier', objectId: 'SUP-021', detail: 'Updated TechBridge screening status', ipAddress: '10.0.1.55' },
  { id: 'AUD-011', timestamp: '2025-01-07T09:30:00Z', user: 'Dr. Katrin Bauer', action: 'Approved', objectType: 'Request', objectId: 'REQ-2024-0023', detail: 'Finance approval for IoT sensors procurement', ipAddress: '10.0.3.10' },
  { id: 'AUD-012', timestamp: '2025-01-07T08:00:00Z', user: 'System', action: 'Alert', objectType: 'Contract', objectId: 'CON-008', detail: 'Contract expiry alert: Siemens IoT Platform (30 days)', ipAddress: '-' },
  { id: 'AUD-013', timestamp: '2025-01-06T17:00:00Z', user: 'System', action: 'SLA Warning', objectType: 'Request', objectId: 'REQ-2024-0008', detail: 'Validation stage SLA exceeded (30 days)', ipAddress: '-' },
  { id: 'AUD-014', timestamp: '2025-01-06T14:30:00Z', user: 'Sarah Chen', action: 'Referred Back', objectType: 'Request', objectId: 'REQ-2024-0009', detail: 'Referred back: additional business case needed', ipAddress: '10.0.1.31' },
  { id: 'AUD-015', timestamp: '2025-01-06T13:00:00Z', user: 'System', action: 'Matched', objectType: 'Invoice', objectId: 'INV-010', detail: 'Invoice partially matched against PO-010', ipAddress: '-' },
  { id: 'AUD-016', timestamp: '2025-01-06T10:00:00Z', user: 'AI Agent', action: 'Risk Alert', objectType: 'Supplier', objectId: 'SUP-005', detail: 'SRA expiry alert for Capgemini', ipAddress: '-' },
  { id: 'AUD-017', timestamp: '2025-01-06T09:15:00Z', user: 'Marcus Johnson', action: 'Commented', objectType: 'Request', objectId: 'REQ-2024-0010', detail: 'Internal note: shortlisted 3 TMCs', ipAddress: '10.0.1.45' },
  { id: 'AUD-018', timestamp: '2025-01-05T14:00:00Z', user: 'Christine Dupont', action: 'Rule Updated', objectType: 'Rule', objectId: 'RULE-003', detail: 'Updated consulting threshold from €100K to €75K', ipAddress: '10.0.1.10' },
  { id: 'AUD-019', timestamp: '2025-01-05T11:30:00Z', user: 'Robert Fischer', action: 'Approved', objectType: 'Request', objectId: 'REQ-2024-0023', detail: 'Finance approval for IoT sensors', ipAddress: '10.0.3.12' },
  { id: 'AUD-020', timestamp: '2025-01-05T10:00:00Z', user: 'System', action: 'PO Created', objectType: 'PO', objectId: 'PO-006', detail: 'PO submitted to Lenovo for 350 ThinkPad laptops', ipAddress: '-' },
  { id: 'AUD-021', timestamp: '2025-01-04T16:00:00Z', user: 'AI Agent', action: 'Anomaly Detected', objectType: 'Analytics', objectId: 'ANL-Q4', detail: 'IT consulting spend 23% above forecast', ipAddress: '-' },
  { id: 'AUD-022', timestamp: '2025-01-04T08:00:00Z', user: 'System', action: 'Delegation', objectType: 'User', objectId: 'u2', detail: 'Thomas Weber OOO: approvals delegated to Anna Müller', ipAddress: '-' },
  { id: 'AUD-023', timestamp: '2025-01-04T07:45:00Z', user: 'System', action: 'Delegation', objectType: 'User', objectId: 'u8', detail: 'Robert Fischer OOO: delegated to Dr. Katrin Bauer', ipAddress: '-' },
  { id: 'AUD-024', timestamp: '2025-01-03T14:00:00Z', user: 'System', action: 'Disputed', objectType: 'Invoice', objectId: 'INV-011', detail: 'Invoice flagged: no matching PO found', ipAddress: '-' },
  { id: 'AUD-025', timestamp: '2025-01-03T11:00:00Z', user: 'Anna Müller', action: 'Commented', objectType: 'Request', objectId: 'REQ-2024-0011', detail: 'Comment on cyber insurance renewal quotes', ipAddress: '10.0.1.22' },
  { id: 'AUD-026', timestamp: '2025-01-02T09:00:00Z', user: 'AI Agent', action: 'Model Retrained', objectType: 'AI Agent', objectId: 'AGT-001', detail: 'Classification model retrained, accuracy 94.2%', ipAddress: '-' },
  { id: 'AUD-027', timestamp: '2024-12-28T10:00:00Z', user: 'Henrik Larsson', action: 'Rule Created', objectType: 'Rule', objectId: 'RULE-007', detail: 'Created new routing rule: Sustainability threshold', ipAddress: '10.0.1.11' },
  { id: 'AUD-028', timestamp: '2024-12-27T14:00:00Z', user: 'David Kowalski', action: 'Updated', objectType: 'Supplier', objectId: 'SUP-012', detail: 'Updated Sodexo performance score to 74', ipAddress: '10.0.1.60' },
  { id: 'AUD-029', timestamp: '2024-12-26T09:30:00Z', user: 'James Chen', action: 'Login', objectType: 'Auth', objectId: 'SESSION-4892', detail: 'User login from Frankfurt office', ipAddress: '10.0.1.45' },
  { id: 'AUD-030', timestamp: '2024-12-25T16:00:00Z', user: 'System', action: 'Contract Updated', objectType: 'Contract', objectId: 'CON-011', detail: 'WPP Marketing contract status changed to expiring', ipAddress: '-' },
  { id: 'AUD-031', timestamp: '2024-12-24T11:00:00Z', user: 'Sarah Chen', action: 'Rejected', objectType: 'Request', objectId: 'REQ-2024-0035', detail: 'Rejected Deloitte audit co-source: build internal instead', ipAddress: '10.0.1.31' },
  { id: 'AUD-032', timestamp: '2024-12-23T15:00:00Z', user: 'Lisa Nakamura', action: 'Onboarding Started', objectType: 'Supplier', objectId: 'SUP-022', detail: 'Initiated onboarding for GreenEnergy GmbH', ipAddress: '10.0.1.55' },
  { id: 'AUD-033', timestamp: '2024-12-22T10:00:00Z', user: 'Christine Dupont', action: 'Rule Disabled', objectType: 'Rule', objectId: 'RULE-005', detail: 'Disabled obsolete framework call-off rule', ipAddress: '10.0.1.10' },
  { id: 'AUD-034', timestamp: '2024-12-21T09:00:00Z', user: 'Elena Petrova', action: 'Submitted', objectType: 'Request', objectId: 'REQ-2024-0028', detail: 'Submitted network switch refresh request', ipAddress: '10.0.2.15' },
  { id: 'AUD-035', timestamp: '2024-12-20T14:00:00Z', user: 'Marcus Johnson', action: 'Updated', objectType: 'Contract', objectId: 'CON-015', detail: 'Updated furniture framework pricing schedule', ipAddress: '10.0.1.45' },
  { id: 'AUD-036', timestamp: '2024-12-19T08:30:00Z', user: 'Anna Müller', action: 'Login', objectType: 'Auth', objectId: 'SESSION-4756', detail: 'User login from Amsterdam office', ipAddress: '10.0.2.22' },
  { id: 'AUD-037', timestamp: '2024-12-18T16:00:00Z', user: 'Dr. Katrin Bauer', action: 'Approved', objectType: 'Request', objectId: 'REQ-2024-0016', detail: 'Finance approval for laptop refresh programme', ipAddress: '10.0.3.10' },
  { id: 'AUD-038', timestamp: '2024-12-17T11:00:00Z', user: 'System', action: 'Reminder', objectType: 'Request', objectId: 'REQ-2024-0007', detail: 'Approval reminder sent for Java developers request', ipAddress: '-' },
  { id: 'AUD-039', timestamp: '2024-12-16T09:00:00Z', user: 'Henrik Larsson', action: 'Policy Updated', objectType: 'Policy', objectId: 'POL-002', detail: 'Updated competitive tender threshold to €100K', ipAddress: '10.0.1.11' },
  { id: 'AUD-040', timestamp: '2024-12-15T14:30:00Z', user: 'David Kowalski', action: 'SRA Initiated', objectType: 'Supplier', objectId: 'SUP-008', detail: 'Initiated SRA renewal for Siemens AG', ipAddress: '10.0.1.60' },
];

const baseUniqueUsers = [...new Set(seedAuditEntries.map((e) => e.user))].sort();
const baseUniqueActions = [...new Set(seedAuditEntries.map((e) => e.action))].sort();
const baseUniqueObjectTypes = [...new Set(seedAuditEntries.map((e) => e.objectType))].sort();

const PAGE_SIZE = 15;

const actionColors: Record<string, string> = {
  Approved: 'bg-green-50 text-green-700',
  Rejected: 'bg-red-50 text-red-700',
  'SLA Breach': 'bg-red-50 text-red-700',
  'SLA Warning': 'bg-amber-50 text-amber-700',
  Escalated: 'bg-red-50 text-red-700',
  Submitted: 'bg-blue-50 text-blue-700',
  'Referred Back': 'bg-amber-50 text-amber-700',
  Alert: 'bg-amber-50 text-amber-700',
};

const columns: Column<AuditRow>[] = [
  {
    key: 'timestamp',
    label: 'Timestamp',
    sortable: true,
    className: 'w-[140px]',
    render: (item) => (
      <span className="text-xs">
        {formatDate(item.timestamp)}
        <br />
        <span className="text-muted-foreground">
          {new Date(item.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </span>
    ),
  },
  { key: 'user', label: 'User', sortable: true, className: 'w-[150px]' },
  {
    key: 'action',
    label: 'Action',
    sortable: true,
    className: 'w-[130px]',
    render: (item) => (
      <Badge variant="secondary" className={actionColors[item.action] ?? 'bg-gray-50 text-gray-700'}>
        {item.action}
      </Badge>
    ),
  },
  { key: 'objectType', label: 'Object Type', sortable: true, className: 'w-[100px]' },
  { key: 'objectId', label: 'Object ID', className: 'w-[120px] font-mono text-xs' },
  { key: 'detail', label: 'Detail', className: 'min-w-[200px]', render: (item) => <span className="text-xs">{item.detail}</span> },
  { key: 'ipAddress', label: 'IP Address', className: 'w-[110px] font-mono text-xs' },
];

export function AuditLogPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [objectTypeFilter, setObjectTypeFilter] = useState('all');
  const [page, setPage] = useState(0);

  // Persisted audit entries come from Supabase; the Zustand session array
  // is kept as an optimistic layer for entries whose round-trip has not
  // yet completed.
  const { data: persistedEntries = [] } = useAuditEntries();
  const sessionAudit = useDatabaseAdminStore((s) => s.audit);

  const persistedRows: AuditRow[] = useMemo(
    () =>
      persistedEntries.map((e) => ({
        id: e.id,
        timestamp: e.timestamp,
        user: e.userName,
        action: e.action,
        objectType: e.objectType,
        objectId: e.objectId,
        detail: e.detail,
        ipAddress: '-',
      })),
    [persistedEntries],
  );

  // Deduplicate optimistic session rows: the Zustand entry has a
  // client-generated id, the persisted row has the Supabase UUID, but
  // both share (timestamp, userId, action, objectId). Drop the session
  // row once the persisted copy is visible.
  const sessionRows: AuditRow[] = useMemo(() => {
    const seen = new Set(
      persistedRows.map((r) => `${r.timestamp}|${r.user}|${r.action}|${r.objectId}`),
    );
    return sessionAudit
      .filter((e) => !seen.has(`${e.timestamp}|${e.userName}|${e.action}|${e.objectId}`))
      .map((e) => ({
        id: e.id,
        timestamp: e.timestamp,
        user: e.userName,
        action: e.action,
        objectType: e.objectType,
        objectId: e.objectId,
        detail: e.detail,
        ipAddress: '-',
      }));
  }, [sessionAudit, persistedRows]);

  const allEntries = useMemo(
    () => [...sessionRows, ...persistedRows, ...seedAuditEntries],
    [sessionRows, persistedRows],
  );
  const uniqueUsers = useMemo(
    () => [...new Set([...sessionRows.map((e) => e.user), ...persistedRows.map((e) => e.user), ...baseUniqueUsers])].sort(),
    [sessionRows, persistedRows],
  );
  const uniqueActions = useMemo(
    () => [...new Set([...sessionRows.map((e) => e.action), ...persistedRows.map((e) => e.action), ...baseUniqueActions])].sort(),
    [sessionRows, persistedRows],
  );
  const uniqueObjectTypes = useMemo(
    () => [...new Set([...sessionRows.map((e) => e.objectType), ...persistedRows.map((e) => e.objectType), ...baseUniqueObjectTypes])].sort(),
    [sessionRows, persistedRows],
  );

  const filtered = useMemo(() => {
    return allEntries.filter((entry) => {
      if (dateFrom && entry.timestamp < dateFrom) return false;
      if (dateTo && entry.timestamp > dateTo + 'T23:59:59Z') return false;
      if (userFilter !== 'all' && entry.user !== userFilter) return false;
      if (actionFilter !== 'all' && entry.action !== actionFilter) return false;
      if (objectTypeFilter !== 'all' && entry.objectType !== objectTypeFilter) return false;
      return true;
    });
  }, [allEntries, dateFrom, dateTo, userFilter, actionFilter, objectTypeFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        subtitle={`${filtered.length} entries`}
        actions={
          <Button variant="outline" size="sm">
            <Download className="mr-1.5 size-4" />
            Export
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="mb-1 text-xs">From</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
            className="h-8 w-36 text-sm"
          />
        </div>
        <div>
          <Label className="mb-1 text-xs">To</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
            className="h-8 w-36 text-sm"
          />
        </div>
        <div>
          <Label className="mb-1 text-xs">User</Label>
          <Select value={userFilter} onValueChange={(v) => { setUserFilter(v); setPage(0); }}>
            <SelectTrigger className="h-8 w-44 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {uniqueUsers.map((u) => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1 text-xs">Action</Label>
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
            <SelectTrigger className="h-8 w-40 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {uniqueActions.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1 text-xs">Object Type</Label>
          <Select value={objectTypeFilter} onValueChange={(v) => { setObjectTypeFilter(v); setPage(0); }}>
            <SelectTrigger className="h-8 w-36 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {uniqueObjectTypes.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <DataTable columns={columns} data={paged} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of{' '}
            {filtered.length} entries
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
