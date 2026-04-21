import { ArrowRight } from 'lucide-react';
import { useDatabaseAdminStore } from '@/stores/database-admin-store';
import type { EntityKey, EntityRecordMap } from '@/stores/database-admin-store';
import { relationships } from '../relationships';
import { FkLink } from './fk-link';
import { getDisplayLabel } from '../entity-configs';

interface RelatedItemsPanelProps<K extends EntityKey> {
  entity: K;
  record: EntityRecordMap[K];
  onNavigate: (entity: EntityKey, id: string) => void;
}

export function RelatedItemsPanel<K extends EntityKey>({
  entity,
  record,
  onNavigate,
}: RelatedItemsPanelProps<K>) {
  const store = useDatabaseAdminStore();
  const rel = relationships[entity];
  const recordAny = record as unknown as Record<string, unknown>;
  const recordId = (record as { id: string }).id;

  const outgoing = rel.outgoing
    .map((r) => {
      const fkValue = recordAny[r.via] as string | undefined;
      if (!fkValue) return null;
      const target = (store[r.to] as unknown as { id: string }[]).find(
        (t) => t.id === fkValue,
      );
      return { relation: r, targetId: fkValue, target };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const incoming = rel.incoming.map((r) => {
    const matches = (store[r.from] as unknown as Record<string, unknown>[]).filter(
      (item) => item[r.via] === recordId,
    );
    return { relation: r, matches };
  });

  const hasAny =
    outgoing.length > 0 || incoming.some((i) => i.matches.length > 0);

  if (!hasAny) {
    return (
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Related Items
        </h3>
        <p className="text-xs text-muted-foreground italic">
          No linked records found for this entity.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Related Items
      </h3>
      <div className="space-y-4">
        {outgoing.length > 0 && (
          <div>
            <p className="mb-1.5 text-[11px] font-medium text-gray-600">Links to</p>
            <div className="space-y-1.5">
              {outgoing.map((o) => (
                <div key={`${o.relation.to}-${o.targetId}`} className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                  <span className="text-xs text-gray-600">{o.relation.label}</span>
                  <FkLink
                    entity={o.relation.to}
                    id={o.targetId}
                    label={o.target ? getDisplayLabel(o.relation.to, o.target as unknown as EntityRecordMap[EntityKey]) : o.targetId}
                    onNavigate={onNavigate}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {incoming
          .filter((i) => i.matches.length > 0)
          .map((i) => (
            <div key={`${i.relation.from}-${i.relation.via}`}>
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-gray-600">
                <ArrowRight className="size-3" />
                {i.relation.label} ({i.matches.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {i.matches.map((m) => {
                  const id = (m as { id: string }).id;
                  return (
                    <FkLink
                      key={id}
                      entity={i.relation.from}
                      id={id}
                      label={getDisplayLabel(i.relation.from, m as unknown as EntityRecordMap[EntityKey])}
                      onNavigate={onNavigate}
                    />
                  );
                })}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
