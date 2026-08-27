// Scoring matrix (sourcing): weighted criteria-by-supplier evaluation grid
// with shortlist/eliminate toggles, used by the evaluation centre. Controlled
// component — scores and shortlist state live with the caller.
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface SupplierScore {
  /** The sourcing_responses row id — what the award and the score writes key on. */
  id: string;
  supplierId: string;
  supplierName: string;
  scores: Record<string, number>;
  shortlisted: boolean;
  /** Invitation state; only a 'responded' supplier can be scored or awarded. */
  status: string;
  price?: number;
}

interface ScoringMatrixProps {
  criteria: SourcingCriterion[];
  suppliers: SupplierScore[];
  onScoreChange?: (responseId: string, criterionId: string, score: number) => void;
  onShortlistToggle?: (responseId: string, shortlisted: boolean) => void;
}

// The weighted-average rule lives in lib/procurement/sourcing-award.ts so the
// award action and this grid cannot drift apart on how a score is computed.
import { calcWeightedTotal, criteriaWeightTotal } from '@/lib/procurement/sourcing-award';
import type { SourcingCriterion } from '@/lib/db/sourcing-events';

export function ScoringMatrix({ criteria, suppliers, onScoreChange, onShortlistToggle }: ScoringMatrixProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Scoring Matrix</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-4 text-left font-medium text-muted-foreground">Criteria</th>
                <th className="py-2 px-2 text-center font-medium text-muted-foreground w-16">Weight</th>
                {suppliers.map((s) => (
                  <th key={s.id} className="py-2 px-3 text-center font-medium min-w-[120px]">
                    {s.supplierName}
                    {s.status !== 'responded' && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {s.status === 'declined' ? 'declined' : 'no response yet'}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {criteria.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="py-2 pr-4 font-medium">{c.label}</td>
                  <td className="py-2 px-2 text-center text-muted-foreground">{c.weight}%</td>
                  {suppliers.map((s) => (
                    <td key={s.id} className="py-2 px-3 text-center">
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        // A supplier who has not submitted cannot be ranked or
                        // awarded, so letting them be scored would be a lie.
                        disabled={s.status !== 'responded'}
                        className="w-16 mx-auto text-center"
                        value={s.scores[c.id] ?? ''}
                        onChange={(e) => {
                          // Clamp typed values to the 1–5 scoring scale.
                          const val = Math.max(1, Math.min(5, Number(e.target.value)));
                          onScoreChange?.(s.id, c.id, val);
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t-2 font-semibold">
                <td className="py-3 pr-4">Weighted Total</td>
                {/* Derived, not hardcoded to 100%: events created before the
                    wizard enforced the weight total can have no criteria at all. */}
                <td className="py-3 px-2 text-center">{criteriaWeightTotal(criteria)}%</td>
                {suppliers.map((s) => (
                  <td key={s.id} className="py-3 px-3 text-center text-lg">
                    {calcWeightedTotal(s.scores, criteria).toFixed(2)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium">Status</td>
                <td />
                {suppliers.map((s) => (
                  <td key={s.id} className="py-2 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => onShortlistToggle?.(s.id, !s.shortlisted)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        s.shortlisted
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {s.shortlisted ? 'Shortlisted' : 'Eliminated'}
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export type { SupplierScore };
export type { SourcingCriterion as Criterion };
