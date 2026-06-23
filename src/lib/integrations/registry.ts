// Connector registry.
//
// Consumers resolve a connector by object type and stay decoupled from which
// implementation is wired in. Swapping the platform's own store for a live
// upstream source is a single re-registration, with no change at the call site.

import type { SourceConnector, SourceObject } from './ports';

const registry = new Map<SourceObject, SourceConnector<unknown, unknown>>();

/** Register (or replace) the connector that serves an object type. */
export function registerConnector<TKey, TRecord>(
  connector: SourceConnector<TKey, TRecord>,
): void {
  registry.set(connector.object, connector as SourceConnector<unknown, unknown>);
}

/** Resolve the connector for an object type, or `null` if none is registered. */
export function getConnector<TKey, TRecord>(
  object: SourceObject,
): SourceConnector<TKey, TRecord> | null {
  return (registry.get(object) as SourceConnector<TKey, TRecord> | undefined) ?? null;
}

/** Resolve the connector for an object type, throwing if none is registered. */
export function requireConnector<TKey, TRecord>(
  object: SourceObject,
): SourceConnector<TKey, TRecord> {
  const connector = getConnector<TKey, TRecord>(object);
  if (!connector) {
    throw new Error(`No source connector registered for object "${object}"`);
  }
  return connector;
}

/** List the object types that currently have a connector. */
export function registeredObjects(): SourceObject[] {
  return [...registry.keys()];
}

/** Remove every registration. Intended for tests. */
export function resetRegistry(): void {
  registry.clear();
}
