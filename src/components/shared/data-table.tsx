// Generic client-side data table: column config with custom cell renderers,
// optional text search across all columns, and click-to-sort. All filtering/
// sorting happens in memory — fine for the list sizes this platform serves.
//
// Three things every table in the product inherits from here, each an audit
// finding this component is the single place to fix:
//
//   WIDTHS. Columns had no declared width, so every table re-laid-out when data
//   arrived and again whenever a filter changed the longest cell. A `width` on a
//   column now emits a <colgroup> and switches the table to `table-fixed`, so
//   the geometry is known before the rows are.
//
//   FIGURES. 65 files format money or quantities and five used tabular
//   numerals, so no money column in the product lined up. A `numeric` column
//   gets tabular figures and right alignment.
//
//   KEYBOARD. Sortable headers were a click handler on a <th>: not focusable,
//   not operable by keyboard, and with no `aria-sort` for a screen reader to
//   announce. They are real buttons now.
import { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { SearchInput } from './search-input';

interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
  className?: string;
  /**
   * A CSS width — `'120px'`, `'20%'`, `'12ch'`.
   *
   * Declaring ANY column's width puts the whole table into `table-fixed`, so
   * widths stop being derived from content and the layout no longer shifts when
   * the data lands. Columns without one share what is left.
   */
  width?: string;
  /**
   * Money, counts, dates — anything read down the column rather than across.
   *
   * Applies tabular figures so digits occupy equal width, and right-aligns, so
   * the units line up. Without it a proportional font makes every figure ragged.
   */
  numeric?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
  emptyMessage = 'No data found.',
  searchable = false,
  searchPlaceholder = 'Search...',
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const hasWidths = columns.some((col) => col.width);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((item) =>
      columns.some((col) => {
        const val = item[col.key];
        return val !== undefined && val !== null && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, search, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      // Nulls always sort last regardless of direction; numeric-aware
      // localeCompare gives one comparator for both text and number columns.
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  return (
    <div className="space-y-3">
      {searchable && (
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={searchPlaceholder}
          className="max-w-xs"
        />
      )}
      <Table className={cn(hasWidths && 'table-fixed')}>
        {/* Declared once, before any row renders — which is what stops the
            shift. Columns with no width share the remainder. */}
        {hasWidths && (
          <colgroup>
            {columns.map((col) => (
              <col key={col.key} style={col.width ? { width: col.width } : undefined} />
            ))}
          </colgroup>
        )}
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(col.numeric && 'text-right tabular-nums', col.className)}
                // Announced by a screen reader, and the only way a sorted column
                // is discoverable without seeing the arrow.
                aria-sort={
                  col.sortable && sortKey === col.key
                    ? (sortDir === 'asc' ? 'ascending' : 'descending')
                    : col.sortable ? 'none' : undefined
                }
              >
                {col.sortable ? (
                  <button
                    type="button"
                    onClick={() => handleSort(col.key)}
                    className={cn(
                      'inline-flex items-center gap-1 select-none rounded-sm',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-solid',
                      col.numeric && 'flex-row-reverse',
                    )}
                  >
                    {col.label}
                    {sortKey === col.key ? (
                      sortDir === 'asc'
                        ? <ArrowUp className="size-3.5" aria-hidden="true" />
                        : <ArrowDown className="size-3.5" aria-hidden="true" />
                    ) : (
                      <ArrowUpDown className="size-3.5 opacity-40" aria-hidden="true" />
                    )}
                  </button>
                ) : (
                  col.label
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((item, rowIndex) => (
              <TableRow
                key={rowIndex}
                className={cn(onRowClick && 'cursor-pointer')}
                onClick={() => onRowClick?.(item)}
                // A clickable row is an interactive element, so it has to be
                // reachable and operable without a mouse. `role="button"` on a
                // <tr> is a compromise — the ideal is a link in the first cell,
                // which is a per-caller change — but it is the difference
                // between "awkward for a keyboard user" and "impossible".
                {...(onRowClick && {
                  tabIndex: 0,
                  role: 'button' as const,
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onRowClick(item);
                    }
                  },
                })}
              >
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={cn(col.numeric && 'text-right tabular-nums', col.className)}
                  >
                    {col.render ? col.render(item) : (item[col.key] as React.ReactNode)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export type { Column };
