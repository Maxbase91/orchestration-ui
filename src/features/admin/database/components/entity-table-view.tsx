import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/components/shared/data-table';
import { useDatabaseAdminStore, entityLabels } from '@/stores/database-admin-store';
import type { EntityKey, EntityRecordMap } from '@/stores/database-admin-store';
import { EntityEditSheet } from './entity-edit-sheet';
import type { EntityConfig } from '../entity-configs/types';

interface EntityTableViewProps<K extends EntityKey> {
  config: EntityConfig<K>;
  onNavigate: (entity: EntityKey, id: string) => void;
  externalOpenId?: string;
  onExternalHandled?: () => void;
}

export function EntityTableView<K extends EntityKey>({
  config,
  onNavigate,
  externalOpenId,
  onExternalHandled,
}: EntityTableViewProps<K>) {
  const data = useDatabaseAdminStore((s) => s[config.key]) as EntityRecordMap[K][];

  const [sheetMode, setSheetMode] = useState<'edit' | 'create' | null>(null);
  const [activeRecord, setActiveRecord] = useState<EntityRecordMap[K] | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!externalOpenId) return;
    const target = (data as EntityRecordMap[K][]).find(
      (r) => (r as { id: string }).id === externalOpenId,
    );
    if (target) {
      setActiveRecord(target);
      setSheetMode('edit');
    }
    onExternalHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalOpenId]);

  const filtered = useMemo(() => {
    if (!config.filters || config.filters.length === 0) return data;
    return data.filter((record) => {
      for (const filter of config.filters!) {
        const v = filterValues[filter.key];
        if (v && v !== 'all' && !filter.predicate(record, v)) return false;
      }
      return true;
    });
  }, [data, filterValues, config.filters]);

  const columnsWithActions = useMemo(() => {
    return [
      ...config.columns,
      {
        key: '__actions',
        label: 'Actions',
        render: (item: EntityRecordMap[K] & Record<string, unknown>) => (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                setActiveRecord(item);
                setSheetMode('edit');
              }}
            >
              Edit
            </Button>
          </div>
        ),
      },
    ];
  }, [config.columns]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(config.filters ?? []).map((filter) => (
            <Select
              key={filter.key}
              value={filterValues[filter.key] ?? 'all'}
              onValueChange={(v) => setFilterValues((prev) => ({ ...prev, [filter.key]: v }))}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {filter.label.toLowerCase()}</SelectItem>
                {filter.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>
        <Button size="sm" onClick={() => {
          setActiveRecord(null);
          setSheetMode('create');
        }}>
          <Plus className="mr-1.5 size-4" />
          New {entityLabels[config.key].singular}
        </Button>
      </div>

      <Card className="p-4">
        <DataTable
          columns={columnsWithActions}
          data={filtered as (EntityRecordMap[K] & Record<string, unknown>)[]}
          searchable
          searchPlaceholder={`Search ${entityLabels[config.key].plural.toLowerCase()}...`}
          onRowClick={(item) => {
            setActiveRecord(item as EntityRecordMap[K]);
            setSheetMode('edit');
          }}
        />
      </Card>

      <EntityEditSheet
        open={sheetMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSheetMode(null);
            setActiveRecord(null);
          }
        }}
        mode={sheetMode ?? 'edit'}
        config={config}
        record={activeRecord}
        onNavigate={onNavigate}
      />
    </div>
  );
}
