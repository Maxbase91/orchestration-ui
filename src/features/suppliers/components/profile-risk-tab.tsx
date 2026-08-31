// Risk tab on the supplier profile: assessment status, screening result and
// certifications, headed by deterministic guidance derived from the record
// (not an LLM call).
import { useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, Check, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/status-badge';
import { AISuggestionCard } from '@/components/shared/ai-suggestion-card';
import { formatDate } from '@/lib/format';
import type { Supplier } from '@/data/types';
import { useAuthStore } from '@/stores/auth-store';
import { useUpdateSupplier } from '@/lib/db/hooks/use-suppliers';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const sraIcons = {
  valid: ShieldCheck,
  expiring: ShieldAlert,
  expired: ShieldX,
  'not-assessed': ShieldX,
} as const;

interface ProfileRiskTabProps {
  supplier: Supplier;
}

export function ProfileRiskTab({ supplier }: ProfileRiskTabProps) {
  const currentRole = useAuthStore((state) => state.currentRole);
  const updateSupplier = useUpdateSupplier();
  const [decisionReason, setDecisionReason] = useState('');
  const SraIcon = sraIcons[supplier.sraStatus];
  // Guidance priority: rating severity first, then assessment currency, else
  // steady state — the most urgent issue wins the headline.
  const riskSuggestion =
    supplier.riskRating === 'high' || supplier.riskRating === 'critical'
      ? `${supplier.name} is classified as ${supplier.riskRating.toUpperCase()} risk. Consider enhanced due diligence and more frequent monitoring cycles.`
      : supplier.sraStatus === 'expiring' || supplier.sraStatus === 'expired'
        ? `The SRA for ${supplier.name} is ${supplier.sraStatus}. Schedule a reassessment to maintain compliance.`
        : `${supplier.name} has a stable risk profile. Next assessment recommended before SRA expiry.`;

  const canDecideRisk = currentRole === 'vendor-manager' || currentRole === 'admin';
  const recordRiskDecision = async (decision: 'approve' | 'refer-back') => {
    if (!decisionReason.trim()) {
      toast.error('Add a rationale before recording the risk decision.');
      return;
    }
    try {
      await updateSupplier.mutateAsync({
        id: supplier.id,
        patch: decision === 'approve'
          ? { sraStatus: 'valid', screeningStatus: 'clear', onboardingStatus: 'in-progress' }
          : { screeningStatus: 'flagged', onboardingStatus: 'in-progress' },
      });
      toast.success(decision === 'approve' ? 'Risk decision recorded.' : 'Supplier referred back for remediation.');
      setDecisionReason('');
    } catch {
      toast.error('Could not save the risk decision. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <AISuggestionCard title="Risk Classification">
        <p>{riskSuggestion}</p>
      </AISuggestionCard>

      {canDecideRisk && (
        <Card className="border-amber-200 bg-amber-50/40" data-testid="risk-decision-form">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Record risk decision</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">This form is available because your role owns supplier risk decisions. A rationale is required before the decision is saved.</p>
            <Textarea aria-label="Risk decision rationale" value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} placeholder="Explain the evidence and any follow-up required…" />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void recordRiskDecision('approve')} disabled={updateSupplier.isPending}><Check className="size-3.5" /> Approve risk</Button>
              <Button size="sm" variant="outline" onClick={() => void recordRiskDecision('refer-back')} disabled={updateSupplier.isPending}><RotateCcw className="size-3.5" /> Refer back</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="py-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Supplier Risk Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <SraIcon className="size-6 text-muted-foreground" />
              <div>
                <StatusBadge status={supplier.sraStatus} />
                {supplier.sraExpiryDate && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Expires: {formatDate(supplier.sraExpiryDate)}
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
