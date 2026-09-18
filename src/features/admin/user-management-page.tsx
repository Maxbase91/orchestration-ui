import { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from '@/lib/db/hooks/use-users';
import { roles as canonicalRoles } from '@/config/roles';
import type { User } from '@/data/types';

/** Canonical system role id → friendly label (falls back to the raw value). */
const roleLabel = (id: string) => canonicalRoles.find((r) => r.id === id)?.label ?? id;

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  isOOO: boolean;
  [key: string]: unknown;
}


const blankForm = { name: '', email: '', role: '', department: '' };
const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'U';

export function UserManagementPage() {
  const { data: users = [] } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editRole, setEditRole] = useState('');

  const handleAdd = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    const user: User = {
      id: `u${Date.now()}`,
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role.trim() || 'service-owner',
      department: form.department.trim() || 'General',
      initials: initialsOf(form.name),
      isOOO: false,
    };
    try {
      await createUser.mutateAsync(user);
      toast.success(`${user.name} added`);
      setAddOpen(false);
      setForm(blankForm);
    } catch (e) {
      toast.error(`Add failed: ${e instanceof Error ? e.message : 'unknown'}`);
    }
  };

  const handleSaveRole = async () => {
    if (!editUser) return;
    try {
      await updateUser.mutateAsync({ id: editUser.id, patch: { role: editRole } });
      toast.success(`Role updated for ${editUser.name}`);
      setEditUser(null);
    } catch (e) {
      toast.error(`Update failed: ${e instanceof Error ? e.message : 'unknown'}`);
    }
  };

  const handleDeactivate = async (item: UserRow) => {
    if (!confirm(`Remove ${item.name}? This deletes the user record.`)) return;
    try {
      await deleteUser.mutateAsync(item.id);
      toast.success(`${item.name} removed`);
    } catch (e) {
      toast.error(`Remove failed: ${e instanceof Error ? e.message : 'unknown'}`);
    }
  };

  const userRows: UserRow[] = useMemo(
    () =>
      users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        department: u.department,
        isOOO: u.isOOO,
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
        <span className="inline-flex rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-solid">
          {roleLabel(item.role as string)}
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
              item.isOOO ? 'bg-warn' : 'bg-ok'
            }`}
          />
          {item.isOOO ? 'On Leave' : 'Active'}
        </span>
      ),
    },
    // A "Last Login" column was here, sortable, filled from a hardcoded map of
    // twelve ids with '2026-04-01 10:00' for everyone else. `users` has no such
    // column and could not have one: there is no authentication, so nothing
    // records a login. An admin sorting by it was ordering fiction.
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
              setEditUser(item);
              setEditRole(item.role as string);
            }}
          >
            Edit Role
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-stop"
            onClick={(e) => {
              e.stopPropagation();
              handleDeactivate(item);
            }}
          >
            Remove
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
          <Button onClick={() => { setForm(blankForm); setAddOpen(true); }}>
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
                {roleLabel(r)}
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

      {/* Add user */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add User</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="nu-name">Name</Label>
              <Input id="nu-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Jane Doe" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nu-email">Email</Label>
              <Input id="nu-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane.doe@company.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="nu-role">Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                  <SelectTrigger id="nu-role"><SelectValue placeholder="Select a role" /></SelectTrigger>
                  <SelectContent>
                    {canonicalRoles.map((r) => (<SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="nu-dept">Department</Label>
                <Input id="nu-dept" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} placeholder="e.g. Procurement" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={createUser.isPending}>{createUser.isPending ? 'Adding…' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit role */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Role{editUser ? ` — ${editUser.name}` : ''}</DialogTitle></DialogHeader>
          <div className="space-y-1">
            <Label>Role</Label>
            <Select value={editRole} onValueChange={setEditRole}>
              <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
              <SelectContent>
                {canonicalRoles.map((r) => (<SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleSaveRole} disabled={updateUser.isPending || !editRole}>{updateUser.isPending ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
