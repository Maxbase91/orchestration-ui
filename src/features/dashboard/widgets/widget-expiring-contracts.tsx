// Dashboard widget listing contracts inside the 90-day renewal window —
// enough lead time to act before notice periods lapse. Already-expired
// contracts pass the filter on purpose and are flagged red.
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileWarning } from 'lucide-react';
import { useContracts } from '@/lib/db/hooks/use-contracts';
import { differenceInDays, parseISO } from 'date-fns';

export function WidgetExpiringContracts() {
  const navigate = useNavigate();
  const { data: contracts = [] } = useContracts();

  const expiring = useMemo(() => {
    const now = new Date();
    return contracts
      .filter((c) => {
        const end = parseISO(c.endDate);
        const days = differenceInDays(end, now);
        return days <= 90;
      })
      .map((c) => ({
        ...c,
        daysUntilExpiry: differenceInDays(parseISO(c.endDate), now),
      }))
      // Most urgent first; capped so the widget stays glanceable.
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
      .slice(0, 5);
  }, [contracts]);

  if (expiring.length === 0) {
    return <p className="text-sm text-muted-foreground">No contracts expiring soon.</p>;
  }

  return (
    <div className="space-y-1">
      {expiring.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => navigate(`/contracts/${c.id}`)}
          className="flex items-center justify-between w-full text-left px-2 py-1.5 rounded hover:bg-muted/50 transition-colors text-sm"
        >
          <div className="flex items-center gap-2 min-w-0">
            <FileWarning className={`size-3.5 shrink-0 ${c.daysUntilExpiry <= 0 ? 'text-red-500' : 'text-amber-500'}`} />
            <span className="truncate">{c.title}</span>
          </div>
          <span className={`text-xs font-medium shrink-0 ml-2 ${c.daysUntilExpiry <= 0 ? 'text-red-600' : 'text-amber-600'}`}>
            {c.daysUntilExpiry <= 0 ? 'Expired' : `${c.daysUntilExpiry}d left`}
          </span>
        </button>
      ))}
    </div>
  );
}
