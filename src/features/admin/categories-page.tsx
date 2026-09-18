// Admin — category taxonomy CRUD. Edits the procurement categories that drive
// intake classification, routing rules, and analytics groupings in the front door.

import { createElement, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useProcurementCategories,
  useUpsertProcurementCategory,
  useDeleteProcurementCategory,
} from '@/lib/db/hooks/use-procurement-categories';
import type { ProcurementCategory } from '@/lib/db/procurement-categories';
import { Checkbox } from '@/components/ui/checkbox';
import { useUsers } from '@/lib/db/hooks/use-users';
import { useCategoryManagers, useSetCategoryManagers } from '@/lib/db/hooks/use-category-managers';
import { CATEGORY_ICON_NAMES, resolveCategoryIcon } from '@/data/category-icons';

type EditForm = Omit<ProcurementCategory, 'sortOrder'>;

// A new category is NOT catalogue-eligible until an admin says so — see the
// column comment in schema.sql for why the safe default points this way.
const EMPTY_FORM: EditForm = { id: '', label: '', description: '', icon: 'Package', timelineDays: 5, active: true, catalogueEligible: false };

export function CategoriesPage() {
  const { data: categories = [], isLoading } = useProcurementCategories();
  const upsert = useUpsertProcurementCategory();
  const remove = useDeleteProcurementCategory();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<EditForm>(EMPTY_FORM);
  const [isNew, setIsNew] = useState(false);

  // Who is responsible for demand in each category. Two things read this and
  // nothing could write it: approver derivation, and the validation stage gate
  // — so a category with nobody assigned has no one who can move its requests
  // out of validation.
  const { data: assignments = [] } = useCategoryManagers();
  const { data: users = [] } = useUsers();
  const setManagers = useSetCategoryManagers();
  const [managerDialog, setManagerDialog] = useState<ProcurementCategory | null>(null);
  const [selectedManagers, setSelectedManagers] = useState<string[]>([]);

  // Suppliers cannot own internal demand.
  const assignableUsers = useMemo(
    () => users.filter((user) => user.role !== 'supplier'),
    [users],
  );
  const managersByCategory = useMemo(() => {
    const byId = new Map(users.map((user) => [user.id, user.name]));
    const map = new Map<string, { id: string; name: string }[]>();
    for (const row of assignments) {
      const list = map.get(row.categoryId) ?? [];
      list.push({ id: row.userId, name: byId.get(row.userId) ?? row.userId });
      map.set(row.categoryId, list);
    }
    return map;
  }, [assignments, users]);

  function openManagers(cat: ProcurementCategory) {
    setSelectedManagers((managersByCategory.get(cat.id) ?? []).map((m) => m.id));
    setManagerDialog(cat);
  }

  async function handleSaveManagers() {
    if (!managerDialog) return;
    try {
      await setManagers.mutateAsync({ categoryId: managerDialog.id, userIds: selectedManagers });
      toast.success(
        selectedManagers.length === 0
          ? `"${managerDialog.label}" now has no manager`
          : `${selectedManagers.length} manager${selectedManagers.length > 1 ? 's' : ''} assigned to "${managerDialog.label}"`,
      );
      setManagerDialog(null);
    } catch (e) {
      console.error(e);
      toast.error('Failed to save managers');
    }
  }

  function openNew() {
    setForm({ ...EMPTY_FORM, id: `cat-${Date.now()}` });
    setIsNew(true);
    setDialogOpen(true);
  }

  function openEdit(cat: ProcurementCategory) {
    setForm({ id: cat.id, label: cat.label, description: cat.description, icon: cat.icon ?? 'Package', timelineDays: cat.timelineDays, active: cat.active, catalogueEligible: cat.catalogueEligible });
    setIsNew(false);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.label.trim()) { toast.error('Label is required'); return; }
    const existing = categories.find((c) => c.id === form.id);
    try {
      // The form never edits sortOrder: edits keep their position, new
      // categories append at the end.
      await upsert.mutateAsync({
        ...form,
        sortOrder: existing?.sortOrder ?? categories.length,
      });
      toast.success(`Category "${form.label}" saved`);
      setDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast.error('Failed to save category');
    }
  }

  async function handleDelete(cat: ProcurementCategory) {
    try {
      await remove.mutateAsync(cat.id);
      toast.success(`Category "${cat.label}" deleted`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete category');
    }
  }

  type CatRow = ProcurementCategory & Record<string, unknown>;

  const columns: Column<CatRow>[] = [
    { key: 'id', label: 'ID', render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.id as string}</span> },
    { key: 'label', label: 'Label', render: (r) => <span className="font-medium">{r.label as string}</span> },
    { key: 'description', label: 'Description', render: (r) => <span className="text-sm text-muted-foreground truncate max-w-xs">{r.description as string}</span> },
    { key: 'timelineDays', label: 'Timeline', render: (r) => <span className="text-sm">~{r.timelineDays as number}d</span> },
    {
      key: 'active', label: 'Active',
      render: (r) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${r.active ? 'bg-ok-soft text-ok' : 'bg-idle-soft text-ink-3'}`}>
          {r.active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'catalogueEligible', label: 'Catalogue',
      render: (r) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${r.catalogueEligible ? 'bg-accent-soft text-accent-solid' : 'bg-idle-soft text-ink-3'}`}>
          {r.catalogueEligible ? 'Can fulfil' : 'Not fulfilled'}
        </span>
      ),
    },
    {
      key: 'managers', label: 'Managers',
      render: (r) => {
        const assigned = managersByCategory.get(r.id as string) ?? [];
        if (assigned.length === 0) {
          return (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs font-medium text-warn hover:bg-warn-soft"
              onClick={(e) => { e.stopPropagation(); openManagers(r as unknown as ProcurementCategory); }}
            >
              <AlertTriangle className="size-3.5" />
              No manager
            </button>
          );
        }
        return (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-left text-sm hover:bg-card-2"
            onClick={(e) => { e.stopPropagation(); openManagers(r as unknown as ProcurementCategory); }}
          >
            <Users className="size-3.5 shrink-0 text-muted-foreground" />
            <span>{assigned.map((m) => m.name).join(', ')}</span>
          </button>
        );
      },
    },
    {
      key: 'actions', label: '',
      render: (r) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(r as unknown as ProcurementCategory); }}>
            <Pencil className="size-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="text-stop hover:text-stop" onClick={(e) => { e.stopPropagation(); handleDelete(r as unknown as ProcurementCategory); }}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) return (
    <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
      <Loader2 className="size-5 animate-spin" /> <span className="text-sm">Loading categories…</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Procurement Categories"
        subtitle="Manage the category taxonomy used across intake, routing, and analytics"
        actions={<Button size="sm" onClick={openNew}><Plus className="mr-1.5 size-4" />Add Category</Button>}
      />

      <DataTable columns={columns} data={categories as CatRow[]} searchable searchPlaceholder="Search categories…" />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isNew ? 'New Category' : 'Edit Category'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* The id is the stable key referenced by requests and routing rules —
                slugified on entry and locked once the category exists. */}
            <div className="space-y-1.5">
              <Label>ID {!isNew && <span className="text-muted-foreground text-xs">(immutable)</span>}</Label>
              <Input value={form.id} disabled={!isNew} onChange={(e) => setForm((p) => ({ ...p, id: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} placeholder="e.g. research-services" />
            </div>
            <div className="space-y-1.5">
              <Label>Label *</Label>
              <Input value={form.label} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} placeholder="e.g. Research Services" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Short description" />
            </div>
            <div className="space-y-1.5">
              <Label>Typical Timeline (days)</Label>
              <Input type="number" min={1} value={form.timelineDays} onChange={(e) => setForm((p) => ({ ...p, timelineDays: parseInt(e.target.value) || 5 }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Icon</Label>
              <div className="flex items-center gap-2">
                {createElement(resolveCategoryIcon(form.icon), { className: 'size-4 text-muted-foreground' })}
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={form.icon ?? 'Package'}
                  onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))}
                >
                  {CATEGORY_ICON_NAMES.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={form.active} onCheckedChange={(v) => setForm((p) => ({ ...p, active: v }))} />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label>Fulfilled from the catalogue</Label>
                {/* This is the gate that stops a consulting demand being offered
                    business cards: when off, the intake funnel skips the
                    catalogue stage for this category and says why. */}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  When off, intake skips the catalogue check for this category and goes
                  straight to the contract check.
                </p>
              </div>
              <Switch
                checked={form.catalogueEligible}
                onCheckedChange={(v) => setForm((p) => ({ ...p, catalogueEligible: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>
              {upsert.isPending ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category managers. Several per category is normal — when more than one
          is assigned the approval step becomes role-open and names them all,
          rather than picking one arbitrarily. */}
      <Dialog open={managerDialog !== null} onOpenChange={(open) => { if (!open) setManagerDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Managers — {managerDialog?.label}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Whoever is responsible for demand in this category. They approve its requests
            and are the only people who can move one out of validation.
          </p>
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-1">
            {assignableUsers.map((user) => {
              const checked = selectedManagers.includes(user.id);
              return (
                <label
                  key={user.id}
                  className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 hover:bg-card-2"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => setSelectedManagers((prev) => (
                      value === true ? [...prev, user.id] : prev.filter((id) => id !== user.id)
                    ))}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{user.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {user.role} · {user.department}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          {selectedManagers.length === 0 && (
            <p className="flex items-start gap-1.5 text-xs text-warn">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              With no manager, nobody but an admin can move this category's requests out
              of validation, and its approvals fall back to any holder of the role.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setManagerDialog(null)}>Cancel</Button>
            <Button onClick={handleSaveManagers} disabled={setManagers.isPending}>
              {setManagers.isPending ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
              Save managers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
