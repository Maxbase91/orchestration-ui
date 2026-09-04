import { useState } from 'react';
import { MapPin, UserRound, Pencil, RotateCcw, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUserLookup, useUsers } from '@/lib/db/hooks/use-users';
import { UserAutocomplete } from './user-autocomplete';
import { useCostCentres } from '@/lib/db/hooks/use-cost-centres';

interface RequesterContextBlockProps {
  requestorId: string;
  /** Auto-derived requester country (read-only). */
  requesterCountry?: string;
  beneficiaryId?: string;
  beneficiaryName?: string;
  /** Charged-to account, defaulted from the requestor's profile. */
  costCentre?: string;
  /** The profile default, so a change can be reset back to it. */
  profileCostCentre?: string;
  onUpdate: (patch: Record<string, unknown>) => void;
}

/**
 * Establishes the universal "who / where / charged to" context for a request,
 * before the path-specific capture. All three are derived and shown, not asked:
 * requester location is read-only from the profile, the beneficiary defaults to
 * the requestor, and the cost centre defaults to the profile's. Rendered once in
 * the wizard shell so all paths inherit it.
 *
 * The cost centre used to be a form field on two checkouts — a hardcoded
 * dropdown of five invented cost centres in one, free text in the other — while
 * the governed checkout was already falling back to the profile anyway
 * (`input.costCentre ?? input.profile.costCentre`). Asking a requester to
 * retype what the platform already knows, from a list their organisation does
 * not use, is friction and a fabrication at once.
 */
export function RequesterContextBlock({
  requestorId,
  requesterCountry,
  beneficiaryId,
  beneficiaryName,
  costCentre,
  profileCostCentre,
  onUpdate,
}: RequesterContextBlockProps) {
  useUsers();
  const lookupUser = useUserLookup();
  const [changing, setChanging] = useState(false);
  const [editingCostCentre, setEditingCostCentre] = useState(false);
  const { data: allCostCentres = [] } = useCostCentres();
  const costCentres = allCostCentres.filter((centre) => centre.active);
  // Show the account's label, not just its code — "CC-ENG-001" alone tells the
  // requester nothing about what they are charging.
  const effectiveCostCentre = costCentre || profileCostCentre || '';
  const matchedCentre = allCostCentres.find((centre) => centre.id === effectiveCostCentre);
  const costCentreLabel = matchedCentre ? `${matchedCentre.id} · ${matchedCentre.label}` : effectiveCostCentre;

  const requestor = lookupUser(requestorId);
  const country = requesterCountry || requestor?.country;
  const isSelf = !beneficiaryId || beneficiaryId === requestorId;
  const beneficiaryLabel = isSelf ? `${requestor?.name ?? 'You'} (you)` : (beneficiaryName ?? 'Someone else');

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Requester location — read-only, from profile */}
        <div className="flex items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-100">
            <MapPin className="size-3.5 text-[#2D5F8A]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Requesting from</p>
            <p className="text-sm font-medium text-gray-900">
              {country ?? 'Not set'}
              <Badge variant="outline" className="ml-2 text-[9px]">from your profile</Badge>
            </p>
          </div>
        </div>

        {/* Beneficiary — default self, changeable */}
        <div className="flex items-start gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-100">
            <UserRound className="size-3.5 text-[#2D5F8A]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Buying for</p>
            {!changing ? (
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-gray-900">{beneficiaryLabel}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-[11px] text-blue-700"
                  onClick={() => setChanging(true)}
                >
                  <Pencil className="size-3" /> Change
                </Button>
                {!isSelf && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-[11px] text-gray-500"
                    onClick={() =>
                      onUpdate({ beneficiaryId: '', beneficiaryName: '', beneficiaryCountry: '', beneficiaryCountryCode: '' })
                    }
                  >
                    <RotateCcw className="size-3" /> Reset to me
                  </Button>
                )}
              </div>
            ) : (
              <div className="mt-1 space-y-1.5">
                <UserAutocomplete
                  selectedId={isSelf ? undefined : beneficiaryId}
                  excludeIds={[requestorId]}
                  placeholder="Type a colleague's name…"
                  onSelect={(u) => {
                    onUpdate({
                      beneficiaryId: u.id,
                      beneficiaryName: u.name,
                      beneficiaryCountry: u.country ?? '',
                      beneficiaryCountryCode: u.countryCode ?? '',
                    });
                    setChanging(false);
                  }}
                />
                <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[11px] text-gray-500" onClick={() => setChanging(false)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Charged to — derived from the profile, correctable here. */}
        <div className="flex items-start gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-100">
            <Wallet className="size-3.5 text-[#2D5F8A]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Charged to</p>
            {editingCostCentre ? (
              <div className="mt-1 space-y-1.5">
                {/* A picker, not free text: the governed checkout rejects a cost
                    centre that is not an active row, so a typed one could only
                    fail at submit. */}
                <select
                  autoFocus
                  className="h-7 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={costCentre || profileCostCentre || ''}
                  aria-label="Cost centre"
                  onChange={(event) => { onUpdate({ costCentre: event.target.value }); setEditingCostCentre(false); }}
                  onBlur={() => setEditingCostCentre(false)}
                >
                  {!costCentres.some((centre) => centre.id === (costCentre || profileCostCentre)) && <option value="">Select a cost centre…</option>}
                  {costCentres.map((centre) => <option key={centre.id} value={centre.id}>{centre.id} · {centre.label}</option>)}
                </select>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-gray-900">
                  {costCentreLabel || 'Not set on your profile'}
                </p>
                {!costCentre && profileCostCentre && (
                  <Badge variant="outline" className="text-[9px]">from your profile</Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-[11px] text-blue-700"
                  onClick={() => setEditingCostCentre(true)}
                >
                  <Pencil className="size-3" /> Change
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
