// Standardised source-connector ports.
//
// The platform reads upstream business objects (requests, orders, invoices,
// contracts, suppliers, tickets, risk records, …) through a single, generic
// interface. The default implementation reads the platform's **own store** —
// the system of record for this release — so no live upstream connection is
// required. A later implementation can call a live upstream system instead;
// because every consumer (front-door checks, risk reads, assistant lookups)
// depends only on these ports, that swap needs no consumer changes.
//
// Nothing here is specific to any organisation or industry. The upstream
// `sourceSystem` is a free-form, deployment-configured identifier, never a
// hard-coded product or sector assumption.

/** Canonical business objects the platform can read from an upstream source. */
export type SourceObject =
  | 'purchase-request'
  | 'purchase-order'
  | 'invoice'
  | 'payment'
  | 'contract'
  | 'supplier'
  | 'catalogue-item'
  | 'support-ticket'
  | 'risk-assessment'
  | 'risk-screening'
  | 'category-taxonomy'
  | 'form-submission';

/** Whether a record came from a local shadow store or a live upstream call. */
export type SourceMode = 'shadow' | 'live';

/** Where and when a record was retrieved — lets consumers reason about freshness. */
export interface SourceMeta {
  /** Deployment-configured identifier of the upstream system of record. */
  sourceSystem: string;
  object: SourceObject;
  mode: SourceMode;
  /** ISO-8601 timestamp the record was retrieved / last refreshed. */
  retrievedAt: string;
  /** Optional window (seconds) a consumer may treat the record as fresh for. */
  freshnessTtlSeconds?: number;
}

/** A retrieved record wrapped with its provenance envelope. */
export interface SourceRecord<T> {
  data: T;
  meta: SourceMeta;
}

/** Source-agnostic list query. Filters are matched by the connector. */
export interface SourceQuery {
  filters?: Record<string, string | number | boolean | undefined>;
  /** Free-text search; connector decides which fields it applies to. */
  search?: string;
  limit?: number;
}

/**
 * Read port for a single object type.
 *
 * Implementations are pure reads — the front door classifies, recommends and
 * routes; it does not write upstream. `get` resolves one record by key; `list`
 * returns many for a query. Both wrap results in {@link SourceRecord} so the
 * provenance/freshness envelope travels with the data.
 */
export interface SourceConnector<TKey, TRecord> {
  readonly object: SourceObject;
  readonly sourceSystem: string;
  readonly mode: SourceMode;
  get(key: TKey): Promise<SourceRecord<TRecord> | null>;
  list(query?: SourceQuery): Promise<SourceRecord<TRecord>[]>;
}

/** Build a {@link SourceMeta} envelope, stamping the retrieval time. */
export function sourceMeta(
  object: SourceObject,
  sourceSystem: string,
  mode: SourceMode,
  freshnessTtlSeconds?: number,
): SourceMeta {
  return {
    object,
    sourceSystem,
    mode,
    retrievedAt: new Date().toISOString(),
    freshnessTtlSeconds,
  };
}

/** Wrap a value (or null) in a {@link SourceRecord} with a fresh envelope. */
export function wrap<T>(
  data: T,
  object: SourceObject,
  sourceSystem: string,
  mode: SourceMode,
  freshnessTtlSeconds?: number,
): SourceRecord<T> {
  return { data, meta: sourceMeta(object, sourceSystem, mode, freshnessTtlSeconds) };
}
