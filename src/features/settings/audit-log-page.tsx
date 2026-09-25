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
import { downloadCsv, datedFilename } from '@/lib/csv';
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
  [key: string]: unknown;
}

// Only what happened. There were 40 hard-coded entries here, shown beside the
// persisted rows "for history that predates the table" — invented logins from
// named offices, an AI agent "detecting a duplicate" no search ever ran, a
// "model retrained" nobody trained, each with a made-up IP address. On the one
// screen whose job is evidence, invented rows are the worst kind of wrong.

const PAGE_SIZE = 15;

const actionColors: Record<string, string> = {
  Approved: 'bg-ok-soft text-ok',
  Rejected: 'bg-stop-soft text-stop',
  'SLA Breach': 'bg-stop-soft text-stop',
  'SLA Warning': 'bg-warn-soft text-warn',
  Escalated: 'bg-stop-soft text-stop',
  Submitted: 'bg-accent-soft text-accent-solid',
  'Referred Back': 'bg-warn-soft text-warn',
  Alert: 'bg-warn-soft text-warn',
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
      <Badge variant="secondary" className={actionColors[item.action] ?? 'bg-card-2 text-ink-2'}>
        {item.action}
      </Badge>
    ),
  },
  { key: 'objectType', label: 'Object Type', sortable: true, className: 'w-[100px]' },
  { key: 'objectId', label: 'Object ID', className: 'w-[120px] font-mono text-xs' },
  { key: 'detail', label: 'Detail', className: 'min-w-[200px]', render: (item) => <span className="text-xs">{item.detail}</span> },
];

export function AuditLogPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [objectTypeFilter, setObjectTypeFilter] = useState('all');
  const [page, setPage] = useState(0);

  // Persisted audit entries come from the database; the Zustand session array
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
      })),
    [persistedEntries],
  );

  // Deduplicate optimistic session rows: the Zustand entry has a
  // client-generated id, the persisted row has the database-assigned UUID, but
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
      }));
  }, [sessionAudit, persistedRows]);

  const allEntries = useMemo(
    () => [...sessionRows, ...persistedRows],
    [sessionRows, persistedRows],
  );
  const uniqueUsers = useMemo(
    () => [...new Set([...sessionRows.map((e) => e.user), ...persistedRows.map((e) => e.user)])].sort(),
    [sessionRows, persistedRows],
  );
  const uniqueActions = useMemo(
    () => [...new Set([...sessionRows.map((e) => e.action), ...persistedRows.map((e) => e.action)])].sort(),
    [sessionRows, persistedRows],
  );
  const uniqueObjectTypes = useMemo(
    () => [...new Set([...sessionRows.map((e) => e.objectType), ...persistedRows.map((e) => e.objectType)])].sort(),
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

  // Exports what the FILTERS produced, not the page and not the whole table.
  // The page would be an arbitrary 25 rows; the whole table would ignore the
  // filters the admin just set, which is the one thing they were doing. The
  // button had no handler at all — it rendered, it was clickable, and clicking
  // it did nothing, on the screen whose entire purpose is producing evidence.
  //
  // Columns are named explicitly rather than read off row zero, so a row that
  // happens to lack a field cannot silently drop the column for every row.
  const handleExport = () => {
    downloadCsv(
      datedFilename('audit-log'),
      filtered.map((row) => ({
        timestamp: row.timestamp,
        user: row.user,
        action: row.action,
        object_type: row.objectType,
        object_id: row.objectId,
        detail: row.detail,
      })),
      ['timestamp', 'user', 'action', 'object_type', 'object_id', 'detail'],
    );
  };

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        subtitle={`${filtered.length} entries`}
        actions={
          <Button variant="outline" size="sm" onClick={handleExport} disabled={filtered.length === 0}>
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
