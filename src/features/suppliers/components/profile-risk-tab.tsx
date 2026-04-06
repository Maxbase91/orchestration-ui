import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/status-badge';
import { AISuggestionCard } from '@/components/shared/ai-suggestion-card';
import { formatDate } from '@/lib/format';
import type { Supplier } from '@/data/types';

const tpraIcons = {
  valid: ShieldCheck,
  expiring: ShieldAlert,
  expired: ShieldX,
  'not-assessed': ShieldX,
} as const;

interface ProfileRiskTabProps {
  supplier: Supplier;
}

export function ProfileRiskTab({ supplier }: ProfileRiskTabProps) {
  const TpraIcon = tpraIcons[supplier.tpraStatus];
  const riskSuggestion =
    supplier.riskRating === 'high' || supplier.riskRating === 'critical'
      ? `${supplier.name} is classified as ${supplier.riskRating.toUpperCase()} risk. Consider enhanced due diligence and more frequent monitoring cycles.`
      : supplier.tpraStatus === 'expiring' || supplier.tpraStatus === 'expired'
        ? `The TPRA for ${supplier.name} is ${supplier.tpraStatus}. Schedule a reassessment to maintain compliance.`
        : `${supplier.name} has a stable risk profile. Next assessment recommended before TPRA expiry.`;

  return (
    <div className="space-y-6">
      <AISuggestionCard title="Risk Classification" confidence={0.88}>
        <p>{riskSuggestion}</p>
      </AISuggestionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="py-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Third-Party Risk Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <TpraIcon className="size-6 text-muted-foreground" />
              <div>
                <StatusBadge status={supplier.tpraStatus} />
                {supplier.tpraExpiryDate && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Expires: {formatDate(supplier.tpraExpiryDate)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="py-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Screening Status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={supplier.screeningStatus} />
          </CardContent>
        </Card>
      </div>

      <Card className="py-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Certifications</CardTitle>
        </CardHeader>
        <CardContent>
          {supplier.certifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No certifications on record.</p>
          ) : (
            <div className="space-y-3">
              {supplier.certifications.map((cert) => (
                <div key={cert.name} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{cert.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Expires: {formatDate(cert.expiryDate)}
                    </p>
                  </div>
                  <StatusBadge status={cert.status} size="sm" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
