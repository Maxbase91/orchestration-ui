#!/usr/bin/env node
// Verifies the four admin editor Save buttons actually round-trip to
// Supabase (not just fire a toast). Simulates what the UI mutation
// hook does: writes a test record via the base-table API and
// re-reads to confirm persistence.
//
// Run: node tests/integration/admin-editors.mjs

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  const raw = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const sb = createClient(
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const results = [];
const pass = (n, d = '') => results.push({ n, o: 'PASS', d });
const fail = (n, d) => results.push({ n, o: 'FAIL', d });
const assert = (cond, n, d) => (cond ? pass(n, d) : fail(n, d));

// ── Routing Rule ───────────────────────────────────────────────────

async function scenarioRoutingRuleRoundTrip() {
  const { data: any1 } = await sb.from('routing_rules').select('*').limit(1).single();
  if (!any1) { fail('routing: at least one rule present', 'no rules'); return; }
  const original = any1;

  const newName = `E2E-ADMIN-${Date.now()}`;
  const { error: upErr } = await sb
    .from('routing_rules')
    .update({ name: newName, last_modified: new Date().toISOString() })
    .eq('id', original.id);
  if (upErr) { fail('routing: update succeeds', upErr.message); return; }

  const { data: after } = await sb
    .from('routing_rules').select('name').eq('id', original.id).single();
  assert(after?.name === newName, 'routing: save persists the new name', `name=${after?.name}`);

  await sb.from('routing_rules').update({ name: original.name }).eq('id', original.id);
}

// ── AI Agent ───────────────────────────────────────────────────────

async function scenarioAiAgentRoundTrip() {
  const { data: before } = await sb.from('ai_agents').select('*').eq('id', 'AI-001').single();
  if (!before) { fail('ai-agent: AI-001 present', 'missing'); return; }

  const marker = `${before.description.slice(0, 60)} [edited ${Date.now()}]`;
  const { error } = await sb
    .from('ai_agents')
    .update({ description: marker, last_updated: new Date().toISOString() })
    .eq('id', 'AI-001');
  if (error) { fail('ai-agent: update succeeds', error.message); return; }

  const { data: after } = await sb
    .from('ai_agents').select('description').eq('id', 'AI-001').single();
  assert(after?.description === marker, 'ai-agent: save persists the new description');

  await sb.from('ai_agents').update({ description: before.description }).eq('id', 'AI-001');
}

// ── Workflow Template ──────────────────────────────────────────────

async function scenarioWorkflowTemplateRoundTrip() {
  const { data: before } = await sb.from('workflow_templates').select('*').limit(1).single();
  if (!before) { fail('workflow: at least one template present', 'missing'); return; }

  const newName = `${before.name} [E2E edit]`;
  const { error } = await sb
    .from('workflow_templates').update({ name: newName }).eq('id', before.id);
  if (error) { fail('workflow: update succeeds', error.message); return; }

  const { data: after } = await sb
    .from('workflow_templates').select('name,nodes,edges').eq('id', before.id).single();
  assert(after?.name === newName, 'workflow: save persists the new name', `name=${after?.name}`);
  assert(Array.isArray(after?.nodes), 'workflow: nodes field preserved as array');
  assert(Array.isArray(after?.edges), 'workflow: edges field preserved as array');

  await sb.from('workflow_templates').update({ name: before.name }).eq('id', before.id);
}

// ── Form Template ──────────────────────────────────────────────────

async function scenarioFormTemplateRoundTrip() {
  const { data: before } = await sb.from('form_templates').select('*').eq('id', 'FORM-001').single();
  if (!before) { fail('form: FORM-001 present', 'missing'); return; }

  const newName = `${before.name} [E2E edit]`;
  const { error } = await sb
    .from('form_templates')
    .update({ name: newName, last_modified: new Date().toISOString() })
    .eq('id', 'FORM-001');
  if (error) { fail('form: update succeeds', error.message); return; }

  const { data: after } = await sb
    .from('form_templates').select('name,fields').eq('id', 'FORM-001').single();
  assert(after?.name === newName, 'form: save persists the new name', `name=${after?.name}`);
  assert(Array.isArray(after?.fields), 'form: fields JSONB preserved as array');

  await sb.from('form_templates').update({ name: before.name }).eq('id', 'FORM-001');
}

// ── Static source assertions (confirm wiring actually exists) ─────

async function scenarioHandlersCallMutations() {
  const files = [
    {
      path: '../../src/features/admin/routing-rules/components/rule-editor-panel.tsx',
      hook: 'useSaveRoutingRule',
      mutate: 'saveRoutingRule.mutateAsync',
    },
    {
      path: '../../src/features/admin/ai-agents/components/agent-config-form.tsx',
      hook: 'useSaveAiAgent',
      mutate: 'saveAiAgent.mutateAsync',
    },
    {
      path: '../../src/features/admin/workflow-designer/workflow-designer-page.tsx',
      hook: 'useSaveWorkflowTemplate',
      mutate: 'saveTemplate.mutateAsync',
    },
    {
      path: '../../src/features/admin/forms/form-builder-page.tsx',
      hook: 'useSaveFormTemplate',
      mutate: 'saveFormTemplate.mutateAsync',
    },
  ];
  for (const f of files) {
    const src = readFileSync(new URL(f.path, import.meta.url), 'utf8');
    assert(src.includes(f.hook), `${f.path}: imports ${f.hook}`);
    assert(src.includes(f.mutate), `${f.path}: calls ${f.mutate}`);
  }
}

async function main() {
  await scenarioRoutingRuleRoundTrip();
  await scenarioAiAgentRoundTrip();
  await scenarioWorkflowTemplateRoundTrip();
  await scenarioFormTemplateRoundTrip();
  await scenarioHandlersCallMutations();

  const failed = results.filter((r) => r.o === 'FAIL').length;
  for (const r of results) {
    const tag = r.o === 'PASS' ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    console.log(`  ${tag}  ${r.n}`);
    if (r.d) console.log(`        ${r.d}`);
  }
  console.log(`\n  ${results.length - failed} passed, ${failed} failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
