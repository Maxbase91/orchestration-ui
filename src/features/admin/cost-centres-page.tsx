// Admin — cost centre reference data. These are the accounts a request can be
// charged to; the governed checkout rejects anything that is not an active row
// here, so this table is what makes that check enforceable rather than a
// non-empty-string test.
//
// There is deliberately no delete. Requests, requisitions and purchase orders
// store the code, not a foreign key, so removing a row would leave historic
// records pointing at an account nobody can resolve. Deactivating keeps the
// label readable and takes it out of every picker, which is what "retiring a
// cost centre" actually means.

import { useState } from 'react';
import { Loader2, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  useCostCentres, useUpsertCostCentre,
} from '@/lib/db/hooks/use-cost-centres';
import type { CostCentre } from '@/lib/db/cost-centres';

type EditForm = Omit<CostCentre, 'sortOrder'>;

const EMPTY_FORM: EditForm = { id: '', label: '', description: '', owner: '', active: true };

export function CostCentresPage() {
  const { data: costCentres = [], isLoading } = useCostCentres();
  const upsert = useUpsertCostCentre();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<EditForm>(EMPTY_FORM);
  const [isNew, setIsNew] = useState(false);

  function openNew() {
    setForm(EMPTY_FORM);
    setIsNew(true);
    setDialogOpen(true);
  }

  function openEdit(centre: CostCentre) {
    setForm({ id: centre.id, label: centre.label, description: centre.description, owner: centre.owner, active: centre.active });
    setIsNew(false);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.id.trim()) { toast.error('A code is required'); return; }
    if (!form.label.trim()) { toast.error('A label is required'); return; }
    if (isNew && costCentres.some((centre) => centre.id === form.id)) {
      toast.error(`${form.id} already exists`);
      return;
    }
    const existing = costCentres.find((centre) => centre.id === form.id);
    try {
      // Edits keep their position; a new centre appends at the end.
      await upsert.mutateAsync({ ...form, sortOrder: existing?.sortOrder ?? costCentres.length });
      toast.success(`Cost centre "${form.id}" saved`);
      setDialogOpen(false);
    } catch (error) {
      toast.error(`Could not save: ${error instanceof Error ? error.message : 'please try again.'}`);
    }
  }

  type Row = CostCentre & Record<string, unknown>;

  const columns: Column<Row>[] = [
    { key: 'id', label: 'Code', render: (r) => <span className="font-mono text-xs">{r.id as string}</span> },
    { key: 'label', label: 'Label', render: (r) => <span className="font-medium">{r.label as string}</span> },
    { key: 'owner', label: 'Budget owner', render: (r) => <span className="text-sm text-muted-foreground">{(r.owner as string) || '—'}</span> },
    { key: 'description', label: 'Description', render: (r) => <span className="max-w-xs truncate text-sm text-muted-foreground">{(r.description as string) || '—'}</span> },
    {
      key: 'active', label: 'Status',
      render: (r) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${r.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {r.active ? 'Active' : 'Retired'}
        </span>
      ),
    },
    {
      key: 'actions', label: '',
      render: (r) => (
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(r as unknown as CostCentre); }}>
          <Pencil className="size-3.5" />
        </Button>
      ),
    },
  ];

  if (isLoading) return (
    <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
      <Loader2 className="size-5 animate-spin" /> <span className="text-sm">Loading cost centres…</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cost Centres"
        subtitle="The accounts a request can be charged to. A retired centre stays readable on historic records but cannot be chosen."
        actions={<Button size="sm" onClick={openNew}><Plus className="mr-1.5 size-4" />Add cost centre</Button>}
      />

      <DataTable columns={columns} data={costCentres as Row[]} searchable searchPlaceholder="Search cost centres…" />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isNew ? 'New cost centre' : 'Edit cost centre'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* The code is what requests store, so it is fixed once it exists —
                changing it would orphan every record already charged to it. */}
            <div className="space-y-1.5">
              <Label htmlFor="cc-id">Code {!isNew && <span className="text-xs text-muted-foreground">(immutable)</span>}</Label>
              <Input
                id="cc-id"
                value={form.id}
                disabled={!isNew}
                onChange={(e) => setForm((p) => ({ ...p, id: e.target.value.toUpperCase().replace(/\s+/g, '-') }))}
                placeholder="e.g. CC-OPS-007"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-label">Label *</Label>
              <Input id="cc-label" value={form.label} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} placeholder="e.g. Operations 7" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-owner">Budget owner</Label>
              <Input id="cc-owner" value={form.owner} onChange={(e) => setForm((p) => ({ ...p, owner: e.target.value }))} placeholder="Who signs off spend against it" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-description">Description</Label>
              <Input id="cc-description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="What it covers" />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label>Active</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  When off, it disappears from every picker and a checkout charging to it is
                  rejected — but historic records still resolve their code to this label.
                </p>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => setForm((p) => ({ ...p, active: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={upsert.isPending}>
              {upsert.isPending ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
