#!/usr/bin/env node
// Configuration reaches the thing it configures.
//
// The repeated defect in this codebase is config that looks maintained and
// drives nothing: request_supplier_candidates written and read by nothing;
// FORM-003 sitting on a stage id that does not exist and never firing once; a
// confirm card rendering a sentence the executor never read. Each looked fine on
// screen. These checks assert the couplings an audit had to trace by hand, so
// they cannot come apart again quietly.
import { existsSync, readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { loadEnv } from '../lib/live.mjs';
import { firstActionableStage, getStagesForChannel } from '../../src/lib/workflow/channel-stages.ts';
import { channelStageMapFromTemplates } from '../../src/lib/workflow/channel-stages.ts';
import { workflowTemplates } from '../../src/data/workflows.ts';
import { nodeIdForStatus } from '../../src/lib/workflow/node-config.ts';
import { slaDeadlineFor } from '../../src/lib/workflow/business-days.ts';
// The lifecycle comes from the templates now — buying-channel-stages.ts is
// deleted. Derived once here rather than restated, which is the point.
const CHANNEL_STAGES = channelStageMapFromTemplates(workflowTemplates);


const ROOT = new URL('../../', import.meta.url);
let failures = 0;
const ok = (label) => console.log(`  \x1b[32m✓\x1b[0m ${label}`);
const bad = (label, detail) => {
  failures += 1;
  console.error(`  \x1b[31m✗\x1b[0m ${label}`);
  if (detail) console.error(`      ${detail}`);
};

// ── The intake writer agrees with the stepper ───────────────────────────────
// api/_domains/intake-submit.ts wrote a constant `validation` for every channel.
// When validation became procurement-led-only, business-led and direct-po
// requests landed in a stage their own channel skips — the stepper drew them as
// skipped while they sat in them.
console.log('\nThe first actionable stage is one the channel traverses');
const { BUYING_CHANNELS: CHANNELS } = await import('../../src/lib/workflow/channel-stages.ts');
for (const channel of CHANNELS) {
  for (const risk of [false, true]) {
    const stage = firstActionableStage(CHANNEL_STAGES, channel, { riskAssessmentRequired: risk });
    const traversed = getStagesForChannel(CHANNEL_STAGES, channel);
    if (traversed.includes(stage)) continue;
    bad(`${channel} (risk=${risk}) lands on a traversed stage`,
      `${stage} is not in ${JSON.stringify(traversed)}`);
  }
}
if (failures === 0) ok(`all ${CHANNELS.length} channels land on a stage they traverse`);

// `intake` is never a landing stage — intake is what just completed.
for (const channel of CHANNELS) {
  if (firstActionableStage(CHANNEL_STAGES, channel) === 'intake') bad(`${channel} does not land back on intake`);
}

const intakeWriter = readFileSync(new URL('api/_domains/intake-submit.ts', ROOT), 'utf8');
if (/const INITIAL_STAGE = \{ status: 'validation'/.test(intakeWriter)) {
  bad('the intake writer derives its stage', 'the hardcoded INITIAL_STAGE constant is back');
} else ok('the intake writer derives its stage from the channel');

// ── Neither serverless writer hardcodes a workflow node id ──────────────────
// `n3` is Validation in WF-001 and a *decision* node in WF-002, so the literal
// parked WF-002 requests somewhere the engine cannot resume from.
console.log('\nWorkflow node ids come from the template');
if (/current_node_ids: json\(\['n\d+'\]\)/.test(intakeWriter)) {
  bad('intake-submit resolves its start node', 'a literal node id is back in the instance insert');
} else ok('intake-submit resolves its start node from the template');

// ── LIVE_ENTITIES means the writes exist ────────────────────────────────────
// `workflow` sat in this set with no branch in update/create/remove, so the tab
// rendered a "Live (persisted to the database)" badge, showed a success toast,
// wrote an audit row claiming `record.update`, and persisted nothing. The same
// file's reset() had always treated it as session-only.
console.log('\nEvery live entity has somewhere to write');
const store = readFileSync(new URL('src/stores/database-admin-store.ts', ROOT), 'utf8');
const liveBlock = /const LIVE_ENTITIES = new Set<string>\(\[([\s\S]*?)\]\);/.exec(store);
if (!liveBlock) bad('LIVE_ENTITIES is declared');
else {
  const live = [...liveBlock[1].matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]);
  // reset() lists the entities the store itself treats as session-only.
  const resetBlock = /reset: \(\) => \{[\s\S]*?set\(\{([\s\S]*?)\}\);/.exec(store);
  const sessionOnly = resetBlock ? [...resetBlock[1].matchAll(/^\s*([A-Za-z]+):/gm)].map((m) => m[1]) : [];
  const contradictory = live.filter((key) => sessionOnly.includes(key));
  if (contradictory.length === 0) ok(`${live.length} live entities, none cleared by reset()`);
  else bad('no live entity is also session-only', `${contradictory.join(', ')} are both`);

  // A live entity needs a persistence branch in each mutating action.
  for (const key of live) {
    const branches = new RegExp(`case '${key}':|key === '${key}'`, 'g');
    const hits = (store.match(branches) ?? []).length;
    if (hits === 0) bad(`${key} has a persistence branch`, 'listed live but no write path — edits are discarded');
  }
}

const dbPage = readFileSync(new URL('src/features/admin/database/database-admin-page.tsx', ROOT), 'utf8');
if (/All tabs are live/.test(dbPage)) {
  bad('the banner does not overclaim', '"All tabs are live" is back, and it is not true of every tab');
} else ok('the banner does not claim more than the set does');

// ── A control that collects a value the save does not send ──────────────────
// The agent form had a confidence-threshold slider, seven input checkboxes and
// two switches. None reached the payload, none were seeded from the agent (so
// every agent showed the same defaults), and `ai_agents` has no columns for
// them — while the toast said "configuration saved". They were removed rather
// than wired, because nothing reads an agent beyond `status`.
console.log('\nThe agent form only offers what it saves');
const agentForm = readFileSync(new URL('src/features/admin/ai-agents/components/agent-config-form.tsx', ROOT), 'utf8');
const payload = /const updated: AIAgent = \{([\s\S]*?)\};/.exec(agentForm)?.[1] ?? '';
for (const field of ['confidenceThreshold', 'selectedInputs', 'humanOverride', 'feedbackLoop']) {
  if (!agentForm.includes(field)) continue;
  if (payload.includes(field)) continue;
  bad(`${field} is saved if it is collected`, 'the form collects it and the mutation does not send it');
}
if (failures === 0) ok('no unsent configuration control');

// ── One source for stage SLAs, and no reads of the inert columns ────────────
// Three columns told the same story badly: `sla_deadline` was set only on a
// stage *change* (130 of 136 requests had none), `is_overdue` was written false
// and never set true, and `days_in_stage` is written 0 and never incremented.
// Anything comparing against the last two reported nothing, forever — the
// Workflows "over SLA" filter, the Stuck Requests table, and the AI Insights
// count all sat at zero. The template owns stage SLAs; overdue is derived from
// the deadline.
console.log('\nStage SLAs have one source');
const mappers = readFileSync(new URL('src/lib/db/mappers.ts', ROOT), 'utf8');
if (/result\.isOverdue = ms !== null/.test(mappers)) ok('isOverdue is derived from the deadline');
else bad('isOverdue is derived', 'the mapper passes the stored column through again');

for (const [file, label] of [
  ['src/features/workflows/active-workflows-page.tsx', 'the over-SLA filter'],
  ['src/features/workflows/components/stuck-requests-table.tsx', 'the stuck table'],
]) {
  const source = readFileSync(new URL(file, ROOT), 'utf8');
  // A comparison against daysInStage is the dead-column pattern; a comment
  // mentioning it is fine.
  const code = source.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  if (/daysInStage\s*[<>]/.test(code)) {
    bad(`${label} does not compare daysInStage`, 'days_in_stage is never incremented, so the comparison never fires');
  }
}
if (failures === 0) ok('no surface compares against days_in_stage');

// The orphan module pair, gone. `src/lib/db/sla-targets.ts` and its hook had
// zero importers repo-wide while exporting a `resolveSla` that answered 5 for
// any stage nobody had configured — an invented number, reachable from an
// import away, for a table no countdown reads.
for (const gone of ['src/lib/db/sla-targets.ts', 'src/lib/db/hooks/use-sla-targets.ts']) {
  if (existsSync(new URL(gone, ROOT))) {
    bad(`${gone} is deleted`, 'a stage-SLA reader that no longer has a source to read');
  }
}
if (failures === 0) ok('no module offers to read stage SLAs from sla_targets');

const slaPage = readFileSync(new URL('src/features/admin/sla-targets-page.tsx', ROOT), 'utf8');
if (/useUpsertSlaTarget|upsert\.mutateAsync/.test(slaPage)) {
  bad('the SLA page does not claim to set stage SLAs', 'it writes sla_targets again, which no countdown reads');
} else ok('the SLA page reads the templates rather than writing a table nothing reads');

// ── An edit buffer must be released when the save lands ─────────────────────
// Three pages held `const x = editedX ?? serverX`. The buffer is deliberate —
// a refetch should not discard in-session edits — but none of them cleared it
// on success, so once it was non-null it shadowed the refetch for the rest of
// the session: the save persisted and the screen kept rendering the stale local
// row. /admin/approvals already released it; these did not.
console.log('\nEdit buffers are released on save');
for (const [file, release] of [
  ['src/features/admin/routing-rules/routing-rules-page.tsx', /setEditedRules\(null\)/],
  ['src/features/admin/forms/form-builder-page.tsx', /setEditedForms\(null\)/],
  ['src/features/admin/ai-agents/ai-agents-page.tsx', /setEditedAgents\(null\)/],
]) {
  const source = readFileSync(new URL(file, ROOT), 'utf8');
  const shadows = /const \w+ = edited\w+ \?\? server\w+;/.test(source);
  if (!shadows) continue;               // pattern gone entirely — also fine
  if (release.test(source)) ok(`${file.split('/').pop()} releases its buffer`);
  else bad(`${file.split('/').pop()} releases its buffer`, 'the shadow is never cleared, so a saved row renders stale');
}

// ── Routing: the editor, the evaluator and the submit gate agree ────────────
console.log('\nRouting rules are reachable end to end');
const evaluator = readFileSync(new URL('src/lib/routing/evaluate-routing-rules.ts', ROOT), 'utf8');
const submitter = readFileSync(new URL('api/_domains/intake-submit.ts', ROOT), 'utf8');
const editorPanel = readFileSync(new URL('src/features/admin/routing-rules/components/rule-editor-panel.tsx', ROOT), 'utf8');

// `business-led` 422'd at submit because the writer restated the channel list.
if (/const allowedChannels = new Set\(\[/.test(submitter)) {
  bad('the submit gate derives its channels', 'a second hand-written channel list is back');
} else ok('the submit gate derives its channels from the map');

// Every channel the rule editor offers must be one the map knows, or a rule
// can route somewhere the lifecycle cannot describe.
// Derived from the templates rather than scraped out of a source file, which
// is what the deleted buying-channel-stages.ts made necessary.
const mapChannels = new Set(Object.keys(CHANNEL_STAGES));
// Scoped to the channel array — the file also declares approval-chain options
// in the same shape, and matching both reported chains as unroutable channels.
const channelBlock = /const BUYING_CHANNEL_OPTIONS[^=]*=\s*\[([\s\S]*?)\];/.exec(editorPanel)?.[1] ?? '';
const editorChannels = [...channelBlock.matchAll(/value: '([a-z-]+)'/g)].map((m) => m[1]);
const unroutable = editorChannels.filter((c) => !mapChannels.has(c));
if (unroutable.length === 0) ok(`all ${editorChannels.length} editor channels exist in the stage map`);
else bad('every editor channel exists in the stage map', unroutable.join(', '));

// The AND/OR toggle claimed a semantic the evaluator does not have.
if (/setLogicMode/.test(editorPanel)) {
  bad('the editor does not offer OR', 'ruleMatches uses `every`; an OR toggle is a lie');
} else ok('the editor does not offer a logic mode the evaluator lacks');

// A counter nothing increments, gone rather than merely hidden.
//
// `match_count` was seeded 187, 62, 35, 42… and written by nothing: the
// evaluator is pure and takes no persistence handle. RR-001 carried 42 while
// all three of its conditions were false, which is part of why nobody looked at
// it for months. Hiding the display left the fixtures in the database, still
// re-saved unchanged on every edit, so the field goes too.
for (const [file, label] of [
  ['src/data/types.ts', 'the RoutingRule type'],
  ['src/lib/db/mappers.ts', 'the routing-rule mappers'],
  ['src/data/routing-rules.ts', 'the seeded rules'],
  ['src/features/admin/routing-rules/routing-rules-page.tsx', 'the rules editor'],
]) {
  const source = readFileSync(new URL(file, ROOT), 'utf8');
  const code = source.split('\n').filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*')).join('\n');
  if (/matchCount|match_count/.test(code)) bad(`${label} no longer carries a match count`, file);
}
if (failures === 0) ok('nothing carries a match count that nothing increments');

// ── Live: no request sits in a stage its channel skips ──────────────────────
const env = loadEnv();
const connection = env.NEON_DATABASE_URL ?? env.DATABASE_URL;
if (!connection) {
  console.log('\nLive lifecycle — skipped: no database configured');
  if (process.env.REQUIRE_LIVE === '1') {
    console.error('REQUIRE_LIVE=1 and no database is configured.');
    process.exit(1);
  }
} else {
  console.log('\nLive requests sit in stages their channel traverses');
  const sql = neon(connection);
  // Records the browser harnesses mint mid-run. They are created and deleted
  // within a single E2E pass, so a config assertion that happens to read while
  // one is in flight fails on residue rather than on configuration — which is
  // exactly how this went red on a green commit. Both prefixes: `UI-E2E-` from
  // the lifecycle harness (ADR-0006) and `E2E-TEST-` from the interaction one.
  const rows = await sql`
    SELECT id, status, buying_channel FROM requests
    WHERE buying_channel IS NOT NULL
      AND status NOT IN ('draft', 'completed', 'cancelled', 'referred-back')
      AND id NOT LIKE 'UI-E2E-%' AND id NOT LIKE 'E2E-TEST-%'
  `;
  const offenders = rows.filter((row) => !getStagesForChannel(CHANNEL_STAGES, row.buying_channel).includes(row.status));
  if (offenders.length === 0) ok(`${rows.length} active request(s), none in a skipped stage`);
  else {
    bad(`${offenders.length} request(s) are in a stage their channel skips`,
      offenders.slice(0, 8).map((r) => `${r.id} ${r.buying_channel}/${r.status}`).join(', '));
  }

  // Every stage node has an SLA, or requests in that stage get no deadline and
  // no countdown. Three of four templates shipped with none at all.
  const templates = await sql`SELECT id, channels, nodes FROM workflow_templates`;
  const unset = [];
  for (const t of templates) {
    for (const n of (Array.isArray(t.nodes) ? t.nodes : [])) {
      if (n.type === 'stage' && n.slaDays == null) unset.push(`${t.id}/${n.label}`);
    }
  }
  if (unset.length === 0) ok(`every stage node across ${templates.length} templates has an SLA`);
  else bad(`${unset.length} stage node(s) have no SLA`, unset.slice(0, 8).join(', '));

  // days_in_stage is computed by the view, not the stored column.
  const staged = await sql`
    SELECT id, days_in_stage, days_in_stage_live FROM requests_with_derived
    WHERE status NOT IN ('draft', 'completed', 'cancelled') LIMIT 200
  `;
  const anyLive = staged.some((r) => Number(r.days_in_stage_live) > 0);
  if (anyLive) ok('requests_with_derived computes a non-zero days_in_stage_live');
  else bad('days_in_stage_live is computed', 'every row is zero — the view is not measuring stage entry');
  const requestsModule = readFileSync(new URL('src/lib/db/requests.ts', ROOT), 'utf8');
  if (/READ_SOURCE = 'requests_with_derived'/.test(requestsModule)) {
    ok('the requests module reads the derived view');
  } else bad('the requests module reads the derived view', 'reads bypass it, so days_in_stage is the stored zero');

  // And therefore every open request has a deadline.
  const undated = await sql`
    SELECT id FROM requests
    WHERE sla_deadline IS NULL AND status NOT IN ('draft', 'completed', 'cancelled')
      AND id NOT LIKE 'UI-E2E-%' AND id NOT LIKE 'E2E-TEST-%'
  `;
  if (undated.length === 0) ok('every open request has an SLA deadline');
  else bad(`${undated.length} open request(s) have no deadline`, undated.slice(0, 8).map((r) => r.id).join(', '));

  // ── Configuration nothing reads ──────────────────────────────────────────
  // `sla_targets` held nine stage rows that disagreed with the templates in six
  // of nine stages — sourcing 10 against 20, contracting 15 against 10 — and
  // nothing read them. They sat in the database looking authoritative, which is
  // the exact failure this suite exists for. The table's purpose is now one
  // thing: ticket first-response targets, keyed by priority.
  const slaRows = await sql`SELECT stage, channel, days FROM sla_targets WHERE stage <> 'ticket'`;
  if (slaRows.length === 0) ok('sla_targets holds only ticket rows');
  else {
    bad(`${slaRows.length} sla_targets stage row(s) survive`,
      `${slaRows.map((r) => `${r.stage}=${r.days}d`).join(', ')} — the template owns stage SLAs`);
  }

  const matchCountColumn = await sql`
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'routing_rules' AND column_name = 'match_count'`;
  if (matchCountColumn.length === 0) ok('routing_rules has no match_count column');
  else bad('routing_rules.match_count is dropped', 'a counter no writer maintains');

  // A request without a template has no lifecycle definition: no stage list, no
  // owner roles, no SLAs. 114 of 136 had none, and the intake writer's old
  // fallback — the literal 'WF-001' — would have given a catalogue order the
  // procurement-led workflow, which is worse than none. A channel no template
  // claims is the one honest NULL, and `unclaimedChannels` reports it.
  const templateless = await sql`
    SELECT id, buying_channel FROM requests
    WHERE workflow_template_id IS NULL
      AND id NOT LIKE 'UI-E2E-%' AND id NOT LIKE 'E2E-TEST-%' AND id NOT LIKE 'TEST-%'
  `;
  const claimed = new Set(templates.flatMap((t) => t.channels ?? []));
  const orphaned = templateless.filter((r) => claimed.has(r.buying_channel));
  if (orphaned.length === 0) ok(`every request on a claimed channel names its workflow template`);
  else {
    bad(`${orphaned.length} request(s) name no workflow template`,
      orphaned.slice(0, 8).map((r) => `${r.id} (${r.buying_channel})`).join(', '));
  }

  // The deadline belongs to the stage the request is in. Carried forward, it
  // measures a stage the request has left: out of a 1-day Intake into a 20-day
  // Sourcing, red the next morning, and in the Stuck view for the rest.
  const nodesById = new Map(templates.map((t) => [t.id, Array.isArray(t.nodes) ? t.nodes : []]));
  const dated = await sql`
    SELECT r.id, r.status, r.workflow_template_id, r.sla_deadline::text AS deadline,
           (SELECT sh.entered_at::text FROM stage_history sh
             WHERE sh.request_id = r.id AND sh.completed_at IS NULL
             ORDER BY sh.entered_at DESC LIMIT 1) AS entered
      FROM requests r
     WHERE r.sla_deadline IS NOT NULL AND r.workflow_template_id IS NOT NULL
       AND r.status NOT IN ('draft', 'completed', 'cancelled')
       AND r.id NOT LIKE 'UI-E2E-%' AND r.id NOT LIKE 'E2E-TEST-%' AND r.id NOT LIKE 'TEST-%'
  `;
  // Read as text on both sides: `sla_deadline` is `timestamp` rather than
  // `timestamptz`, so the driver rebuilds it in the reading client's local zone
  // and every instant comes back shifted by that offset. A separate defect, and
  // a wide one; comparing the stored text keeps this check about which NODE's
  // SLA was written rather than about the driver.
  const asMs = (text) => (text ? Date.parse(`${text.replace(' ', 'T')}Z`) : null);
  const stale = [];
  for (const row of dated) {
    if (!row.entered) continue;
    const nodes = nodesById.get(row.workflow_template_id) ?? [];
    const nodeId = nodeIdForStatus(nodes, row.status);
    const slaDays = nodes.find((n) => n.id === nodeId)?.slaDays;
    const want = slaDeadlineFor(new Date(asMs(row.entered)), slaDays);
    // A day of tolerance: `entered_at` and the moment the deadline was written
    // are not the same instant, and business-day arithmetic is whole-day.
    const drift = want === null
      ? 'a stage with no SLA still carries a deadline'
      : (Math.abs(asMs(row.deadline) - Date.parse(want)) > 86_400_000 ? `${row.deadline} vs ${want}` : null);
    if (drift) stale.push(`${row.id} (${row.status}): ${drift}`);
  }
  if (stale.length === 0) ok(`${dated.length} deadline(s) belong to the stage their request is in`);
  else bad(`${stale.length} deadline(s) belong to another stage`, stale.slice(0, 6).join(' | '));
}

console.log('\nAdmin shows what happened, not examples of it');
{
  const auditPage = readFileSync(new URL('src/features/settings/audit-log-page.tsx', ROOT), 'utf8');
  // 40 invented entries (logins from named offices, an AI "duplicate detected",
  // made-up IP addresses) sat beside the real audit rows.
  if (/AUD-0\d\d|ipAddress/.test(auditPage)) bad('the audit log shows only recorded entries', 'hard-coded entries or an IP column are back');
  else ok('the audit log shows only recorded entries');
  const dbAdmin = readFileSync(new URL('src/features/admin/database/database-admin-page.tsx', ROOT), 'utf8');
  if (/key: 'workflow'|handleReset/.test(dbAdmin)) bad('the Database page has no read-only duplicate tab and no reset', 'the Workflows tab or the reset action is back');
  else ok('the Database page has no read-only duplicate tab and no reset');
}

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exit(1); }
console.log('Configuration reaches what it configures.');
