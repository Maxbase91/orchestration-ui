// Factory for own-store connectors.
//
// One factory builds a standards-compliant read connector for any object type
// from the platform's own store. Every object reuses the same query semantics
// (filter / free-text search / limit) and the same provenance envelope, so all
// connectors behave identically and a live upstream swap is a like-for-like
// replacement.

import {
  type SourceConnector,
  type SourceObject,
  type SourceQuery,
  type SourceRecord,
  wrap,
} from '../ports';

export interface OwnStoreConfig<TKey, TRecord> {
  object: SourceObject;
  /** Deployment-configured upstream identifier this store stands in for. */
  sourceSystem: string;
  /** How long a consumer may treat a record as fresh (seconds). */
  freshnessTtlSeconds?: number;
  /** Load every record (the own store is the system of record for this release). */
  loadAll: () => Promise<TRecord[]>;
  /** Optional direct by-key load; falls back to scanning `loadAll` via `identity`. */
  loadOne?: (key: TKey) => Promise<TRecord | null>;
  /** Stable identity of a record, used for the `get` fallback and key matching. */
  identity: (record: TRecord) => string;
  /** Concatenated text a free-text `search` is matched against (case-insensitive). */
  searchText?: (record: TRecord) => string;
  /** Keep a record for a single filter field/value. Defaults to no filtering. */
  matchFilter?: (
    record: TRecord,
    field: string,
    value: string | number | boolean,
  ) => boolean;
}

function applyQuery<TRecord>(
  records: TRecord[],
  query: SourceQuery | undefined,
  config: OwnStoreConfig<unknown, TRecord>,
): TRecord[] {
  let out = records;

  if (query?.filters && config.matchFilter) {
    const entries = Object.entries(query.filters).filter(
      ([, v]) => v !== undefined,
    ) as [string, string | number | boolean][];
    if (entries.length > 0) {
      out = out.filter((r) =>
        entries.every(([field, value]) => config.matchFilter!(r, field, value)),
      );
    }
  }

  if (query?.search && config.searchText) {
    const needle = query.search.trim().toLowerCase();
    if (needle) {
      out = out.filter((r) => config.searchText!(r).toLowerCase().includes(needle));
    }
  }

  if (typeof query?.limit === 'number' && query.limit >= 0) {
    out = out.slice(0, query.limit);
  }

  return out;
}

export function createOwnStoreConnector<TKey, TRecord>(
  config: OwnStoreConfig<TKey, TRecord>,
): SourceConnector<TKey, TRecord> {
  const { object, sourceSystem, freshnessTtlSeconds } = config;
  const cfg = config as OwnStoreConfig<unknown, TRecord>;

  return {
    object,
    sourceSystem,
    mode: 'shadow',

    async get(key: TKey): Promise<SourceRecord<TRecord> | null> {
      let record: TRecord | null = null;
      if (config.loadOne) {
        record = await config.loadOne(key);
      } else {
        const all = await config.loadAll();
        record = all.find((r) => config.identity(r) === String(key)) ?? null;
      }
      return record
        ? wrap(record, object, sourceSystem, 'shadow', freshnessTtlSeconds)
        : null;
    },

    async list(query?: SourceQuery): Promise<SourceRecord<TRecord>[]> {
      const all = await config.loadAll();
      return applyQuery(all, query, cfg).map((r) =>
        wrap(r, object, sourceSystem, 'shadow', freshnessTtlSeconds),
      );
    },
  };
}
