// Admin — delivery location reference data. These are the places an order can
// be delivered to, and `evaluateGovernedCheckout` rejects anything that is not
// an active row here.
//
// This table is what makes that check real. It used to validate the chosen
// location against `approvedShipToLocations` on the requester's profile — a
// list nothing ever populated, which the browser supplied itself when no
// profile row existed, so the check approved whatever it was handed.
//
// As with cost centres there is no delete: orders store the id, so a removed
// row would leave historic records pointing at a location nobody can resolve.
// Deactivating takes it out of every picker and keeps the label readable.

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
  useDeliveryLocations, useUpsertDeliveryLocation,
} from '@/lib/db/hooks/use-delivery-locations';
import type { DeliveryLocation } from '@/lib/db/delivery-locations';

type EditForm = Omit<DeliveryLocation, 'sortOrder'>;

const EMPTY_FORM: EditForm = { id: '', label: '', address: '', countryCode: '', active: true };

export function DeliveryLocationsPage() {
  const { data: locations = [], isLoading } = useDeliveryLocations();
  const upsert = useUpsertDeliveryLocation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<EditForm>(EMPTY_FORM);
  const [isNew, setIsNew] = useState(false);

  function openNew() {
    setForm(EMPTY_FORM);
    setIsNew(true);
    setDialogOpen(true);
  }

  function openEdit(location: DeliveryLocation) {
    setForm({ id: location.id, label: location.label, address: location.address, countryCode: location.countryCode, active: location.active });
    setIsNew(false);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.id.trim()) { toast.error('An id is required'); return; }
    if (!form.label.trim()) { toast.error('A label is required'); return; }
    if (isNew && locations.some((location) => location.id === form.id)) {
      toast.error(`${form.id} already exists`);
      return;
    }
    const existing = locations.find((location) => location.id === form.id);
    try {
      await upsert.mutateAsync({ ...form, sortOrder: existing?.sortOrder ?? locations.length });
      toast.success(`Delivery location "${form.label}" saved`);
      setDialogOpen(false);
    } catch (error) {
      toast.error(`Could not save: ${error instanceof Error ? error.message : 'please try again.'}`);
    }
  }

  type Row = DeliveryLocation & Record<string, unknown>;

  const columns: Column<Row>[] = [
    { key: 'id', label: 'ID', render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.id as string}</span> },
    { key: 'label', label: 'Label', render: (r) => <span className="font-medium">{r.label as string}</span> },
    { key: 'address', label: 'Address', render: (r) => <span className="max-w-xs truncate text-sm text-muted-foreground">{(r.address as string) || '—'}</span> },
    { key: 'countryCode', label: 'Country', render: (r) => <span className="text-sm">{(r.countryCode as string) || '—'}</span> },
    {
      key: 'active', label: 'Status',
      render: (r) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${r.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {r.active ? 'Active' : 'Closed'}
        </span>
      ),
    },
    {
      key: 'actions', label: '',
      render: (r) => (
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(r as unknown as DeliveryLocation); }}>
          <Pencil className="size-3.5" />
        </Button>
      ),
    },
  ];

  if (isLoading) return (
    <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
      <Loader2 className="size-5 animate-spin" /> <span className="text-sm">Loading delivery locations…</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delivery Locations"
        subtitle="Where an order can be delivered. A closed location stays readable on historic orders but cannot be chosen."
        actions={<Button size="sm" onClick={openNew}><Plus className="mr-1.5 size-4" />Add location</Button>}
      />

      <DataTable columns={columns} data={locations as Row[]} searchable searchPlaceholder="Search delivery locations…" />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isNew ? 'New delivery location' : 'Edit delivery location'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Orders store the id, so it is fixed once it exists — changing it
                would orphan every order already shipped to it. */}
            <div className="space-y-1.5">
              <Label htmlFor="loc-id">ID {!isNew && <span className="text-xs text-muted-foreground">(immutable)</span>}</Label>
              <Input
                id="loc-id"
                value={form.id}
                disabled={!isNew}
                onChange={(e) => setForm((p) => ({ ...p, id: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                placeholder="e.g. northern-depot"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loc-label">Label *</Label>
              <Input id="loc-label" value={form.label} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} placeholder="e.g. Northern depot" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loc-address">Address</Label>
              <Input id="loc-address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} placeholder="Where deliveries go" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loc-country">Country code</Label>
              <Input
                id="loc-country"
                value={form.countryCode}
                maxLength={2}
                onChange={(e) => setForm((p) => ({ ...p, countryCode: e.target.value.toUpperCase().slice(0, 2) }))}
                placeholder="Two letters, e.g. IE"
              />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label>Active</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  When off, it disappears from every picker and a checkout delivering to it is
                  rejected — but historic orders still resolve their id to this label.
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
