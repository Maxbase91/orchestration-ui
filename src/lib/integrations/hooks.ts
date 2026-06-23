// React hooks for reading through source connectors.
//
// Mirrors the `src/lib/db/hooks` conventions (TanStack Query) so connector
// reads cache and refetch like any other data source.

import { useQuery } from '@tanstack/react-query';
import { getConnector } from './registry';
import type { SourceObject, SourceQuery, SourceRecord } from './ports';

const KEYS = {
  get: (object: SourceObject, key: string) =>
    ['source-connector', object, 'get', key] as const,
  list: (object: SourceObject, query?: SourceQuery) =>
    ['source-connector', object, 'list', query ?? null] as const,
};

/** Read one record by key through the connector registered for `object`. */
export function useSourceObject<TRecord>(
  object: SourceObject,
  key: string | undefined,
) {
  return useQuery<SourceRecord<TRecord> | null>({
    queryKey: KEYS.get(object, key ?? ''),
    queryFn: () => {
      const connector = getConnector<string, TRecord>(object);
      if (!connector) return null;
      return connector.get(key!);
    },
    enabled: Boolean(key),
  });
}

/** List records for a query through the connector registered for `object`. */
export function useSourceList<TRecord>(
  object: SourceObject,
  query?: SourceQuery,
) {
  return useQuery<SourceRecord<TRecord>[]>({
    queryKey: KEYS.list(object, query),
    queryFn: () => {
      const connector = getConnector<string, TRecord>(object);
      if (!connector) return [];
      return connector.list(query);
    },
  });
}

/**
 * Like {@link useSourceList} but returns the domain records directly (drops the
 * provenance envelope). Drop-in replacement for a `db/hooks/use-*` list hook —
 * `data` is `TRecord[]`. Shares the query cache with `useSourceList`.
 */
export function useSourceData<TRecord>(
  object: SourceObject,
  query?: SourceQuery,
) {
  return useQuery<SourceRecord<TRecord>[], Error, TRecord[]>({
    queryKey: KEYS.list(object, query),
    queryFn: () => {
      const connector = getConnector<string, TRecord>(object);
      if (!connector) return [];
      return connector.list(query);
    },
    select: (records) => records.map((r) => r.data),
  });
}

/**
 * Like {@link useSourceObject} but returns the domain record directly (or null).
 * Drop-in replacement for a single-record `db/hooks/use-*` hook.
 */
export function useSourceDatum<TRecord>(
  object: SourceObject,
  key: string | undefined,
) {
  return useQuery<SourceRecord<TRecord> | null, Error, TRecord | null>({
    queryKey: KEYS.get(object, key ?? ''),
    queryFn: () => {
      const connector = getConnector<string, TRecord>(object);
      if (!connector) return null;
      return connector.get(key!);
    },
    enabled: Boolean(key),
    select: (record) => record?.data ?? null,
  });
}
