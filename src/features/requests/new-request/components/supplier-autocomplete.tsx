// Supplier picker for the new-request wizard. Shows risk rating, assessment
// status, contracts and spend at selection time so requesters see problems
// (e.g. an expired assessment) before committing to a supplier, not after
// routing.
import { useState } from 'react';
import { ChevronsUpDown, Building2, ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, UserPlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSuppliers } from '@/lib/db/hooks/use-suppliers';
import { formatCurrency } from '@/lib/format';
import type { Supplier } from '@/data/types';

interface SupplierAutocompleteProps {
  value: string;
  supplierId: string;
  onSelect: (supplier: Supplier) => void;
  /**
   * Create a supplier the directory does not hold.
   *
   * Vendor onboarding is triggered by "a new supplier was selected", and that
   * was inexpressible: this picker only ever offered the directory, so a
   * requester naming an unknown vendor had nowhere to put it and onboarding
   * could never fire. Omit the handler to keep the picker read-only.
   */
  onCreateProspective?: (name: string) => Promise<void> | void;
}

const riskBadgeStyles: Record<string, string> = {
  low: 'bg-ok-soft text-ok',
  medium: 'bg-warn-soft text-warn',
  high: 'bg-stop-soft text-stop',
  critical: 'bg-stop-soft text-stop',
};

const sraLabels: Record<string, string> = {
  valid: 'SRA Valid',
  expiring: 'SRA Expiring',
  expired: 'SRA Expired',
  'not-assessed': 'Not Assessed',
};

export function SupplierAutocomplete({
  value, supplierId, onSelect, onCreateProspective,
}: SupplierAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const { data: suppliers = [] } = useSuppliers();
  const selectedSupplier = suppliers.find((s) => s.id === supplierId);

  const trimmed = query.trim();
  // Offer creation only when the typed name matches nothing. An exact match on
  // an existing supplier must never offer to create a duplicate of it.
  const canCreate =
    Boolean(onCreateProspective) &&
    trimmed.length > 1 &&
    !suppliers.some((s) => s.name.toLowerCase() === trimmed.toLowerCase());

  const handleCreate = async () => {
    if (!onCreateProspective || !trimmed) return;
    setCreating(true);
    try {
      await onCreateProspective(trimmed);
      setOpen(false);
      setQuery('');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            {value || 'Search supplier directory...'}
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Type supplier name..."
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>
                {canCreate ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-card-2 disabled:opacity-50"
                    onClick={() => void handleCreate()}
                    disabled={creating}
                  >
                    <UserPlus className="size-4 text-accent-solid" />
                    <span>
                      Add <strong>{trimmed}</strong> as a new supplier
                      <span className="block text-xs text-ink-3">
                        Creates a prospective record — screening and onboarding follow
                      </span>
                    </span>
                  </button>
                ) : (
                  'No supplier found.'
                )}
              </CommandEmpty>
              <CommandGroup>
                {suppliers.map((supplier) => (
                  <CommandItem
                    key={supplier.id}
                    value={supplier.name}
                    onSelect={() => {
                      onSelect(supplier);
                      setOpen(false);
                    }}
                  >
                    <Building2 className="size-4 text-ink-3" />
                    <div className="flex flex-1 items-center justify-between">
                      <div>
                        <span className="font-medium">{supplier.name}</span>
                        <span className="ml-2 text-xs text-ink-3">{supplier.country}</span>
                      </div>
                      <Badge variant="outline" className={riskBadgeStyles[supplier.riskRating]}>
                        {supplier.riskRating}
                      </Badge>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedSupplier && (
        <div className="rounded-lg border border-line bg-card-2 p-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-ink-3" />
              <span className="text-sm font-semibold">{selectedSupplier.name}</span>
              <Badge variant="outline" className={riskBadgeStyles[selectedSupplier.riskRating]}>
                {selectedSupplier.riskRating} risk
              </Badge>
            </div>
            <span className="text-xs text-ink-3">Tier {selectedSupplier.tier}</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div className="flex items-center gap-1.5">
              {selectedSupplier.activeContracts > 0 ? (
                <ShieldCheck className="size-3.5 text-ok" />
              ) : (
                <ShieldX className="size-3.5 text-ink-3" />
              )}
              <span className="text-ink-2">
                {selectedSupplier.activeContracts > 0
                  ? `${selectedSupplier.activeContracts} active contract(s)`
                  : 'No active contracts'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {selectedSupplier.sraStatus === 'valid' ? (
                <ShieldCheck className="size-3.5 text-ok" />
              ) : selectedSupplier.sraStatus === 'expiring' ? (
                <AlertTriangle className="size-3.5 text-warn" />
              ) : (
                <ShieldAlert className="size-3.5 text-stop" />
              )}
              <span className="text-ink-2">{sraLabels[selectedSupplier.sraStatus]}</span>
            </div>
            <div className="text-ink-2">
              Onboarding: <span className="font-medium">{selectedSupplier.onboardingStatus}</span>
            </div>
            <div className="text-ink-2">
              12m spend: <span className="font-medium">{formatCurrency(selectedSupplier.totalSpend12m)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
