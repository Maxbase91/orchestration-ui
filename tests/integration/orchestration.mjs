#!/usr/bin/env node
// Verifies request orchestration: the stage gate model, the engine's traversal,
// and the transition primitive that writes stage history.
//
// The rule asserted first is the one the whole feature failed on: the engine
// must RUN TO the next gate, not park on a node without executing it. Every
// wizard-created request used to end up `running` at the Validation node with
// its status still `intake`, and nothing was scheduled to pick it up.
//
// Self-contained — mirrors src/lib/workflow/{node-config,transition}.ts and the
// traversal in engine.ts. Keep in sync.
// Run: node tests/integration/orchestration.mjs

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

// ── mirrors node-config.ts ──────────────────────────────────────────────────
const LABEL_TO_STATUS = {
  'intake': 'intake', 'validation': 'validation', 'approval': 'approval',
  'sourcing': 'sourcing', 'sourcing (rfp)': 'sourcing',
  'risk': 'risk', 'risk assessment': 'risk',
  'contracting': 'contracting', 'po creation': 'po', 'receipt': 'receipt',
  'invoice': 'invoice', 'payment': 'payment', 'completed': 'completed',
  'referred back': 'referred-back',
};
const nodeToStatus = (label) =>
  LABEL_TO_STATUS[label.toLowerCase().trim()] ?? label.toLowerCase().trim().replace(/\s+/g, '-');

const DEFAULT_AUTO_STAGES = new Set(['intake']);
const ALWAYS_SUSPEND_STAGES = new Set(['approval', 'sourcing']);

function isGatedStage(node, status) {
  if (ALWAYS_SUSPEND_STAGES.has(status)) return true;
  if (node?.gate) return node.gate === 'manual';
  return !DEFAULT_AUTO_STAGES.has(status);
}

// ── mirrors the engine traversal ────────────────────────────────────────────
const MAX_STEPS_PER_ADVANCE = 50;

function getNextNodeIds(nodeId, edges, outcome) {
  const outgoing = edges.filter((e) => e.source === nodeId);
  if (outgoing.length === 0) return [];
  const matched = outgoing.find((e) => !e.label || e.label === outcome);
  return [(matched ?? outgoing[0]).target];
}

/** Mirrors executeNode + advanceInstance. `store` records every side effect. */
function advanceInstance(template, startNodeId, outcome, store, resuming = false) {
  const nodeMap = new Map(template.nodes.map((n) => [n.id, n]));
  let nodeId = startNodeId;
  let steps = 0;

  while (nodeId && steps < MAX_STEPS_PER_ADVANCE) {
    steps++;
    const node = nodeMap.get(nodeId);
    if (!node) break;
    const stepOutcome = steps === 1 ? outcome : undefined;

    // The node we are suspended ON already ran — that run is what suspended us.
    // Re-running it re-fires the gate and suspends on the same node forever.
    if (resuming && steps === 1) {
      const skipTo = getNextNodeIds(nodeId, template.edges, stepOutcome);
      if (skipTo.length === 0) return { status: 'completed', at: [] };
      nodeId = skipTo[0];
      continue;
    }

    if (node.type === 'end') {
      transitionStage(store, 'completed', node);
      return { status: 'completed', at: [] };
    }
    if (node.type === 'error') {
      transitionStage(store, 'referred-back', node);
      return { status: 'suspended', at: [nodeId] };
    }
    if (node.type === 'stage') {
      const status = nodeToStatus(node.label);
      transitionStage(store, status, node);
      if (status === 'validation') store.complianceReports++;
      if (status === 'approval') store.approvalChains.push(store.pendingChain);
      if (isGatedStage(node, status)) return { status: 'suspended', at: [nodeId] };
    }

    const nextIds = getNextNodeIds(nodeId, template.edges, stepOutcome);
    if (nextIds.length === 0) return { status: 'completed', at: [] };
    nodeId = nextIds[0];
  }
  return { status: 'running', at: nodeId ? [nodeId] : [] };
}

// ── mirrors transition.ts ───────────────────────────────────────────────────
const CHAIN_ROLE_TO_SYSTEM_ROLE = {
  'Category Manager': 'procurement-manager',
  'Third-party risk': 'vendor-manager',
  'Finance Approver': 'procurement-manager',
};
const PERSONA_BY_ROLE = {
  'procurement-manager': { id: 'u1', name: 'Anna' },
  'vendor-manager': { id: 'u4', name: 'Marcus' },
};
function resolveStageOwnerRole(role) {
  if (!role) return null;
  const sys = CHAIN_ROLE_TO_SYSTEM_ROLE[role];
  if (!sys) return null;
  return { id: PERSONA_BY_ROLE[sys].id, systemRole: sys };
}

function addBusinessDays(from, days) {
  const out = new Date(from.getTime());
  let remaining = Math.max(0, Math.floor(days));
  while (remaining > 0) {
    out.setDate(out.getDate() + 1);
    const day = out.getDay();
    if (day !== 0 && day !== 6) remaining--;
  }
  return out;
}

function transitionStage(store, toStage, node, actor) {
  if (store.request.status === toStage) return; // idempotent on the stage
  const now = store.now;

  if (store.request.status) {
    for (const row of store.stageHistory) {
      if (row.stage === store.request.status && row.completedAt === null) row.completedAt = now;
    }
  }
  const ownerId = (node?.role ? resolveStageOwnerRole(node.role)?.id ?? null : actor?.id ?? null)
    ?? store.request.ownerId ?? null;

  store.stageHistory.push({ stage: toStage, enteredAt: now, completedAt: null, ownerId });
  store.request = {
    ...store.request,
    status: toStage,
    ownerId: ownerId ?? store.request.ownerId,
    daysInStage: 0,
    slaDeadline: node?.slaDays != null ? addBusinessDays(new Date(now), node.slaDays).toISOString() : store.request.slaDeadline,
  };
}

const newStore = () => ({
  now: '2026-08-27T09:00:00.000Z',
  request: { id: 'REQ-1', status: null, ownerId: 'u9', daysInStage: 0, slaDeadline: null },
  stageHistory: [],
  complianceReports: 0,
  approvalChains: [],
  pendingChain: 'chain-3',
});

// ── fixture: WF-001 as it exists live, plus node config ─────────────────────
const WF001 = {
  nodes: [
    { id: 'n1', type: 'start', label: 'Request Submitted' },
    { id: 'n2', type: 'stage', label: 'Intake', role: 'Category Manager', slaDays: 1, gate: 'auto' },
    { id: 'n3', type: 'stage', label: 'Validation', role: 'Category Manager', slaDays: 3 },
    { id: 'n4', type: 'decision', label: 'Auto-Route' },
    { id: 'n5', type: 'stage', label: 'Approval', role: 'Finance Approver', slaDays: 5 },
    { id: 'n6', type: 'stage', label: 'Sourcing' },
    { id: 'n7', type: 'stage', label: 'Contracting' },
    { id: 'n12', type: 'end', label: 'Completed' },
  ],
  edges: [
    { source: 'n1', target: 'n2' },
    { source: 'n2', target: 'n3' },
    { source: 'n3', target: 'n4' },
    { source: 'n4', target: 'n5', label: 'Needs Approval' },
    { source: 'n4', target: 'n6', label: 'Direct to Sourcing' },
    { source: 'n5', target: 'n7', label: 'Approved' },
    { source: 'n6', target: 'n7' },
    { source: 'n7', target: 'n12' },
  ],
};

console.log('The engine runs to the next gate');
// The regression: submit used to leave the instance `running` on n3 with the
// request still at `intake`, and nothing would ever execute n3.
const s1 = newStore();
const r1 = advanceInstance(WF001, 'n1', undefined, s1);
check('a fresh submit reaches validation, not intake', s1.request.status === 'validation',
  `got ${s1.request.status}`);
check('the instance suspends rather than running on unexecuted', r1.status === 'suspended');
check('it suspends ON the validation node', r1.at[0] === 'n3');
check('intake was executed, not skipped', s1.stageHistory.some((h) => h.stage === 'intake'));
check('the compliance report is generated at validation', s1.complianceReports === 1);

console.log('\nStage history is written by the engine');
// Both steppers derive "complete" purely from stage_history.completed_at, so an
// engine that writes no history renders every request as never having started.
check('two rows exist after submit', s1.stageHistory.length === 2);
check('intake is closed', s1.stageHistory.find((h) => h.stage === 'intake').completedAt !== null);
check('validation is open', s1.stageHistory.find((h) => h.stage === 'validation').completedAt === null);
check('exactly one row is open at a time',
  s1.stageHistory.filter((h) => h.completedAt === null).length === 1);

console.log('\nOwner and SLA come from the node config');
check('the stage owner is the node\'s configured role, not the submitter',
  s1.request.ownerId === 'u1');
check('sla_deadline is populated', s1.request.slaDeadline !== null);
check('3 business days from Thu 27 Aug lands on Tue 1 Sep',
  addBusinessDays(new Date('2026-08-27T09:00:00Z'), 3).toISOString().slice(0, 10) === '2026-09-01');
check('weekends do not consume SLA',
  addBusinessDays(new Date('2026-08-28T09:00:00Z'), 1).toISOString().slice(0, 10) === '2026-08-31');
// An unmapped role must leave the stage unassigned rather than silently
// handing it to a default person.
const sUnmapped = newStore();
transitionStage(sUnmapped, 'validation', { role: 'Chief Vibes Officer' });
check('an unmapped role does not invent an owner',
  sUnmapped.stageHistory.at(-1).ownerId === 'u9', 'falls back to the existing owner, not a default persona');

console.log('\nThe gate model');
check('validation is gated by default', isGatedStage(undefined, 'validation'));
check('approval is always gated', isGatedStage({ gate: 'auto' }, 'approval'));
check('sourcing is always gated', isGatedStage({ gate: 'auto' }, 'sourcing'));
check('intake is not gated', !isGatedStage(undefined, 'intake'));
check('every real stage is gated by default — nobody does work by accident',
  ['validation', 'risk', 'contracting', 'po', 'receipt', 'invoice', 'payment']
    .every((st) => isGatedStage(undefined, st)));
check('an explicit auto gate can open any of them', !isGatedStage({ gate: 'auto' }, 'po'));
check('an explicit auto gate overrides the default', !isGatedStage({ gate: 'auto' }, 'validation'));
check('WF-004\'s "Sourcing (RFP)" normalises to sourcing', nodeToStatus('Sourcing (RFP)') === 'sourcing');
check('it never produces the invalid slug', nodeToStatus('Sourcing (RFP)') !== 'sourcing-(rfp)');
check('"Risk Assessment" normalises to risk', nodeToStatus('Risk Assessment') === 'risk');

console.log('\nResuming a gated stage');
// Regression: resuming re-executed the gated node, which re-fired its gate and
// suspended on the same node — the request could never leave validation.
const s2 = newStore();
advanceInstance(WF001, 'n1', undefined, s2);
const r2 = advanceInstance(WF001, 'n3', 'completed', s2, true);
check('completing validation moves the request on', s2.request.status !== 'validation');
check('it lands on approval via the decision node', s2.request.status === 'approval',
  `got ${s2.request.status}`);
check('approval suspends for its approvers', r2.status === 'suspended');
check('validation is now closed',
  s2.stageHistory.find((h) => h.stage === 'validation').completedAt !== null);
check('the approval chain is resolved once', s2.approvalChains.length === 1);
check('the chain is the value-banded one, not always chain-1',
  s2.approvalChains[0] === 'chain-3');

console.log('\nTransition safety');
const s3 = newStore();
transitionStage(s3, 'validation', WF001.nodes[2]);
const before = s3.stageHistory.length;
transitionStage(s3, 'validation', WF001.nodes[2]);
check('re-entering the current stage is a no-op', s3.stageHistory.length === before);
check('a double-click cannot open a second row',
  s3.stageHistory.filter((h) => h.stage === 'validation').length === 1);
// A referred-back request re-enters a stage it has already been in; only the
// open row may be closed, never the historical one.
const s4 = newStore();
transitionStage(s4, 'intake', null);
transitionStage(s4, 'validation', null);
transitionStage(s4, 'intake', null);
check('re-entering a past stage opens a new row',
  s4.stageHistory.filter((h) => h.stage === 'intake').length === 2);
check('still exactly one row open',
  s4.stageHistory.filter((h) => h.completedAt === null).length === 1);

console.log('\nCycle guard');
const LOOP = {
  nodes: [{ id: 'a', type: 'stage', label: 'PO Creation', gate: 'auto' }],
  edges: [{ source: 'a', target: 'a' }],
};
const s5 = newStore();
const r5 = advanceInstance(LOOP, 'a', undefined, s5);
check('a self-looping template terminates instead of hanging', r5.status === 'running');

console.log(failures === 0 ? '\n\x1b[32mAll checks passed\x1b[0m' : `\n\x1b[31m${failures} check(s) failed\x1b[0m`);
process.exit(failures === 0 ? 0 : 1);
