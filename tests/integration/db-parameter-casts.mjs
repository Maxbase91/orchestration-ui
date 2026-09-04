#!/usr/bin/env node
// Every query parameter must be cast to its column's type, never blindly to text.
//
// The regression this pins: /api/db cast every string parameter to `::text`, so
// a WHERE against any non-text column produced SQL PostgreSQL rejects — there is
// no implicit text→uuid/date/timestamptz cast. `"valid_until" > $1::text` fails
// with `operator does not exist: date > text`. That broke risk-assessment reuse
// matching (which throws on error) and made assistant conversation writes fail
// silently (uuid keys, no error check).
//
// The check is offline and exhaustive by construction: it reads the column types
// out of db/schema.sql and asserts the cast helper produces something
// comparable for each. A new column type in the schema with no mapping shows up
// here rather than in production.

import { readFileSync } from 'node:fs';
import { assertFilteredWrite, castForColumn, parameterValue } from '../../api/db.ts';

const ROOT = new URL('../../', import.meta.url);
const SCHEMA = readFileSync(new URL('db/schema.sql', ROOT), 'utf8');

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures++;
};

// information_schema.data_type spellings, keyed by the DDL keyword they come from.
const DDL_TO_INFORMATION_SCHEMA = {
  UUID: 'uuid',
  DATE: 'date',
  TIMESTAMPTZ: 'timestamp with time zone',
  TIMESTAMP: 'timestamp without time zone',
  BOOLEAN: 'boolean',
  INTEGER: 'integer',
  BIGINT: 'bigint',
  NUMERIC: 'numeric',
  JSONB: 'jsonb',
  'TEXT[]': 'ARRAY',
  TEXT: 'text',
};

const types = (column, dataType) => new Map([[column, dataType]]);

console.log('\nA parameter is cast to its column’s type');

// The three that actually broke, named individually so a regression says which.
check('a DATE column compares as a date, not text',
  castForColumn('2026-09-01', 'valid_until', types('valid_until', 'date')) === '::date',
  castForColumn('2026-09-01', 'valid_until', types('valid_until', 'date')));
check('a UUID column compares as a uuid, not text',
  castForColumn('11111111-1111-4111-8111-111111111111', 'id', types('id', 'uuid')) === '::uuid');
check('a TIMESTAMPTZ column compares as a timestamptz, not text',
  castForColumn('2026-09-01T00:00:00Z', 'created_at', types('created_at', 'timestamp with time zone')) === '::timestamptz');

console.log('\nNo column type in the schema is cast to text unless it is text');

// Every DDL type the schema actually uses — so adding one without a mapping fails here.
const used = new Set();
for (const [, ddl] of SCHEMA.matchAll(/^\s+[a-z_]+\s+(TEXT\[\]|UUID|DATE|TIMESTAMPTZ|TIMESTAMP|BOOLEAN|INTEGER|BIGINT|NUMERIC|JSONB|TEXT)\b/gm)) {
  used.add(ddl);
}
check('the schema still uses the types this test knows about', used.size >= 8, `found ${used.size}`);

for (const ddl of [...used].sort()) {
  const dataType = DDL_TO_INFORMATION_SCHEMA[ddl];
  const cast = castForColumn('some-value', 'col', types('col', dataType));
  const textish = ddl === 'TEXT';
  check(`${ddl} (${dataType}) → ${cast || 'no cast'}`,
    textish ? cast === '::text' : cast !== '::text',
    `got ${cast || 'no cast'}`);
}

console.log('\nEdge cases');
check('an unmapped column type gets no cast, so PostgreSQL infers from the column',
  castForColumn('x', 'col', types('col', 'inet')) === '');
check('a column the schema does not know gets no cast',
  castForColumn('x', 'mystery', new Map()) === '');
// A null is rendered as the literal NULL rather than a parameter, so a cast on
// it would be attached to nothing.
check('null needs no cast', castForColumn(null, 'col', types('col', 'date')) === '');

console.log('\nThe operators the suites actually use are implemented');
// `like` was on neither the client nor the endpoint — only `ilike` — while three
// cleanup deletes in the migrated suites use it. A missing operator throws at the
// endpoint rather than silently widening, but the suite still fails.
const OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in', 'cs'];
const ENDPOINT = readFileSync(new URL('api/db.ts', ROOT), 'utf8');
const CLIENT = readFileSync(new URL('src/lib/neon-compatible-client.ts', ROOT), 'utf8');
for (const op of OPERATORS) {
  check(`${op} is handled by the endpoint`, ENDPOINT.includes(`case '${op}':`));
}
// The client exposes the named ones as methods; `filter()` covers the rest.
for (const op of ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in']) {
  check(`${op} is a client method`, new RegExp(`^\\s+${op}\\(`, 'm').test(CLIENT));
}

console.log('\nA destructive statement must name what it touches');
console.log('\nAn empty string reaches a non-text column as NULL');
// A cleared form control produces '', which is a legal value for a text column
// and for nothing else. "Save as Draft" on a demand with no delivery date died
// with `invalid input syntax for type date: ""` — the write path passed the raw
// field through and PostgreSQL was asked to parse '' as a DATE. Fixing it in
// `parameterValue` covers every writer, not just the one that was reported.
for (const [ddl, dataType] of Object.entries(DDL_TO_INFORMATION_SCHEMA)) {
  if (dataType === 'text' || dataType === 'ARRAY' || dataType === 'jsonb') continue;
  check(`'' becomes NULL for a ${ddl} column`,
    parameterValue('', 'col', types('col', dataType)) === null,
    `got ${JSON.stringify(parameterValue('', 'col', types('col', dataType)))}`);
}
check("'' is preserved for a TEXT column", parameterValue('', 'col', types('col', 'text')) === '');
check("'' is preserved for a column of unknown type", parameterValue('', 'col', new Map()) === '');
// Only the empty string is coerced: a real value must still reach the column.
check('a real date is untouched', parameterValue('2026-09-04', 'col', types('col', 'date')) === '2026-09-04');
check('zero is untouched', parameterValue(0, 'col', types('col', 'numeric')) === 0);
check('false is untouched', parameterValue(false, 'col', types('col', 'boolean')) === false);
// jsonb serialisation must survive the new branch.
check('a jsonb object is still serialised',
  parameterValue({ a: 1 }, 'col', types('col', 'jsonb')) === '{"a":1}');
check('a jsonb empty string is left alone (a valid JSON string payload)',
  parameterValue('', 'col', types('col', 'jsonb')) === '');

// Blast-radius guard, not authorization: /api/db has no authentication, so an
// unfiltered DELETE would empty a table for anyone who can reach the
// deployment. Every legitimate caller in src/lib/db filters by id.
const refuses = (request) => {
  try { assertFilteredWrite(request); return false; } catch { return true; }
};
check('an unfiltered delete is refused', refuses({ operation: 'delete', filters: [] }));
check('an unfiltered update is refused', refuses({ operation: 'update' }));
check('a filtered delete is allowed',
  !refuses({ operation: 'delete', filters: [{ column: 'id', operator: 'eq', value: 'X' }] }));
check('a filtered update is allowed',
  !refuses({ operation: 'update', filters: [{ column: 'id', operator: 'eq', value: 'X' }] }));
check('an or-filtered delete is allowed',
  !refuses({ operation: 'delete', orFilters: [{ column: 'id', operator: 'eq', value: 'X' }] }));
check('an unfiltered select is untouched', !refuses({ operation: 'select' }));

console.log('');
if (failures) console.error(`FAILED: ${failures} check(s)`);
else console.log('All parameter-cast checks passed.');
process.exit(failures === 0 ? 0 : 1);
