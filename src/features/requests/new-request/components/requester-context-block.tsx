import { useState } from 'react';
import { MapPin, UserRound, Pencil, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUserLookup, useUsers } from '@/lib/db/hooks/use-users';
import { UserAutocomplete } from './user-autocomplete';

interface RequesterContextBlockProps {
  requestorId: string;
  /** Auto-derived requester country (read-only). */
  requesterCountry?: string;
  beneficiaryId?: string;
  beneficiaryName?: string;
  onUpdate: (patch: Record<string, unknown>) => void;
}

/**
 * Establishes the universal "who / where" context for a request, before the
 * path-specific capture. Requester location is auto-derived from the requestor's
 * profile and read-only. The beneficiary defaults to the requestor ("self") and
 * is never asked in the conversation — a type-ahead lets the user switch it to
 * someone else. Rendered once in the wizard shell so all paths inherit it.
 */
export function RequesterContextBlock({
  requestorId,
  requesterCountry,
  beneficiaryId,
  beneficiaryName,
  onUpdate,
}: RequesterContextBlockProps) {
  useUsers();
  const lookupUser = useUserLookup();
  const [changing, setChanging] = useState(false);

  const requestor = lookupUser(requestorId);
  const country = requesterCountry || requestor?.country;
  const isSelf = !beneficiaryId || beneficiaryId === requestorId;
  const beneficiaryLabel = isSelf ? `${requestor?.name ?? 'You'} (you)` : (beneficiaryName ?? 'Someone else');

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      </div>
    </div>
  );
}
