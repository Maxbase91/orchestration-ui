import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FilterOption {
  label: string;
  value: string;
}

interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
  type: 'select' | 'multi-select';
}

interface FilterBarProps {
  filters: FilterConfig[];
  activeFilters: Record<string, string | string[]>;
  onFilterChange: (key: string, value: string | string[]) => void;
  onClear: () => void;
}

function countActive(activeFilters: Record<string, string | string[]>): number {
  return Object.values(activeFilters).filter((v) =>
    Array.isArray(v) ? v.length > 0 : v !== '' && v !== undefined
  ).length;
}

export function FilterBar({ filters, activeFilters, onFilterChange, onClear }: FilterBarProps) {
  const activeCount = countActive(activeFilters);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {filters.map((filter) => {
        const currentValue = activeFilters[filter.key];
        const stringValue = Array.isArray(currentValue) ? currentValue[0] ?? '' : currentValue ?? '';

        return (
          <Select
            key={filter.key}
            value={stringValue || undefined}
            onValueChange={(val) => {
              if (filter.type === 'multi-select') {
                const current = Array.isArray(currentValue) ? currentValue : [];
                const updated = current.includes(val)
                  ? current.filter((v) => v !== val)
                  : [...current, val];
                onFilterChange(filter.key, updated);
              } else {
                onFilterChange(filter.key, val);
              }
            }}
          >
            <SelectTrigger size="sm" className="min-w-[120px]">
              <SelectValue placeholder={filter.label} />
            </SelectTrigger>
            <SelectContent>
              {filter.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      })}

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground">
          <X className="size-3.5" />
          Clear ({activeCount})
        </Button>
      )}
    </div>
  );
}

export type { FilterConfig, FilterOption };
