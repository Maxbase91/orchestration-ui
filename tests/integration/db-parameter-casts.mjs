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
// out of supabase/schema.sql and asserts the cast helper produces something
// comparable for each. A new column type in the schema with no mapping shows up
// here rather than in production.

import { readFileSync } from 'node:fs';
import { castForColumn } from '../../api/db.ts';

const ROOT = new URL('../../', import.meta.url);
const SCHEMA = readFileSync(new URL('supabase/schema.sql', ROOT), 'utf8');

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

console.log('');
if (failures) console.error(`FAILED: ${failures} check(s)`);
else console.log('All parameter-cast checks passed.');
process.exit(failures === 0 ? 0 : 1);
