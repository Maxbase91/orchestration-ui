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

// mirrors evaluateEdgeCondition's risk labels + outcome matching
function edgeMatches(label, outcome, ctx = {}) {
  if (!label) return true;
  const l = label.trim().toLowerCase();
  if (l === 'risk required') return ctx.riskRequired === true;
  if (l === 'skip risk' || l === 'no risk assessment') return ctx.riskRequired !== true;
  return outcome != null && l.includes(String(outcome).toLowerCase());
}

function getNextNodeIds(nodeId, edges, outcome, ctx = {}) {
  const outgoing = edges.filter((e) => e.source === nodeId);
  if (outgoing.length === 0) return [];
  const matched = outgoing.find((e) => edgeMatches(e.label, outcome, ctx));
  return [(matched ?? outgoing[0]).target];
}

/** Mirrors executeNode + advanceInstance. `store` records every side effect. */
function advanceInstance(template, startNodeId, outcome, store, resuming = false, ctx = {}) {
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
      const skipTo = getNextNodeIds(nodeId, template.edges, stepOutcome, ctx);
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
      if (status === 'risk') store.riskAssessmentsRaised++;
      if (isGatedStage(node, status)) return { status: 'suspended', at: [nodeId] };
    }

    const nextIds = getNextNodeIds(nodeId, template.edges, stepOutcome, ctx);
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
  // Idempotent on "already in this stage AND already recorded as being in it".
  // Status alone is not enough: a request is created at `intake` before anything
  // opens a row for it, so a status-only guard would decline to record the very
  // first stage — which is how wizard-created requests had no history at all.
  const openHere = store.stageHistory.some(
    (h) => h.stage === toStage && h.completedAt === null,
  );
  if (store.request.status === toStage && openHere) return;
  const now = store.now;

  if (store.request.status && store.request.status !== toStage) {
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
  riskAssessmentsRaised: 0,
  pendingChain: 'chain-3',
});

// ── fixture: WF-001 as it exists live, plus node config ─────────────────────
const WF001 = {
  nodes: [
    { id: 'n1', type: 'start', label: 'Request Submitted' },
    { id: 'n2', type: 'stage', label: 'Intake', role: 'Category Manager', slaDays: 1, gate: 'auto' },
    { id: 'n3', type: 'stage', label: 'Validation', role: 'Category Manager', slaDays: 3,
      purpose: 'Demand is complete, correctly categorised and routed to the right channel.' },
    { id: 'n14', type: 'stage', label: 'Risk Assessment', role: 'Third-party risk', slaDays: 7 },
    { id: 'n4', type: 'decision', label: 'Auto-Route' },
    { id: 'n5', type: 'stage', label: 'Approval', role: 'Finance Approver', slaDays: 5 },
    { id: 'n6', type: 'stage', label: 'Sourcing' },
    { id: 'n7', type: 'stage', label: 'Contracting' },
    { id: 'n12', type: 'end', label: 'Completed' },
  ],
  edges: [
    { source: 'n1', target: 'n2' },
    { source: 'n2', target: 'n3' },
    { source: 'n3', target: 'n14', label: 'Risk required' },
    { source: 'n3', target: 'n4', label: 'Skip risk' },
    { source: 'n14', target: 'n4' },
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

// The first stage of a request created straight at `intake`. A status-only
// idempotency guard silently skipped this, so the request existed with no
// history and every stepper rendered it as never having started.
const sFirst = newStore();
sFirst.request = { ...sFirst.request, status: 'intake' };
transitionStage(sFirst, 'intake', null);
check('the stage a request is created in is still recorded',
  sFirst.stageHistory.length === 1 && sFirst.stageHistory[0].stage === 'intake');
check('and it is left open, not closed on arrival',
  sFirst.stageHistory[0].completedAt === null);
transitionStage(sFirst, 'intake', null);
check('recording it twice still opens only one row', sFirst.stageHistory.length === 1);


// ── mirrors open-items.ts ───────────────────────────────────────────────────
const AT_RISK_HOURS = 24, HOUR_MS = 3600000;
function openSlaState(slaDeadline, now) {
  if (!slaDeadline) return 'none';
  const remaining = new Date(slaDeadline).getTime() - now.getTime();
  if (remaining <= 0) return 'breached';
  if (remaining <= AT_RISK_HOURS * HOUR_MS) return 'at-risk';
  return 'on-track';
}
const TERMINAL = new Set(['completed', 'cancelled']);
function actionForStage(status, pendingCount) {
  if (status === 'approval') {
    return pendingCount > 0
      ? `Awaiting ${pendingCount} approval${pendingCount === 1 ? '' : 's'}`
      : 'Awaiting approval';
  }
  if (status === 'sourcing') return 'Award the sourcing event';
  if (status === 'referred-back') return 'Requester to resubmit';
  return gateActionLabel(status);
}
function gateActionLabel(status) {
  return { validation: 'Complete validation', risk: 'Record risk decision',
    contracting: 'Contract signed', po: 'PO issued', receipt: 'Goods received',
    invoice: 'Invoice matched', payment: 'Payment released' }[status] ?? 'Complete stage';
}
function openItemForRequest(request, node, approvals = [], enteredAt, now = new Date()) {
  if (TERMINAL.has(request.status)) return null;
  const pending = request.status === 'approval'
    ? approvals.filter((a) => a.status === 'pending').map((a) => a.approverId) : [];
  return {
    stage: request.status,
    ownerId: request.ownerId ?? null,
    ownerRole: node?.role,
    action: actionForStage(request.status, pending.length),
    exitCriteria: node?.purpose,
    waitingSince: enteredAt,
    slaState: openSlaState(request.slaDeadline, now),
    pendingApprovers: pending,
  };
}

console.log('\nWhat is open');
const NOW = new Date('2026-08-27T12:00:00Z');
const ahead = (h) => new Date(NOW.getTime() + h * HOUR_MS).toISOString();
const ago = (h) => new Date(NOW.getTime() - h * HOUR_MS).toISOString();

const oi = openItemForRequest(
  { id: 'R', status: 'validation', ownerId: 'u1', slaDeadline: ahead(48) },
  WF001.nodes[2], [], '2026-08-26T09:00:00Z', NOW);
check('the open item names the stage', oi.stage === 'validation');
check('it names the action', oi.action === 'Complete validation');
check('it carries the exit criteria from the node', typeof oi.exitCriteria === 'string');
check('it names the owning role', oi.ownerRole === 'Category Manager');
check('a terminal request has nothing open',
  openItemForRequest({ id: 'R', status: 'completed' }, undefined) === null);
check('a cancelled request has nothing open',
  openItemForRequest({ id: 'R', status: 'cancelled' }, undefined) === null);

console.log('\nOpen-stage SLA');
check('comfortably ahead is on-track', openSlaState(ahead(48), NOW) === 'on-track');
check('inside 24h is at-risk', openSlaState(ahead(6), NOW) === 'at-risk');
check('past due is breached', openSlaState(ago(1), NOW) === 'breached');
// Absence of a target is not compliance — the same rule ticket-sla.ts applies.
check('no deadline is "none", never on-track', openSlaState(undefined, NOW) === 'none');

console.log('\nStage-specific actions');
// Approval and sourcing do not clear because "the owner says so", so a generic
// "Complete approval" would misdescribe what is actually being waited on.
const appr = openItemForRequest({ id: 'R', status: 'approval', ownerId: 'u1' }, undefined,
  [{ approverId: 'u3', status: 'pending' }, { approverId: 'u4', status: 'approved' }], undefined, NOW);
check('approval counts the outstanding approvers', appr.action === 'Awaiting 1 approval');
check('it lists who they are', appr.pendingApprovers.join() === 'u3');
check('two pending pluralises',
  openItemForRequest({ id: 'R', status: 'approval' }, undefined,
    [{ approverId: 'a', status: 'pending' }, { approverId: 'b', status: 'pending' }], undefined, NOW)
    .action === 'Awaiting 2 approvals');
check('sourcing waits on the award',
  openItemForRequest({ id: 'R', status: 'sourcing' }, undefined, [], undefined, NOW)
    .action === 'Award the sourcing event');
check('referred-back waits on the requester',
  openItemForRequest({ id: 'R', status: 'referred-back' }, undefined, [], undefined, NOW)
    .action === 'Requester to resubmit');

console.log('\nThe intake determination is persisted');
// saveIntakeCompliance existed, correctly shaped, with zero call sites: the
// table was written only by the demo seeder, so seeded requests showed
// compliance data and every app-created one showed the empty state.
function buildIntakeRecord(form, id, now) {
  return {
    requestId: id,
    determinedAt: now,
    buyingChannel: {
      channel: form.buyingChannelSlug || 'procurement-led',
      label: form.buyingChannelResult || 'Procurement-Led Sourcing',
      reasoning: form.matchedRuleName
        ? `Matched routing rule "${form.matchedRuleName}".`
        : 'No routing rule matched; the value-band fallback applied.',
    },
    sraCheck: { status: form.sraStatus?.includes('expired') ? 'warning' : 'pass', detail: form.sraStatus },
    policyChecks: form.policyChecks ?? [],
    duplicateCheck: { found: false, detail: form.duplicateCheck ?? 'No duplicate demand detected at intake.' },
    riskFlags: [
      ...(form.materiality?.material ? ['material'] : []),
      ...(form.inherentRisk?.tier ? [`inherent-risk:${form.inherentRisk.tier}`] : []),
      ...(form.riskAssessmentRequired ? ['risk-assessment-required'] : []),
      ...(form.supplierOnboardingRequired ? ['supplier-onboarding-required'] : []),
    ],
    matchingRiskAssessmentIds: (form.matchingRiskAssessments ?? []).map((r) => r.id),
  };
}

const FORM = {
  buyingChannelSlug: 'procurement-led',
  buyingChannelResult: 'Procurement-Led Sourcing',
  matchedRuleName: 'High-value consulting',
  sraStatus: 'Acme: expired (expires 2026-01-01)',
  policyChecks: [{ label: 'Competitive sourcing', passed: true, detail: '' }],
  duplicateCheck: null,
  materiality: { material: true, criticality: 'important' },
  inherentRisk: { tier: 'high' },
  riskAssessmentRequired: true,
  supplierOnboardingRequired: false,
  matchingRiskAssessments: [{ id: 'RA-7' }],
};
const rec = buildIntakeRecord(FORM, 'REQ-X', '2026-08-27T09:00:00Z');
check('the record carries the channel SLUG, not the label',
  rec.buyingChannel.channel === 'procurement-led');
check('the label is kept separately for display',
  rec.buyingChannel.label === 'Procurement-Led Sourcing');
check('the matched rule is the stated reasoning', rec.buyingChannel.reasoning.includes('High-value consulting'));
check('an expired SRA is a warning, not a pass', rec.sraCheck.status === 'warning');
check('risk flags carry materiality and the inherent tier',
  rec.riskFlags.includes('material') && rec.riskFlags.includes('inherent-risk:high'));
check('a required risk assessment is flagged', rec.riskFlags.includes('risk-assessment-required'));
check('reusable assessments are linked', rec.matchingRiskAssessmentIds.join() === 'RA-7');
check('no rule matched says so rather than naming one',
  buildIntakeRecord({ ...FORM, matchedRuleName: undefined }, 'R', 'n')
    .buyingChannel.reasoning.includes('value-band fallback'));

console.log('\nThe channel is stored as a slug');
// requests.buying_channel was written as the display label, so
// getStagesForChannel — which keys on slugs — always missed and returned the
// full lifecycle, meaning no stage was ever marked skipped for the channel.
const STAGES_BY_CHANNEL = {
  catalogue: ['intake', 'approval', 'po', 'receipt', 'invoice', 'payment'],
  'procurement-led': ['intake','validation','approval','sourcing','contracting','po','receipt','invoice','payment'],
};
const FULL = STAGES_BY_CHANNEL['procurement-led'];
const getStagesForChannel = (c) => STAGES_BY_CHANNEL[c] ?? FULL;
check('the slug resolves the channel\'s real stage list',
  getStagesForChannel('catalogue').length === 6);
check('the display label does not resolve — the old bug',
  getStagesForChannel('Procurement-Led Sourcing') === FULL);
check('catalogue correctly skips validation',
  !getStagesForChannel('catalogue').includes('validation'));

console.log('\nCompliance thresholds come from the policy config');
const policy = { delegatedAuthorityThreshold: 500000, competitiveSourcingThreshold: 25000 };
const budgetCheck = (v, p) => (v > p.delegatedAuthorityThreshold ? 'warning' : 'pass');
const sourcingCheck = (v, p) => (v >= p.competitiveSourcingThreshold ? 'pass' : 'info');
check('above delegated authority warns', budgetCheck(600000, policy) === 'warning');
check('at the threshold does not warn', budgetCheck(500000, policy) === 'pass');
check('competitive sourcing applies at the threshold', sourcingCheck(25000, policy) === 'pass');
// The point of moving these off literals: an admin lowering the threshold must
// change the report too, or Admin and the report disagree about the same rule.
check('lowering the configured threshold changes the verdict',
  budgetCheck(300000, { ...policy, delegatedAuthorityThreshold: 250000 }) === 'warning');

console.log('\nRisk is a conditional stage');
// The intake wizard computed riskAssessmentRequired, showed an amber banner
// promising "it appears as a step in the workflow", and discarded it. Risk was
// not a RequestStatus, not in any template, and not in either lifecycle array.
const riskNeeded = newStore();
advanceInstance(WF001, 'n1', undefined, riskNeeded, false, { riskRequired: true });
const rNeed = advanceInstance(WF001, 'n3', 'completed', riskNeeded, true, { riskRequired: true });
check('a request needing risk lands on the risk stage', riskNeeded.request.status === 'risk',
  `got ${riskNeeded.request.status}`);
check('the risk stage gates', rNeed.status === 'suspended' && rNeed.at[0] === 'n14');
check('entering it raises an assessment', riskNeeded.riskAssessmentsRaised === 1);
check('the stage is owned by third-party risk', riskNeeded.request.ownerId === 'u4');

const riskSkipped = newStore();
advanceInstance(WF001, 'n1', undefined, riskSkipped, false, { riskRequired: false });
advanceInstance(WF001, 'n3', 'completed', riskSkipped, true, { riskRequired: false });
check('a request not needing risk skips the stage entirely',
  riskSkipped.request.status === 'approval', `got ${riskSkipped.request.status}`);
check('no assessment is raised for it', riskSkipped.riskAssessmentsRaised === 0);
check('and no risk row appears in its history',
  !riskSkipped.stageHistory.some((h) => h.stage === 'risk'));

// Completing risk continues to approval, and does not raise a second assessment.
const rAfter = advanceInstance(WF001, 'n14', 'completed', riskNeeded, true, { riskRequired: true });
check('completing risk moves on to approval', riskNeeded.request.status === 'approval');
check('the risk row is closed',
  riskNeeded.stageHistory.find((h) => h.stage === 'risk').completedAt !== null);
check('approval suspends after risk', rAfter.status === 'suspended');
check('only one assessment was ever raised', riskNeeded.riskAssessmentsRaised === 1);

console.log('\nRisk edge conditions');
check('"Risk required" fires only when the flag is set',
  edgeMatches('Risk required', undefined, { riskRequired: true }) &&
  !edgeMatches('Risk required', undefined, { riskRequired: false }));
check('"Skip risk" is the catch-all', edgeMatches('Skip risk', undefined, { riskRequired: false }));
// An absent flag must not route a request into risk it was never triaged for.
check('a missing flag skips risk rather than assuming it',
  !edgeMatches('Risk required', undefined, {}) && edgeMatches('Skip risk', undefined, {}));
check('"Risk Assessment" normalises to the risk status', nodeToStatus('Risk Assessment') === 'risk');

// ── the no-template fallback ────────────────────────────────────────────────
// It used to create an instance with template_id='fallback:<channel>', which
// getWorkflowTemplate can never resolve. advanceWorkflow returns early on an
// unresolvable template, and the Complete-stage action only takes its own
// no-instance path when there is NO instance — so the button found the row,
// did nothing, and reported success. No instance is strictly better than one
// that can never move.
console.log('\nNo-template fallback');
function initFallbackWorkflow(store, channel) {
  const stages = getStagesForChannel(channel);
  transitionStage(store, stages[0] ?? 'intake', undefined);
  return { instanceCreated: false };
}
const s6 = newStore();
s6.request = { ...s6.request, status: 'intake' };
const fb = initFallbackWorkflow(s6, 'catalogue');
check('the fallback creates no workflow instance', fb.instanceCreated === false);
check('the fallback still records the stage (history, not a bare status write)',
  s6.stageHistory.length === 1 && s6.stageHistory[0].stage === 'intake');
check('an unassigned stage stays unassigned rather than defaulting an owner',
  s6.stageHistory[0].ownerId === 'u9');

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
