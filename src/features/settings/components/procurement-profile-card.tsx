// The requester's procurement defaults — the record intake reads from.
//
// These stopped being cosmetic when intake started deriving from them: the cost
// centre a request is charged to, the ship-to location a governed checkout
// validates against, and the beneficiary a request is raised for all come from
// here now, rather than being retyped into a form (and, in the cost centre's
// case, picked from a list of five invented values).
//
// So the profile needs somewhere to be seen and corrected. That is this card.
// It writes through `upsertProcurementProfile`; when the table is unreachable
// the form stays usable and says the save failed rather than pretending.
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getProcurementProfile, upsertProcurementProfile } from '@/lib/db/procurement-profiles';
import type { ProcurementProfile } from '@/data/types';
import { useCostCentres } from '@/lib/db/hooks/use-cost-centres';
import { useDeliveryLocations } from '@/lib/db/hooks/use-delivery-locations';

const CURRENCIES = ['EUR', 'USD', 'GBP'];

interface ProcurementProfileCardProps {
  userId: string;
}

export function ProcurementProfileCard({ userId }: ProcurementProfileCardProps) {
  const [profile, setProfile] = useState<ProcurementProfile | null>(null);
  const { data: allCostCentres = [] } = useCostCentres();
  const { data: allLocations = [] } = useDeliveryLocations();
  const costCentres = allCostCentres.filter((centre) => centre.active);
  const locations = allLocations.filter((location) => location.active);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getProcurementProfile(userId)
      .then((stored) => {
        if (cancelled) return;
        setProfile(stored ?? {
          userId,
          defaultCurrency: 'EUR',
          approvedShipToLocations: [],
        });
      })
      .catch(() => {
        // An unreachable profile table must not blank the page; start from an
        // empty profile the requester can fill in.
        if (!cancelled) setProfile({ userId, defaultCurrency: 'EUR', approvedShipToLocations: [] });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  const patch = (updates: Partial<ProcurementProfile>) =>
    setProfile((previous) => (previous ? { ...previous, ...updates } : previous));

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await upsertProcurementProfile(profile);
      toast.success('Procurement defaults saved');
    } catch (error) {
      toast.error(`Could not save: ${error instanceof Error ? error.message : 'please try again.'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !profile) {
    return (
      <Card className="max-w-lg p-6">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading your procurement defaults…
        </p>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg space-y-4 p-6">
      <div>
        <h3 className="text-sm font-medium">Procurement defaults</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Used to pre-fill your requests, so you are not asked for them each time. You can still
          change any of them on an individual request.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="profile-cost-centre">Cost centre</Label>
          {/* Administered reference data, not free text: the governed checkout
              rejects a cost centre that is not an active row, so typing one
              here could set a default that no order could ever use. */}
          <Select value={profile.costCentre ?? ''} onValueChange={(value) => patch({ costCentre: value })}>
            <SelectTrigger id="profile-cost-centre">
              <SelectValue placeholder={costCentres.length === 0 ? 'None configured' : 'Select a cost centre…'} />
            </SelectTrigger>
            <SelectContent>
              {costCentres.map((centre) => (
                <SelectItem key={centre.id} value={centre.id}>{centre.id} · {centre.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-currency">Default currency</Label>
          <Select value={profile.defaultCurrency} onValueChange={(value) => patch({ defaultCurrency: value })}>
            <SelectTrigger id="profile-currency"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-budget-owner">Budget owner</Label>
          <Input
            id="profile-budget-owner"
            value={profile.budgetOwner ?? ''}
            placeholder="Who signs off your spend"
            onChange={(event) => patch({ budgetOwner: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-legal-entity">Legal entity</Label>
          <Input
            id="profile-legal-entity"
            value={profile.legalEntity ?? ''}
            placeholder="The entity you buy on behalf of"
            onChange={(event) => patch({ legalEntity: event.target.value })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="profile-ship-to">Default delivery location</Label>
        <Select
          value={profile.defaultShipToLocationId ?? ''}
          onValueChange={(value) => patch({ defaultShipToLocationId: value })}
          disabled={locations.length === 0}
        >
          <SelectTrigger id="profile-ship-to">
            <SelectValue placeholder={locations.length === 0 ? 'None configured' : 'Select a location…'} />
          </SelectTrigger>
          <SelectContent>
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>{location.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Delivery locations are governance data, not a preference: a governed
            checkout REJECTS a location that is not an active row, so they are
            maintained by an administrator rather than typed here. This list used
            to come from `approvedShipToLocations` on the profile — which nothing
            ever populated, so the control was permanently disabled. */}
        <p className="text-[11px] text-muted-foreground">
          Locations are maintained by your administrator — an order cannot be delivered anywhere
          else.
        </p>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Save defaults
        </Button>
      </div>
    </Card>
  );
}
