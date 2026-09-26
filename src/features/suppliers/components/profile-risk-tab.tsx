// Risk tab on the supplier profile: assessment status, screening result and
// certifications, headed by deterministic guidance derived from the record
// (not an LLM call) — and, for the roles that own supplier risk, the two
// records that may change them, each on its evidence (supplier-evidence.ts).
import { useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, ScanSearch, Link2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/status-badge';
import { AISuggestionCard } from '@/components/shared/ai-suggestion-card';
import { formatDate } from '@/lib/format';
import type { Supplier } from '@/data/types';
import { useAuthStore } from '@/stores/auth-store';
import { useUpdateSupplier } from '@/lib/db/hooks/use-suppliers';
import { useRiskAssessments } from '@/lib/db/hooks/use-risk-assessments';
import { useCreateAuditEntry } from '@/lib/db/hooks/use-audit-entries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { isoToday } from '@/lib/procurement/contract-status';
import {
  linkableAssessments, planAssessmentLink, planScreeningRecord, type EvidenceAudit,
} from '@/lib/procurement/supplier-evidence';
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
  const currentUser = useAuthStore((state) => state.currentUser);
  const updateSupplier = useUpdateSupplier();
  const createAudit = useCreateAuditEntry();
  const { data: assessments = [] } = useRiskAssessments();
  const SraIcon = sraIcons[supplier.sraStatus];
  // Guidance priority: rating severity first, then assessment currency, else
  // steady state — the most urgent issue wins the headline.
  const riskSuggestion =
    supplier.riskRating === 'high' || supplier.riskRating === 'critical'
      ? `${supplier.name} is classified as ${supplier.riskRating.toUpperCase()} risk. Consider enhanced due diligence and more frequent monitoring cycles.`
      : supplier.sraStatus === 'expiring' || supplier.sraStatus === 'expired'
        ? `The SRA for ${supplier.name} is ${supplier.sraStatus}. Schedule a reassessment to maintain compliance.`
        : `${supplier.name} has a stable risk profile. Next assessment recommended before SRA expiry.`;

  // "Approve risk" used to write screening clear and the SRA valid on nothing
  // but a rationale it then threw away, and reset a completed supplier's
  // onboarding. Each write now stands on its evidence and is audited; neither
  // touches onboarding.
  const canRecordEvidence = currentRole === 'vendor-manager' || currentRole === 'admin';
  const today = isoToday();
  const [screeningResult, setScreeningResult] = useState<'clear' | 'flagged'>('clear');
  const [screeningReference, setScreeningReference] = useState('');
  const [screeningDate, setScreeningDate] = useState(today);
  const [screeningNotes, setScreeningNotes] = useState('');
  const candidates = linkableAssessments(assessments, supplier.id, today);
  const [assessmentId, setAssessmentId] = useState('');

  const save = async (patch: Partial<Supplier>, audit: EvidenceAudit, done: string) => {
    try {
      await updateSupplier.mutateAsync({ id: supplier.id, patch });
      await createAudit.mutateAsync({
        timestamp: new Date().toISOString(), userId: currentUser.id, userName: currentUser.name,
        action: audit.action, objectType: 'supplier', objectId: supplier.id, detail: audit.detail, type: 'human',
      });
      toast.success(done);
      return true;
    } catch {
      toast.error('Could not save it. Please try again.');
      return false;
    }
  };

  const recordScreening = async () => {
    const plan = planScreeningRecord(
      { result: screeningResult, reference: screeningReference, performedOn: screeningDate, notes: screeningNotes },
      today,
    );
    if (!plan.ok) { toast.error(plan.error); return; }
    if (await save(plan.patch, plan.audit, `Screening recorded as ${screeningResult}.`)) {
      setScreeningReference('');
      setScreeningNotes('');
    }
  };

  const linkAssessment = async () => {
    const plan = planAssessmentLink(candidates.find((a) => a.id === assessmentId), supplier.id, today);
    if (!plan.ok) { toast.error(plan.error); return; }
    if (await save(plan.patch, plan.audit, 'The SRA now stands on that assessment.')) setAssessmentId('');
  };

  return (
    <div className="space-y-6">
      <AISuggestionCard title="Risk Classification">
        <p>{riskSuggestion}</p>
      </AISuggestionCard>

      {canRecordEvidence && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card data-testid="record-screening">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm"><ScanSearch className="size-4" /> Record screening result</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                The platform does not screen suppliers itself. Record a screening that was performed, with its reference, so the result can be traced.
              </p>
              <fieldset className="flex gap-4 text-sm">
                <legend className="sr-only">Result</legend>
                {(['clear', 'flagged'] as const).map((result) => (
                  <label key={result} className="flex items-center gap-1.5">
                    <input type="radio" name="screening-result" value={result} checked={screeningResult === result}
                      onChange={() => setScreeningResult(result)} />
                    {result === 'clear' ? 'Clear' : 'Flagged'}
                  </label>
                ))}
              </fieldset>
              <div className="space-y-1">
                <Label htmlFor="screening-reference">Reference</Label>
                <Input id="screening-reference" value={screeningReference} onChange={(e) => setScreeningReference(e.target.value)}
                  placeholder="The screening provider and its case or report number" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="screening-date">Performed on</Label>
                <Input id="screening-date" type="date" max={today} value={screeningDate} onChange={(e) => setScreeningDate(e.target.value)} />
              </div>
              <Textarea aria-label="Screening notes" value={screeningNotes} onChange={(e) => setScreeningNotes(e.target.value)}
                placeholder="Anything the result depends on (optional)" />
              <Button size="sm" onClick={() => void recordScreening()} disabled={updateSupplier.isPending || !screeningReference.trim()}>
                Record screening
              </Button>
            </CardContent>
          </Card>

          <Card data-testid="link-assessment">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm"><Link2 className="size-4" /> Link a risk assessment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                The SRA stands on a completed, in-date risk assessment of this supplier; its expiry is the assessment&apos;s own.
              </p>
              {candidates.length === 0 ? (
                <p className="text-sm text-ink-2">
                  No completed, in-date risk assessment of this supplier is in the register. One is completed at a request&apos;s Risk Assessment stage, or recorded in Admin → Database.
                </p>
              ) : (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="sra-assessment">Assessment</Label>
                    <select id="sra-assessment" className="w-full rounded-md border border-line bg-card px-2 py-1.5 text-sm"
                      value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)}>
                      <option value="">Choose an assessment…</option>
                      {candidates.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.id} · {a.title} · {a.riskLevel} risk · valid until {formatDate(a.validUntil)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button size="sm" onClick={() => void linkAssessment()} disabled={updateSupplier.isPending || !assessmentId}>
                    Link assessment
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
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
                {supplier.sraAssessmentId && (
                  <p className="mt-1 text-xs text-muted-foreground">From assessment {supplier.sraAssessmentId}</p>
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
            {supplier.screeningReference && (
              <p className="mt-1 text-xs text-muted-foreground">
                {supplier.screeningReference}{supplier.screeningDate ? ` · performed ${formatDate(supplier.screeningDate)}` : ''}
              </p>
            )}
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
                    <p className="text-sm font-medium text-ink">{cert.name}</p>
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
