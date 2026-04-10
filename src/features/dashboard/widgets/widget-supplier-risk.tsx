import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { suppliers } from '@/data/suppliers';
import { cn } from '@/lib/utils';

const riskColors: Record<string, string> = {
  critical: 'text-red-600 bg-red-50',
  high: 'text-orange-600 bg-orange-50',
};

export function WidgetSupplierRisk() {
  const navigate = useNavigate();

  const atRisk = useMemo(
    () =>
      suppliers
        .filter((s) => s.riskRating === 'high' || s.riskRating === 'critical' || s.sraStatus === 'expired')
        .slice(0, 5),
    [],
  );

  if (atRisk.length === 0) {
    return <p className="text-sm text-muted-foreground">No supplier risk alerts.</p>;
  }

  return (
    <div className="space-y-1">
      {atRisk.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => navigate(`/suppliers/${s.id}`)}
          className="flex items-center justify-between w-full text-left px-2 py-1.5 rounded hover:bg-muted/50 transition-colors text-sm"
        >
          <div className="flex items-center gap-2 min-w-0">
            <ShieldAlert className="size-3.5 shrink-0 text-red-500" />
            <span className="truncate">{s.name}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded', riskColors[s.riskRating] ?? 'text-muted-foreground bg-muted')}>
              {s.riskRating}
            </span>
            {s.sraStatus === 'expired' && (
              <span className="text-xs text-red-600">SRA expired</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
