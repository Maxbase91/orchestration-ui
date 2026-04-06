import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/page-header';
import { suppliers } from '@/data/suppliers';
import { cn } from '@/lib/utils';
import { MapPin, Tag } from 'lucide-react';
import type { Supplier } from '@/data/types';

const COLUMNS: { key: Supplier['onboardingStatus']; label: string; color: string }[] = [
  { key: 'not-started', label: 'Not Started', color: 'border-t-gray-400' },
  { key: 'in-progress', label: 'In Progress', color: 'border-t-blue-500' },
  { key: 'completed', label: 'Completed', color: 'border-t-green-500' },
];

function SupplierCard({ supplier, onClick }: { supplier: Supplier; onClick: () => void }) {
  // Simulate days in stage based on onboarding status
  const daysInStage = supplier.onboardingStatus === 'completed' ? 0
    : supplier.onboardingStatus === 'in-progress' ? Math.floor(Math.random() * 30 + 10)
    : Math.floor(Math.random() * 15 + 1);

  return (
    <div
      className={cn(
        'rounded-md border bg-white p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow',
        supplier.riskRating === 'high' && 'border-l-4 border-l-red-400',
        supplier.riskRating === 'critical' && 'border-l-4 border-l-red-600',
      )}
      onClick={onClick}
    >
      <p className="text-sm font-semibold text-gray-900">{supplier.name}</p>
      <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
        <MapPin className="size-3" />
        {supplier.country}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {supplier.categories.slice(0, 2).map((cat) => (
          <span key={cat} className="inline-flex items-center gap-0.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
            <Tag className="size-2.5" />
            {cat}
          </span>
        ))}
        {supplier.categories.length > 2 && (
          <span className="text-[10px] text-muted-foreground">+{supplier.categories.length - 2}</span>
        )}
      </div>
      {daysInStage > 0 && (
        <p className={cn(
          'mt-2 text-xs font-medium',
          daysInStage > 20 ? 'text-red-600' : daysInStage > 10 ? 'text-amber-600' : 'text-gray-500',
        )}>
          {daysInStage} days in stage
        </p>
      )}
    </div>
  );
}

export function OnboardingPipelinePage() {
  const navigate = useNavigate();

  const grouped = useMemo(() => {
    const groups: Record<string, Supplier[]> = {};
    for (const col of COLUMNS) {
      groups[col.key] = suppliers.filter((s) => s.onboardingStatus === col.key);
    }
    return groups;
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Onboarding Pipeline"
        subtitle={`${suppliers.length} suppliers across onboarding stages`}
      />

      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = grouped[col.key] ?? [];
          return (
            <div key={col.key} className={cn('rounded-lg border-t-4 bg-gray-50 p-3', col.color)}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">{col.label}</h3>
                <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-700 shadow-sm">
                  {items.length}
                </span>
              </div>
              <div className="space-y-2">
                {items.map((supplier) => (
                  <SupplierCard
                    key={supplier.id}
                    supplier={supplier}
                    onClick={() => navigate(`/suppliers/${supplier.id}`)}
                  />
                ))}
                {items.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-4">No suppliers</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
