import { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { SearchInput } from '@/components/shared/search-input';
import { FilterBar, type FilterConfig } from '@/components/shared/filter-bar';
import { ViewToggle } from '@/components/shared/view-toggle';
import { suppliers } from '@/data/suppliers';
import { SupplierCard } from './components/supplier-card';
import { SupplierTable } from './components/supplier-table';

const views = [
  { id: 'grid', label: 'Card Grid', icon: 'grid' },
  { id: 'table', label: 'Table', icon: 'table' },
];

const filterConfigs: FilterConfig[] = [
  {
    key: 'riskRating',
    label: 'Risk Rating',
    type: 'select',
    options: [
      { label: 'Low', value: 'low' },
      { label: 'Medium', value: 'medium' },
      { label: 'High', value: 'high' },
      { label: 'Critical', value: 'critical' },
    ],
  },
  {
    key: 'contractStatus',
    label: 'Contract Status',
    type: 'select',
    options: [
      { label: 'Active', value: 'active' },
      { label: 'Expired', value: 'expired' },
      { label: 'None', value: 'none' },
    ],
  },
  {
    key: 'onboardingStatus',
    label: 'Onboarding',
    type: 'select',
    options: [
      { label: 'Completed', value: 'completed' },
      { label: 'In Progress', value: 'in-progress' },
      { label: 'Not Started', value: 'not-started' },
    ],
  },
  {
    key: 'tier',
    label: 'Tier',
    type: 'select',
    options: [
      { label: 'Tier 1', value: '1' },
      { label: 'Tier 2', value: '2' },
      { label: 'Tier 3', value: '3' },
    ],
  },
  {
    key: 'country',
    label: 'Country',
    type: 'select',
    options: Array.from(new Set(suppliers.map((s) => s.country)))
      .sort()
      .map((c) => ({ label: c, value: c })),
  },
];

export function SupplierDirectoryPage() {
  const [view, setView] = useState('grid');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[]>>({});

  const filtered = useMemo(() => {
    let result = suppliers;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.country.toLowerCase().includes(q) ||
          s.categories.some((c) => c.toLowerCase().includes(q))
      );
    }

    const risk = filters.riskRating;
    if (risk && typeof risk === 'string') {
      result = result.filter((s) => s.riskRating === risk);
    }

    const contractStatus = filters.contractStatus;
    if (contractStatus && typeof contractStatus === 'string') {
      if (contractStatus === 'active') result = result.filter((s) => s.activeContracts > 0);
      else if (contractStatus === 'none') result = result.filter((s) => s.activeContracts === 0);
    }

    const onboarding = filters.onboardingStatus;
    if (onboarding && typeof onboarding === 'string') {
      result = result.filter((s) => s.onboardingStatus === onboarding);
    }

    const tier = filters.tier;
    if (tier && typeof tier === 'string') {
      result = result.filter((s) => s.tier === Number(tier));
    }

    const country = filters.country;
    if (country && typeof country === 'string') {
      result = result.filter((s) => s.country === country);
    }

    return result;
  }, [search, filters]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Supplier Directory"
        subtitle={`${filtered.length} suppliers`}
        actions={
          <Button>
            <Plus className="size-4" />
            Add Supplier
          </Button>
        }
      />

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search by name, country, or category..."
        className="max-w-md"
      />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <FilterBar
          filters={filterConfigs}
          activeFilters={filters}
          onFilterChange={(key, val) => setFilters((prev) => ({ ...prev, [key]: val }))}
          onClear={() => setFilters({})}
        />
        <ViewToggle views={views} activeView={view} onChange={setView} />
      </div>

      {view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((s) => (
            <SupplierCard key={s.id} supplier={s} />
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
              No suppliers match your filters.
            </p>
          )}
        </div>
      ) : (
        <SupplierTable suppliers={filtered} />
      )}
    </div>
  );
}
