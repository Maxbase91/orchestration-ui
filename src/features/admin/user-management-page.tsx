import { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { useUsers } from '@/lib/db/hooks/use-users';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  isOOO: boolean;
  lastLogin: string;
  [key: string]: unknown;
}

const mockLastLogins: Record<string, string> = {
  u1: '2026-04-06 09:12',
  u2: '2026-03-15 14:30',
  u3: '2026-04-06 08:45',
  u4: '2026-04-05 16:22',
  u5: '2026-04-06 10:05',
  u6: '2026-04-04 11:38',
  u7: '2026-04-06 07:55',
  u8: '2026-03-20 09:00',
  u9: '2026-04-05 13:15',
  u10: '2026-04-06 08:30',
  u11: '2026-04-05 17:45',
  u12: '2026-04-03 15:10',
};

export function UserManagementPage() {
  const { data: users = [] } = useUsers();
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');

  const userRows: UserRow[] = useMemo(
    () =>
      users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        department: u.department,
        isOOO: u.isOOO,
        lastLogin: mockLastLogins[u.id] ?? '2026-04-01 10:00',
      })),
    [users],
  );

  const allRoles = useMemo(() => [...new Set(users.map((u) => u.role))], [users]);
  const allDepartments = useMemo(() => [...new Set(users.map((u) => u.department))], [users]);

  const filtered = useMemo(() => {
    return userRows.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (deptFilter !== 'all' && u.department !== deptFilter) return false;
      return true;
    });
  }, [userRows, roleFilter, deptFilter]);

  const activeCount = users.filter((u) => !u.isOOO).length;
  const oooCount = users.filter((u) => u.isOOO).length;

  const columns: Column<UserRow>[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email' },
    {
      key: 'role',
      label: 'Role',
      render: (item) => (
        <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
          {item.role as string}
        </span>
      ),
    },
    { key: 'department', label: 'Department', sortable: true },
    {
      key: 'isOOO',
      label: 'Status',
      render: (item) => (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium">
          <span
            className={`size-1.5 rounded-full ${
              item.isOOO ? 'bg-amber-500' : 'bg-green-500'
            }`}
          />
          {item.isOOO ? 'On Leave' : 'Active'}
        </span>
      ),
    },
    { key: 'lastLogin', label: 'Last Login', sortable: true },
    {
      key: 'actions',
      label: 'Actions',
      render: (item) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              toast.info(`Edit role for ${item.name}`);
            }}
          >
            Edit Role
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              toast.success(`Password reset sent to ${item.email}`);
            }}
          >
            Reset PW
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-red-600"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Deactivate ${item.name}?`)) {
                toast.success(`${item.name} deactivated`);
              }
            }}
          >
            Deactivate
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        subtitle="Manage user accounts and roles"
        actions={
          <Button onClick={() => toast.info('Add user form coming soon')}>
            <Plus className="mr-1.5 size-4" />
            Add User
          </Button>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-semibold">{users.length}</p>
          <p className="text-xs text-muted-foreground">Total Users</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-semibold">{activeCount}</p>
          <p className="text-xs text-muted-foreground">Active Now</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-semibold">{oooCount}</p>
          <p className="text-xs text-muted-foreground">On Leave</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {allRoles.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {allDepartments.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="p-4">
        <DataTable
          columns={columns}
          data={filtered}
          searchable
          searchPlaceholder="Search users..."
        />
      </Card>
    </div>
  );
}
