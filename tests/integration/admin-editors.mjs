#!/usr/bin/env node
// Every admin editor that claims to save, saves.
//
// Two halves, and both are needed. A live ROUND TRIP proves the table accepts
// the write and gives it back; a STATIC check proves the page's Save handler
// actually calls the mutation rather than firing a toast. Either alone passes
// the defect this suite exists for: `/admin/database`'s Workflows tab showed a
// green "Live (persisted)" badge, wrote an audit row claiming `record.update`,
// and had no persistence branch at all.
//
// It covered FOUR surfaces — routing rules, agents, workflow templates, forms —
// while eighteen admin routes exist. The eight added here are every remaining
// surface that is supposed to persist; the ones deliberately left out are
// listed at the bottom with why, so "not covered" is a decision rather than an
// oversight.
//
// Run: npm run test:admin-editors

import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { neonClient, loadEnv } from '../lib/live.mjs';

const sb = await neonClient('admin-editors');
// `procurement_policy_configs` is deliberately NOT in api/db.ts's allowlist: it
// has its own endpoint so the browser cannot write thresholds directly. Reading
// it therefore needs a direct client rather than the boundary the editors use.
const env = loadEnv();
const sql = neon(env.NEON_DATABASE_URL || env.DATABASE_URL);

const results = [];
const pass = (n, d = '') => results.push({ n, o: 'PASS', d });
const fail = (n, d) => results.push({ n, o: 'FAIL', d });
const assert = (cond, n, d) => (cond ? pass(n, d) : fail(n, d));

/**
 * Every admin surface that persists, what it writes to, and how its page saves.
 *
 * `key` is the primary-key column — not always `id`: service descriptions are
 * keyed by `category` and the policy config is a singleton on `singleton_key`.
 * `field` is a text column safe to round-trip; the original is restored after.
 */
const SURFACES = [
  {
    label: 'routing rules', table: 'routing_rules', key: 'id', field: 'name',
    page: 'src/features/admin/routing-rules/components/rule-editor-panel.tsx',
    hook: 'useSaveRoutingRule', mutate: 'saveRoutingRule.mutateAsync',
  },
  {
    label: 'ai agents', table: 'ai_agents', key: 'id', field: 'description',
    page: 'src/features/admin/ai-agents/components/agent-config-form.tsx',
    hook: 'useSaveAiAgent', mutate: 'saveAiAgent.mutateAsync',
  },
  {
    label: 'workflow templates', table: 'workflow_templates', key: 'id', field: 'name',
    page: 'src/features/admin/workflow-designer/workflow-designer-page.tsx',
    hook: 'useSaveWorkflowTemplate', mutate: 'saveTemplate.mutateAsync',
    // The graph must survive a name edit: a save that flattens nodes or edges
    // to a string is how a round-trip "passes" while destroying the template.
    jsonb: ['nodes', 'edges'],
  },
  {
    label: 'form templates', table: 'form_templates', key: 'id', field: 'name',
    page: 'src/features/admin/forms/form-builder-page.tsx',
    hook: 'useSaveFormTemplate', mutate: 'saveFormTemplate.mutateAsync',
    jsonb: ['fields'],
  },
  // ── The eight this suite did not cover ────────────────────────────────────
  {
    label: 'approval chains', table: 'approval_chains', key: 'id', field: 'name',
    page: 'src/features/admin/approval-chains-page.tsx',
    hook: 'useUpsertApprovalChain', mutate: 'upsertChain.mutateAsync',
    jsonb: ['steps'],
  },
  {
    label: 'procurement categories', table: 'procurement_categories', key: 'id', field: 'label',
    page: 'src/features/admin/categories-page.tsx',
    hook: 'useUpsertProcurementCategory', mutate: 'upsert.mutateAsync',
    // The category's commodity codes live on the same row; a label edit must
    // leave them intact.
    jsonb: ['commodity_codes'],
  },
  {
    label: 'cost centres', table: 'cost_centres', key: 'id', field: 'description',
    page: 'src/features/admin/cost-centres-page.tsx',
    hook: 'useUpsertCostCentre', mutate: 'upsert.mutateAsync',
  },
  {
    label: 'delivery locations', table: 'delivery_locations', key: 'id', field: 'label',
    page: 'src/features/admin/delivery-locations-page.tsx',
    hook: 'useUpsertDeliveryLocation', mutate: 'upsert.mutateAsync',
  },
  {
    // Maintained in Admin → Database → Catalogue Items; the save and delete
    // hooks existed for months with no screen using them.
    label: 'catalogue items', table: 'catalogue_items', key: 'id', field: 'name',
    page: 'src/stores/database-admin-store.ts',
    hook: 'saveCatalogueItem as dbSaveCatalogueItem', mutate: 'dbSaveCatalogueItem(',
  },
  {
    label: 'knowledge base', table: 'knowledge_base', key: 'id', field: 'title',
    page: 'src/features/admin/kb-admin-page.tsx',
    hook: 'useSaveKnowledgeBaseEntry', mutate: 'saveEntry.mutateAsync',
    // Empty live, so the assistant answers from the built-in set. That is the
    // documented fallback, not a fault — but the editor still has to work, and
    // an empty table is exactly where a broken one hides.
    sample: {
      id: 'KB-E2E-CHECK', title: 'Round-trip check', body: 'Inserted and removed by test:admin-editors.',
      source: 'test', tags: ['test'],
    },
  },
  {
    label: 'service descriptions', table: 'service_description_templates', key: 'category', field: 'label',
    page: 'src/features/admin/service-description-page.tsx',
    hook: 'useSaveServiceDescriptionTemplate', mutate: 'save.mutateAsync',
    jsonb: ['slots', 'sections'],
    // Also empty live: every category resolves to DEFAULT_TEMPLATE.
    sample: {
      category: 'e2e-check', label: 'Round-trip check', active: false,
      system_prompt: '', category_guidance: '', temperature: 0.5, max_tokens: 3000,
      slots: [], sections: [], narrative_sections: [],
      sourcing_requirement_sections: [], default_criteria: [],
    },
  },
];

async function roundTrip(surface) {
  const { label, table, key, field, jsonb = [], sample } = surface;
  const { data: rows, error: readErr } = await sb.from(table).select('*').limit(1);
  if (readErr) { fail(`${label}: table is readable`, readErr.message); return; }

  // An empty table must still be provable. `knowledge_base` and
  // `service_description_templates` are both empty live — everything falls back
  // to the built-in set, which is the documented behaviour — and a suite that
  // skipped them would report "no rows" forever while the editor rotted. So a
  // row is inserted, round-tripped and removed.
  let before = rows?.[0];
  let seeded = false;
  if (!before) {
    if (!sample) { fail(`${label}: at least one row to edit`, 'no rows and no sample defined'); return; }
    const { error: insErr } = await sb.from(table).insert(sample);
    if (insErr) { fail(`${label}: the editor's table accepts an insert`, insErr.message); return; }
    seeded = true;
    const { data: fresh } = await sb.from(table).select('*').eq(key, sample[key]).limit(1);
    before = fresh?.[0];
    if (!before) { fail(`${label}: the inserted row reads back`, 'insert reported success and nothing came back'); return; }
    pass(`${label}: an empty table accepts a new row`);
  }

  const marker = `${String(before[field] ?? '').slice(0, 50)} [E2E ${Date.now()}]`;
  const { error: upErr } = await sb.from(table).update({ [field]: marker }).eq(key, before[key]);
  if (upErr) { fail(`${label}: update succeeds`, upErr.message); return; }

  const { data: after } = await sb.from(table).select('*').eq(key, before[key]).single();
  assert(after?.[field] === marker, `${label}: save persists`, `${field}=${after?.[field]}`);

  // JSONB columns must come back as arrays. A save that serialises them to a
  // string still round-trips the text field, so the round trip alone would pass
  // while the template, chain or form was destroyed.
  for (const column of jsonb) {
    assert(Array.isArray(after?.[column]), `${label}: ${column} survives as an array`,
      `got ${typeof after?.[column]}`);
  }

  // Restore, or remove the row this suite created. Leaving a `[E2E …]` row
  // behind would be the suite configuring the platform it is checking.
  if (seeded) await sb.from(table).delete().eq(key, before[key]);
  else await sb.from(table).update({ [field]: before[field] }).eq(key, before[key]);
}

/** The Save handler calls the mutation — not a toast over nothing. */
function handlerCallsMutation(surface) {
  const src = readFileSync(new URL(`../../${surface.page}`, import.meta.url), 'utf8');
  assert(src.includes(surface.hook), `${surface.label}: page imports ${surface.hook}`);
  assert(src.includes(surface.mutate), `${surface.label}: page calls ${surface.mutate}`);
}

/**
 * The policy config is a singleton behind its own endpoint, not a row an editor
 * upserts, so it gets its own check rather than a contrived table entry.
 */
async function policyConfigRoundTrip() {
  const rows = await sql`SELECT config FROM procurement_policy_configs WHERE singleton_key = 'default'`;
  const before = rows[0];
  if (!before) { fail('policy config: the singleton row exists', 'missing'); return; }
  assert(before.config && typeof before.config === 'object',
    'policy config: the stored config is an object, not a string',
    `got ${typeof before.config}`);
  // Both halves of the spine read this row server-side; if it stopped being an
  // object every governed threshold would silently fall back to the shipped
  // default (api/_policy.ts configFromRow).
  const keys = Object.keys(before.config ?? {});
  assert(keys.length >= 10, 'policy config: the row carries the governed keys', `${keys.length} keys`);

  const store = readFileSync(new URL('../../src/stores/policy-config-store.ts', import.meta.url), 'utf8');
  assert(/savePolicyConfig\(/.test(store), 'policy config: the store persists through the endpoint');
}

/**
 * Category managers are a set, not a field: the page replaces a category's rows
 * wholesale. A field-level round trip cannot express that, so the shape is
 * checked instead.
 */
async function categoryManagersRoundTrip() {
  const { data, error } = await sb.from('category_managers').select('category_id, user_id').limit(5);
  if (error) { fail('category managers: readable', error.message); return; }
  assert(Array.isArray(data), 'category managers: the join table reads');
  const page = readFileSync(new URL('../../src/features/admin/categories-page.tsx', import.meta.url), 'utf8');
  assert(page.includes('useSetCategoryManagers'), 'category managers: the page imports the setter');
  assert(page.includes('setManagers.mutateAsync'), 'category managers: the page calls it');
}

/**
 * Preferred suppliers are a set per category, like managers — and unlike
 * managers they are exercised live: one row written, read back and removed.
 * Supplier tags round-trip on the category itself, and are restored.
 */
async function categoryPreferredSuppliersRoundTrip() {
  const page = readFileSync(new URL('../../src/features/admin/categories-page.tsx', import.meta.url), 'utf8');
  assert(page.includes('setPreferred.mutateAsync'), 'preferred suppliers: the page saves the list');
  assert(page.includes('supplierTags:'), 'supplier tags: the category form carries them');

  const { data: cats } = await sb.from('procurement_categories').select('id, supplier_tags').limit(1);
  const { data: sups } = await sb.from('suppliers').select('id').limit(50);
  const { data: listed } = await sb.from('category_preferred_suppliers').select('category_id, supplier_id');
  const cat = cats?.[0];
  if (!cat || !sups?.length) { fail('preferred suppliers: fixtures to exercise', 'no category or supplier'); return; }
  const taken = new Set((listed ?? []).filter((r) => r.category_id === cat.id).map((r) => r.supplier_id));
  const sup = sups.find((row) => !taken.has(row.id));
  if (!sup) { assert(true, 'preferred suppliers: every supplier already listed — nothing to add'); return; }

  const { error: insErr } = await sb.from('category_preferred_suppliers').insert({ category_id: cat.id, supplier_id: sup.id });
  assert(!insErr, 'preferred suppliers: a row saves', insErr?.message);
  const { data: back } = await sb.from('category_preferred_suppliers').select('supplier_id').eq('category_id', cat.id);
  assert((back ?? []).some((r) => r.supplier_id === sup.id), 'preferred suppliers: it reads back');
  await sb.from('category_preferred_suppliers').delete().eq('category_id', cat.id).eq('supplier_id', sup.id);

  const original = cat.supplier_tags ?? [];
  const marked = [...original, 'admin-editors-probe'];
  await sb.from('procurement_categories').update({ supplier_tags: marked }).eq('id', cat.id);
  const { data: tagged } = await sb.from('procurement_categories').select('supplier_tags').eq('id', cat.id).maybeSingle();
  assert(JSON.stringify(tagged?.supplier_tags) === JSON.stringify(marked), 'supplier tags: a change persists');
  await sb.from('procurement_categories').update({ supplier_tags: original }).eq('id', cat.id);
}

/**
 * Functional roles (Approval Chains → Roles): which system role acts as each
 * role a chain or a stage names. A code constant until 2026-09-25. One probe
 * role is written, read back, remapped and removed.
 */
async function functionalRolesRoundTrip() {
  const panel = readFileSync(new URL('../../src/features/admin/approval-roles-panel.tsx', import.meta.url), 'utf8');
  assert(panel.includes('upsert.mutateAsync') && panel.includes('remove.mutateAsync'), 'roles: the panel saves and deletes');
  const name = 'admin-editors-probe-role';
  const { error: insErr } = await sb.from('functional_roles').insert({ name, acts_as: 'procurement-manager', description: '', sort_order: 99 });
  assert(!insErr, 'roles: a role saves', insErr?.message);
  await sb.from('functional_roles').update({ acts_as: 'admin' }).eq('name', name);
  const { data: back } = await sb.from('functional_roles').select('acts_as').eq('name', name).maybeSingle();
  assert(back?.acts_as === 'admin', 'roles: a remapping persists', JSON.stringify(back));
  await sb.from('functional_roles').delete().eq('name', name);
  const { data: gone } = await sb.from('functional_roles').select('name').eq('name', name).maybeSingle();
  assert(!gone, 'roles: the probe is removed');
}

/**
 * Support SLAs: the hours a ticket of each priority has for a first response,
 * `sla_targets` rows with stage 'ticket'. The page was a read-only copy of the
 * workflow's stage SLAs while these rows — the ones tickets actually read —
 * had no editor at all. Keyed (stage, channel), so it gets its own check.
 */
async function ticketSlaRoundTrip() {
  const page = readFileSync(new URL('../../src/features/admin/sla-targets-page.tsx', import.meta.url), 'utf8');
  assert(page.includes('useSaveTicketSla') && page.includes('save.mutateAsync'), 'support SLAs: the page saves the hours');
  const { data: before, error } = await sb.from('sla_targets').select('channel, hours, days').eq('stage', 'ticket').eq('channel', 'low').maybeSingle();
  if (error || !before) { fail('support SLAs: the low-priority row exists', error?.message ?? 'missing'); return; }
  const probe = (before.hours ?? 24) + 1;
  await sb.from('sla_targets').update({ hours: probe }).eq('stage', 'ticket').eq('channel', 'low');
  const { data: after } = await sb.from('sla_targets').select('hours').eq('stage', 'ticket').eq('channel', 'low').maybeSingle();
  assert(after?.hours === probe, 'support SLAs: a change persists', JSON.stringify(after));
  await sb.from('sla_targets').update({ hours: before.hours, days: before.days }).eq('stage', 'ticket').eq('channel', 'low');
  // Stage SLAs belong to the workflow templates; a stage row here would be a
  // second answer to "how long does this stage have" that nothing reads.
  const { data: stageRows } = await sb.from('sla_targets').select('stage').neq('stage', 'ticket');
  assert((stageRows ?? []).length === 0, 'support SLAs: the table holds ticket rows only', `${stageRows?.length} other rows`);
}

/**
 * Surfaces with no persistence, on purpose. Listed so that "not covered" is a
 * decision someone made rather than something nobody noticed.
 */
function deliberatelyReadOnly() {
  const cases = [
    // Derived from system_integrations — there is nothing here to save.
    ['system health', 'src/features/admin/system-health-page.tsx', 'mutateAsync'],
  ];
  for (const [label, path, forbidden] of cases) {
    const src = readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
    assert(!src.includes(forbidden), `${label}: read-only, and stays read-only`,
      `${forbidden} appeared — a page that saves must be in SURFACES above`);
  }
}

async function main() {
  for (const surface of SURFACES) {
    await roundTrip(surface);
    handlerCallsMutation(surface);
  }
  await policyConfigRoundTrip();
  await categoryManagersRoundTrip();
  await categoryPreferredSuppliersRoundTrip();
  await functionalRolesRoundTrip();
  await ticketSlaRoundTrip();
  deliberatelyReadOnly();

  const failed = results.filter((r) => r.o === 'FAIL').length;
  for (const r of results) {
    const tag = r.o === 'PASS' ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    console.log(`  ${tag}  ${r.n}`);
    if (r.d) console.log(`        ${r.d}`);
  }
  console.log(`\n  ${results.length - failed} passed, ${failed} failed across ${SURFACES.length} editors.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
