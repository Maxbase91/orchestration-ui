#!/usr/bin/env node
// Verifies the standardised source-connector layer: registry resolution, the
// own-store query semantics (filter / search / limit / get), the provenance
// envelope, and the live-swap seam (replacing a connector without changing the
// consumer call).
//
// Self-contained — mirrors src/lib/integrations/{ports,registry,own-store/factory}.ts.
// Keep in sync with those modules. Run: node tests/integration/source-connectors.mjs

import { readFileSync, readdirSync } from 'node:fs';

let failures = 0;
function check(name, cond) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}`);
  }
}

// --- mirror of ports.ts envelope helpers ---
function wrap(data, object, sourceSystem, mode, freshnessTtlSeconds) {
  return {
    data,
    meta: { object, sourceSystem, mode, retrievedAt: new Date().toISOString(), freshnessTtlSeconds },
  };
}

// --- mirror of registry.ts ---
function makeRegistry() {
  const map = new Map();
  return {
    register: (c) => map.set(c.object, c),
    get: (o) => map.get(o) ?? null,
    require: (o) => {
      const c = map.get(o);
      if (!c) throw new Error(`No source connector registered for object "${o}"`);
      return c;
    },
    objects: () => [...map.keys()],
  };
}

// --- mirror of own-store/factory.ts applyQuery + connector ---
function applyQuery(records, query, config) {
  let out = records;
  if (query?.filters && config.matchFilter) {
    const entries = Object.entries(query.filters).filter(([, v]) => v !== undefined);
    if (entries.length) out = out.filter((r) => entries.every(([f, v]) => config.matchFilter(r, f, v)));
  }
  if (query?.search && config.searchText) {
    const needle = query.search.trim().toLowerCase();
    if (needle) out = out.filter((r) => config.searchText(r).toLowerCase().includes(needle));
  }
  if (typeof query?.limit === 'number' && query.limit >= 0) out = out.slice(0, query.limit);
  return out;
}

function createOwnStoreConnector(config) {
  return {
    object: config.object,
    sourceSystem: config.sourceSystem,
    mode: 'shadow',
    async get(key) {
      let record = null;
      if (config.loadOne) record = await config.loadOne(key);
      else record = (await config.loadAll()).find((r) => config.identity(r) === String(key)) ?? null;
      return record ? wrap(record, config.object, config.sourceSystem, 'shadow', config.freshnessTtlSeconds) : null;
    },
    async list(query) {
      const all = await config.loadAll();
      return applyQuery(all, query, config).map((r) =>
        wrap(r, config.object, config.sourceSystem, 'shadow', config.freshnessTtlSeconds));
    },
  };
}

// --- fixture: representative own-store data ---
const SUPPLIERS = [
  { id: 'SUP-1', name: 'Northwind Logistics', riskRating: 'low', categories: ['logistics'] },
  { id: 'SUP-2', name: 'Acme Consulting', riskRating: 'high', categories: ['consulting'] },
  { id: 'SUP-3', name: 'Globex Logistics', riskRating: 'low', categories: ['logistics'] },
];

const supplierConfig = {
  object: 'supplier',
  sourceSystem: 'supplier-master',
  freshnessTtlSeconds: 86400,
  loadAll: async () => SUPPLIERS,
  loadOne: async (id) => SUPPLIERS.find((s) => s.id === id) ?? null,
  identity: (s) => s.id,
  searchText: (s) => [s.id, s.name, s.categories.join(' ')].join(' '),
  matchFilter: (s, field, value) => {
    if (field === 'riskRating') return s.riskRating === value;
    if (field === 'category') return s.categories.includes(String(value));
    return true;
  },
};

async function main() {
  const registry = makeRegistry();
  const supplier = createOwnStoreConnector(supplierConfig);
  registry.register(supplier);

  console.log('Registry');
  check('resolves a registered connector', registry.get('supplier') === supplier);
  check('require throws for an unregistered object', (() => {
    try { registry.require('invoice'); return false; } catch { return true; }
  })());
  check('lists registered objects', registry.objects().includes('supplier'));

  console.log('Own-store query semantics');
  const c = registry.require('supplier');
  const byKey = await c.get('SUP-2');
  check('get resolves by key', byKey?.data.name === 'Acme Consulting');
  check('get returns null for unknown key', (await c.get('SUP-99')) === null);

  const all = await c.list();
  check('list returns every record', all.length === 3);

  const lowRisk = await c.list({ filters: { riskRating: 'low' } });
  check('filter narrows to matching records', lowRisk.length === 2);

  const undefinedFilterIgnored = await c.list({ filters: { riskRating: undefined } });
  check('undefined filter values are ignored', undefinedFilterIgnored.length === 3);

  const searched = await c.list({ search: 'logistics' });
  check('free-text search matches concatenated fields', searched.length === 2);

  const limited = await c.list({ limit: 1 });
  check('limit caps the result count', limited.length === 1);

  const combined = await c.list({ filters: { riskRating: 'low' }, search: 'globex' });
  check('filter + search compose', combined.length === 1 && combined[0].data.id === 'SUP-3');

  console.log('Provenance envelope');
  check('records carry sourceSystem', byKey?.meta.sourceSystem === 'supplier-master');
  check('own-store records are mode "shadow"', byKey?.meta.mode === 'shadow');
  check('records carry a retrievedAt timestamp', typeof byKey?.meta.retrievedAt === 'string');
  check('records carry the freshness TTL', byKey?.meta.freshnessTtlSeconds === 86400);

  console.log('Live-swap seam');
  // A live connector for the same object, returned by the same consumer call.
  const liveSupplier = {
    object: 'supplier',
    sourceSystem: 'live-supplier-api',
    mode: 'live',
    async get(key) { return wrap({ id: key, name: 'Live Co', riskRating: 'medium', categories: [] }, 'supplier', 'live-supplier-api', 'live'); },
    async list() { return []; },
  };
  registry.register(liveSupplier); // replaces the own-store connector
  const swapped = registry.require('supplier');
  const liveRead = await swapped.get('SUP-1');
  check('swap replaces the connector for that object', swapped === liveSupplier);
  check('consumer call now reads the live source', liveRead?.meta.mode === 'live');
  check('consumer call signature is unchanged', liveRead?.data.name === 'Live Co');

  console.log('Boolean filter coercion (reusable / transactable style)');
  // Mirrors the boolean filter wiring used by the risk-assessment / contract
  // connectors (`field === value-as-boolean`).
  const riskConfig = {
    object: 'risk-assessment',
    sourceSystem: 'risk-register',
    loadAll: async () => [
      { id: 'RA-1', title: 'Reusable', summary: '', reusable: true },
      { id: 'RA-2', title: 'One-off', summary: '', reusable: false },
    ],
    identity: (r) => r.id,
    searchText: (r) => [r.id, r.title].join(' '),
    matchFilter: (r, field, value) => (field === 'reusable' ? r.reusable === Boolean(value) : true),
  };
  const risk = createOwnStoreConnector(riskConfig);
  check('boolean filter true keeps only truthy records', (await risk.list({ filters: { reusable: true } })).length === 1);
  check('boolean filter false keeps only falsy records', (await risk.list({ filters: { reusable: false } })).length === 1);

  console.log('Connector registry completeness (drift guard)');
  // Every own-store connector file must declare a canonical object AND be
  // registered in registerDefaultConnectors. Adding a connector without wiring
  // it (or vice versa) fails here.
  const EXPECTED_OBJECTS = [
    'supplier', 'contract', 'purchase-request', 'purchase-order',
    'invoice', 'risk-assessment', 'catalogue-item', 'payment',
  ].sort();

  const ownStoreDir = 'src/lib/integrations/own-store';
  const connectorFiles = readdirSync(ownStoreDir).filter((f) => f.endsWith('-connector.ts'));
  const declaredObjects = connectorFiles
    .map((f) => readFileSync(`${ownStoreDir}/${f}`, 'utf8').match(/object:\s*'([^']+)'/)?.[1])
    .filter(Boolean)
    .sort();
  check('connector files declare exactly the canonical object set',
    JSON.stringify(declaredObjects) === JSON.stringify(EXPECTED_OBJECTS));

  const indexSrc = readFileSync('src/lib/integrations/index.ts', 'utf8');
  const registerBlock = indexSrc.slice(indexSrc.indexOf('registerDefaultConnectors'));
  const registeredCount = (registerBlock.match(/registerConnector\(/g) ?? []).length;
  check('every connector file is registered in registerDefaultConnectors',
    registeredCount === connectorFiles.length);

  console.log('');
  if (failures) {
    console.error(`FAILED: ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('All source-connector checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
