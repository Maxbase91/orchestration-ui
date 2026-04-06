import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface Criterion {
  id: string;
  name: string;
  weight: number;
}

interface SupplierScore {
  supplierId: string;
  supplierName: string;
  scores: Record<string, number>;
  shortlisted: boolean;
}

interface ScoringMatrixProps {
  criteria: Criterion[];
  suppliers: SupplierScore[];
  onScoreChange?: (supplierId: string, criterionId: string, score: number) => void;
  onShortlistToggle?: (supplierId: string) => void;
}

function calcWeightedTotal(scores: Record<string, number>, criteria: Criterion[]): number {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const c of criteria) {
    const score = scores[c.id] ?? 0;
    weightedSum += score * c.weight;
    totalWeight += c.weight;
  }
  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0;
}

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
                  <th key={s.supplierId} className="py-2 px-3 text-center font-medium min-w-[120px]">
                    {s.supplierName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {criteria.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="py-2 pr-4 font-medium">{c.name}</td>
                  <td className="py-2 px-2 text-center text-muted-foreground">{c.weight}%</td>
                  {suppliers.map((s) => (
                    <td key={s.supplierId} className="py-2 px-3 text-center">
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        className="w-16 mx-auto text-center"
                        value={s.scores[c.id] ?? ''}
                        onChange={(e) => {
                          const val = Math.max(1, Math.min(5, Number(e.target.value)));
                          onScoreChange?.(s.supplierId, c.id, val);
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t-2 font-semibold">
                <td className="py-3 pr-4">Weighted Total</td>
                <td className="py-3 px-2 text-center">100%</td>
                {suppliers.map((s) => (
                  <td key={s.supplierId} className="py-3 px-3 text-center text-lg">
                    {calcWeightedTotal(s.scores, criteria).toFixed(2)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium">Status</td>
                <td />
                {suppliers.map((s) => (
                  <td key={s.supplierId} className="py-2 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => onShortlistToggle?.(s.supplierId)}
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

export { calcWeightedTotal };
export type { Criterion, SupplierScore };
