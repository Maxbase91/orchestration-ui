#!/usr/bin/env node
// The audit log is append-only (2026-09-26), against the live store.
//
// `audit_entries` was reachable through /api/db, where any entry could be
// updated or deleted by id, and nothing in the database refused it — so the
// record of what was done, by whom and when, could be rewritten by anyone who
// could reach the deployment. Now /api/db refuses the rewrite (400
// append_only), and a trigger refuses it on every path. The one change allowed
// is the foreign key's: deleting a request clears its rows' link. Removing a
// row is `purge_audit_entries`, which /api/db cannot call.
//
// Nothing here can damage the real log if the guard is missing: every write is
// scoped to this run's own rows by id, and TRUNCATE is checked in the schema,
// never executed.
//
// Run: node --import tsx/esm tests/integration/audit-append-only.mjs

import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { loadEnv, purgeAuditEntries, requireConnection, skipIfUnreachable } from '../lib/live.mjs';

loadEnv();
const connectionString = requireConnection('audit-append-only');
process.env.NEON_DATABASE_URL = connectionString;
const sql = neon(connectionString);
const { default: dbHandler } = await import('../../api/db.ts');

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures++;
};
const read = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

/** /api/db, as the browser reaches it. */
async function viaApi(body) {
  let status = 200; let json;
  const res = { status(code) { status = code; return res; }, json(value) { json = value; return res; }, setHeader() {} };
  await dbHandler({ method: 'POST', body, query: {}, headers: {} }, res);
  return { status, json };
}
/** A statement straight to the database, reporting whether it was refused. */
async function refused(text, params) {
  try { await sql.query(text, params); return null; } catch (error) { return error instanceof Error ? error.message : String(error); }
}

console.log('\nThe schema says so');
const schema = read('db/schema.sql');
check('a row trigger refuses update and delete',
  /CREATE OR REPLACE TRIGGER audit_entries_append_only\s+BEFORE UPDATE OR DELETE ON audit_entries/.test(schema));
check('a statement trigger refuses truncate',
  /CREATE OR REPLACE TRIGGER audit_entries_no_truncate\s+BEFORE TRUNCATE ON audit_entries/.test(schema));
check('the purge is not a function /api/db will call',
  /CREATE OR REPLACE FUNCTION purge_audit_entries/.test(schema)
    && !/ALLOWED_FUNCTIONS = new Set\([^)]*purge_audit_entries/.test(read('api/db.ts')));

const suffix = Date.now().toString(36);
const marker = `TEST-AAO-${suffix}`;
const requestId = `TEST-AAO-REQ-${suffix}`;
let users;
try {
  users = await sql.query('SELECT id FROM users ORDER BY id LIMIT 1');
} catch (error) {
  skipIfUnreachable('audit-append-only', error);
}

try {
  console.log('\n/api/db adds entries and refuses to rewrite them');
  const inserted = await viaApi({
    operation: 'insert', table: 'audit_entries', select: '*', single: 'one',
    body: { action: 'test.append-only', object_type: 'test', object_id: marker, detail: `${marker} original`, type: 'system' },
  });
  const id = inserted.json?.data?.id;
  check('an entry is added', inserted.status === 200 && typeof id === 'string', JSON.stringify(inserted.json));
  for (const [label, body] of [
    ['an update', { operation: 'update', table: 'audit_entries', body: { detail: 'rewritten' }, filters: [{ column: 'id', operator: 'eq', value: id }] }],
    ['a delete', { operation: 'delete', table: 'audit_entries', filters: [{ column: 'id', operator: 'eq', value: id }] }],
    ['an upsert over it', { operation: 'upsert', table: 'audit_entries', conflict: 'id', body: { id, action: 'x', object_type: 'test', object_id: marker, detail: 'rewritten' } }],
  ]) {
    const answer = await viaApi(body);
    check(`${label} is refused — 400 append_only`, answer.status === 400 && answer.json?.code === 'append_only', JSON.stringify(answer.json));
  }
  const purgeRpc = await viaApi({ operation: 'rpc', functionName: 'purge_audit_entries' });
  check('the purge cannot be called through /api/db', purgeRpc.json?.code === 'unsupported_function', JSON.stringify(purgeRpc.json));
  const [kept] = await sql.query('SELECT detail FROM audit_entries WHERE id = $1', [id]);
  check('…and the entry is as it was written', kept?.detail === `${marker} original`, JSON.stringify(kept));

  console.log('\nThe database refuses it on every path');
  check('an update in SQL is refused', Boolean(await refused('UPDATE audit_entries SET detail = $2 WHERE id = $1', [id, 'rewritten'])));
  check('a delete in SQL is refused', Boolean(await refused('DELETE FROM audit_entries WHERE id = $1', [id])));
  const [still] = await sql.query('SELECT detail FROM audit_entries WHERE id = $1', [id]);
  check('…and the entry is still there, unchanged', still?.detail === `${marker} original`);

  console.log('\nDeleting a request clears its entries’ link, and nothing else');
  await sql.query(
    `INSERT INTO requests (id, title, category, status, value, currency, requestor_id, owner_id, created_at, updated_at)
     VALUES ($1, $2, 'services', 'intake', 0, 'EUR', $3, $3, now(), now())`,
    [requestId, `Audit append-only ${suffix}`, users[0].id],
  );
  const [linked] = await sql.query(
    `INSERT INTO audit_entries (action, object_type, object_id, detail, type, request_id)
     VALUES ('test.append-only', 'test', $1, $2, 'system', $3) RETURNING id`,
    [marker, `${marker} linked`, requestId],
  );
  check('a change that clears the link and alters the entry is refused',
    Boolean(await refused('UPDATE audit_entries SET request_id = NULL, detail = $2 WHERE id = $1', [linked.id, 'rewritten'])));
  const deleteRequest = await refused('DELETE FROM requests WHERE id = $1', [requestId]);
  check('the request can be deleted', deleteRequest === null, deleteRequest ?? '');
  const [orphan] = await sql.query('SELECT request_id, detail FROM audit_entries WHERE id = $1', [linked.id]);
  check('…its entry stays, unlinked and unchanged', orphan && orphan.request_id === null && orphan.detail === `${marker} linked`,
    JSON.stringify(orphan));
} finally {
  const removed = await purgeAuditEntries('object_id = $1', [marker]);
  check('the purge removes this run’s entries', removed >= 1 || failures > 0, `removed ${removed}`);
  const [left] = await sql.query('SELECT count(*)::int AS n FROM audit_entries WHERE object_id = $1', [marker]);
  check('…and nothing of them is left', left.n === 0, `${left.n} left`);
  await sql.query('DELETE FROM requests WHERE id = $1', [requestId]).catch(() => {});
}

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exitCode = 1; }
else console.log('All audit append-only checks passed.');
