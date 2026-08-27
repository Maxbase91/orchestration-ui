#!/usr/bin/env node
// Verifies the sourcing evaluation and award rules, and the two query-level
// boundaries the sourcing module depends on.
//
// The security-shaped rule is asserted first: a supplier sees only their own
// invitation, and never the event's criteria weights or budget. Both are
// enforced in the query rather than a component — RLS is "allow all", so a
// component-level filter would be a display convention.
//
// Self-contained — mirrors src/lib/procurement/sourcing-award.ts and the query
// semantics of src/lib/db/sourcing-responses.ts. Keep in sync.
// Run: node tests/integration/sourcing.mjs

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

// ── mirrors sourcing-award.ts ───────────────────────────────────────────────
const REQUIRED_CRITERIA_WEIGHT_TOTAL = 100;

function calcWeightedTotal(scores, criteria) {
  let totalWeight = 0, weightedSum = 0;
  for (const c of criteria) {
    weightedSum += (scores[c.id] ?? 0) * c.weight;
    totalWeight += c.weight;
  }
  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0;
}
const criteriaWeightTotal = (criteria) => criteria.reduce((s, c) => s + c.weight, 0);
const areCriteriaWeightsValid = (criteria) => criteriaWeightTotal(criteria) === REQUIRED_CRITERIA_WEIGHT_TOTAL;

function rankResponses(candidates) {
  return candidates
    .filter((c) => c.status === 'responded' && c.shortlisted)
    .sort((a, b) => {
      const byScore = (b.weightedTotal ?? 0) - (a.weightedTotal ?? 0);
      if (byScore !== 0) return byScore;
      const byPrice = (a.price ?? Infinity) - (b.price ?? Infinity);
      if (byPrice !== 0) return byPrice;
      return a.supplierName.localeCompare(b.supplierName);
    });
}

const AWARDABLE_EVENT_STATUSES = ['published', 'in-evaluation', 'award-pending'];
function canAward(event, candidates, responseId) {
  if (!AWARDABLE_EVENT_STATUSES.includes(event.status)) return { allowed: false, blocker: 'event-not-live' };
  if (event.awardedSupplierId) return { allowed: false, blocker: 'already-awarded' };
  const eligible = rankResponses(candidates);
  if (eligible.length === 0) return { allowed: false, blocker: 'no-eligible-responses' };
  if (!eligible.some((c) => c.id === responseId)) return { allowed: false, blocker: 'response-not-eligible' };
  return { allowed: true };
}
const awardWriteBack = (w) => ({ supplierId: w.supplierId, supplierName: w.supplierName });

// ── fixtures ────────────────────────────────────────────────────────────────
const CRITERIA = [
  { id: 'c1', label: 'Technical', weight: 40 },
  { id: 'c2', label: 'Price', weight: 30 },
  { id: 'c3', label: 'Experience', weight: 30 },
];

const RESPONSES = [
  { id: 'r1', eventId: 'SRC-0002', supplierId: 'SUP-001', supplierName: 'Alpha', status: 'responded', shortlisted: true,  weightedTotal: 4.2, price: 100000 },
  { id: 'r2', eventId: 'SRC-0002', supplierId: 'SUP-003', supplierName: 'Bravo', status: 'responded', shortlisted: true,  weightedTotal: 4.5, price: 120000 },
  { id: 'r3', eventId: 'SRC-0002', supplierId: 'SUP-005', supplierName: 'Delta', status: 'responded', shortlisted: false, weightedTotal: 4.9, price: 90000 },
  { id: 'r4', eventId: 'SRC-0002', supplierId: 'SUP-007', supplierName: 'Echo',  status: 'not-viewed', shortlisted: true },
  { id: 'r5', eventId: 'SRC-0003', supplierId: 'SUP-001', supplierName: 'Alpha', status: 'viewed',    shortlisted: true },
];

// mirrors listInvitationsForSupplier — the .eq() IS the entitlement
const listInvitationsForSupplier = (supplierId) => RESPONSES.filter((r) => r.supplierId === supplierId);
const listResponsesForEvent = (eventId) => RESPONSES.filter((r) => r.eventId === eventId);

console.log('Entitlement — a supplier sees only their own invitations');
const alpha = listInvitationsForSupplier('SUP-001');
check('scoped to the supplier', alpha.every((r) => r.supplierId === 'SUP-001'));
check('spans their events', new Set(alpha.map((r) => r.eventId)).size === 2);
check('cannot see another supplier\'s response', !alpha.some((r) => r.supplierName === 'Bravo'));
check('an uninvited supplier gets nothing', listInvitationsForSupplier('SUP-999').length === 0);
check('the invitation row carries no criteria or budget',
  alpha.every((r) => !('criteria' in r) && !('budget' in r) && !('weight' in r)));

console.log('\nCriteria weights');
check('weights totalling 100 are valid', areCriteriaWeightsValid(CRITERIA));
check('weights totalling 90 are not', !areCriteriaWeightsValid([{ id: 'c1', label: 'x', weight: 90 }]));
check('weights totalling 110 are not',
  !areCriteriaWeightsValid([...CRITERIA, { id: 'c4', label: 'extra', weight: 10 }]));

console.log('\nWeighted scoring');
check('all-5s scores 5', calcWeightedTotal({ c1: 5, c2: 5, c3: 5 }, CRITERIA) === 5);
check('unscored criteria count as zero', calcWeightedTotal({ c1: 5 }, CRITERIA) === 2);
check('weights actually weight', calcWeightedTotal({ c1: 5, c2: 1, c3: 1 }, CRITERIA) === 2.6);
check('no criteria → 0, no divide-by-zero', calcWeightedTotal({ c1: 5 }, []) === 0);

console.log('\nRanking');
const ranked = rankResponses(listResponsesForEvent('SRC-0002'));
check('best weighted score leads', ranked[0]?.id === 'r2');
check('an eliminated supplier never ranks, however good its score',
  !ranked.some((r) => r.id === 'r3'));
check('a supplier who never responded never ranks', !ranked.some((r) => r.id === 'r4'));
check('only eligible responses are returned', ranked.length === 2);
check('ties break on the lower price', (() => {
  const tied = rankResponses([
    { id: 'a', supplierName: 'Aaa', status: 'responded', shortlisted: true, weightedTotal: 4, price: 200 },
    { id: 'b', supplierName: 'Bbb', status: 'responded', shortlisted: true, weightedTotal: 4, price: 100 },
  ]);
  return tied[0].id === 'b';
})());

console.log('\nAward gates');
const live = { status: 'published' };
check('the top-ranked response can be awarded', canAward(live, listResponsesForEvent('SRC-0002'), 'r2').allowed);
check('a non-top but eligible response can also be awarded (buyer judgement)',
  canAward(live, listResponsesForEvent('SRC-0002'), 'r1').allowed);
check('an eliminated response cannot be awarded',
  canAward(live, listResponsesForEvent('SRC-0002'), 'r3').blocker === 'response-not-eligible');
check('an unsubmitted response cannot be awarded',
  canAward(live, listResponsesForEvent('SRC-0002'), 'r4').blocker === 'response-not-eligible');
check('a completed event cannot be awarded',
  canAward({ status: 'completed' }, listResponsesForEvent('SRC-0002'), 'r2').blocker === 'event-not-live');
check('an already-awarded event cannot be awarded again',
  canAward({ status: 'published', awardedSupplierId: 'SUP-003' }, listResponsesForEvent('SRC-0002'), 'r1')
    .blocker === 'already-awarded');
check('an event with no submitted responses cannot be awarded',
  canAward(live, listResponsesForEvent('SRC-0003'), 'r5').blocker === 'no-eligible-responses');

console.log('\nWrite-back');
const patch = awardWriteBack(ranked[0]);
check('request inherits the winning supplier id', patch.supplierId === 'SUP-003');
check('request inherits the winning supplier name', patch.supplierName === 'Bravo');
check('write-back is idempotent', JSON.stringify(patch) === JSON.stringify(awardWriteBack(ranked[0])));

// ── mirrors the award write sequence in sourcing-responses.awardResponse ────
// Three tables, no transaction. The order matters: the irreversible flag lands
// first, and everything after it must be replayable — which is what makes the
// "Re-apply award to request" repair safe.
function awardSequence(event, responses, responseId, store) {
  const check = canAward(event, responses, responseId);
  if (!check.allowed) return { ok: false, blocker: check.blocker };
  const winner = responses.find((r) => r.id === responseId);

  store.responses = store.responses.map((r) => (r.id === responseId ? { ...r, awarded: true } : r));
  store.event = { ...event, status: 'completed', awardDate: '2026-08-27', awardedSupplierId: winner.supplierId };
  if (event.requestId) applyAwardToRequest(event.requestId, winner, store);
  return { ok: true };
}

const POST_SOURCING_STATUS = 'contracting';

function applyAwardToRequest(requestId, winner, store) {
  store.request = { ...store.request, id: requestId, ...awardWriteBack(winner) };
  store.stageHistory = [...store.stageHistory, { requestId, stage: 'sourcing', action: 'awarded' }];
  // Two paths. advanceWorkflow no-ops without an instance, and the ENGINE is
  // what writes the status — so without the fallback the award closed the event,
  // wrote the supplier, and left the request parked in `sourcing`. Found by
  // awarding SRC-0007 against the live database; 93 of 101 requests have no
  // instance, so the fallback is the common path, not the edge case.
  if (store.workflowInstance) {
    store.advanced = [...store.advanced, { requestId, outcome: 'awarded' }];
    store.request = { ...store.request, status: 'contracting' }; // engine writes it
  } else {
    store.request = { ...store.request, status: POST_SOURCING_STATUS };
  }
}

const newStore = (workflowInstance = false) => ({
  responses: listResponsesForEvent('SRC-0002').map((r) => ({ ...r, awarded: false })),
  event: null,
  request: { id: 'REQ-2024-0015', supplierId: null, supplierName: null, status: 'sourcing' },
  stageHistory: [],
  advanced: [],
  workflowInstance,
});

console.log('\nAward sequence');
const liveEvent = { id: 'SRC-0002', status: 'published', requestId: 'REQ-2024-0015' };

const blocked = newStore();
const blockedResult = awardSequence(liveEvent, blocked.responses, 'r3', blocked);
check('a blocked award writes nothing at all',
  !blockedResult.ok &&
  blocked.responses.every((r) => !r.awarded) &&
  blocked.event === null &&
  blocked.request.supplierId === null &&
  blocked.stageHistory.length === 0);

const store = newStore();
check('awarding the ranked leader is allowed', awardSequence(liveEvent, store.responses, 'r2', store).ok);
check('exactly one response is flagged awarded',
  store.responses.filter((r) => r.awarded).length === 1);
check('the flagged response is the winner', store.responses.find((r) => r.awarded).id === 'r2');
check('the event is closed and stamped', store.event.status === 'completed' && store.event.awardedSupplierId === 'SUP-003');
check('award_date is a DATE, not a timestamp', /^\d{4}-\d{2}-\d{2}$/.test(store.event.awardDate));
check('the request inherits the winning supplier', store.request.supplierId === 'SUP-003');
check('the stage timeline records the award', store.stageHistory.at(-1).action === 'awarded');
check('the request leaves the sourcing stage', store.request.status === 'contracting');

console.log('\nThe award always moves the request on');
// Regression: awarding SRC-0007 live wrote the supplier and closed the event but
// left the request in `sourcing`, because advanceWorkflow returns early when
// there is no instance and the engine is what writes the status.
const withInstance = newStore(true);
awardSequence(liveEvent, withInstance.responses, 'r2', withInstance);
check('with a workflow instance: the engine is asked to advance',
  withInstance.advanced.at(-1).outcome === 'awarded');
check('with a workflow instance: the request leaves sourcing',
  withInstance.request.status === 'contracting');

const noInstance = newStore(false);
awardSequence(liveEvent, noInstance.responses, 'r2', noInstance);
check('without an instance: the engine is NOT called',
  noInstance.advanced.length === 0);
check('without an instance: the request still leaves sourcing',
  noInstance.request.status === 'contracting');
check('an awarded request is never left parked in sourcing',
  [withInstance, noInstance].every((s) => s.request.status !== 'sourcing'));
check('either way the supplier is written back',
  [withInstance, noInstance].every((s) => s.request.supplierId === 'SUP-003'));

// A second award is refused twice over: the award closes the event, so the
// status check fires first, and awardedSupplierId would refuse it even if the
// event were somehow reopened. Both land before the partial unique index does.
check('a second award on the same event is refused',
  !canAward(store.event, store.responses, 'r1').allowed);
check('the closed event is what refuses it first',
  canAward(store.event, store.responses, 'r1').blocker === 'event-not-live');
check('a reopened but already-awarded event is still refused',
  canAward({ ...store.event, status: 'published' }, store.responses, 'r1').blocker === 'already-awarded');

console.log('\nRe-apply repair (the write-back tail is idempotent)');
const repaired = newStore();
awardSequence(liveEvent, repaired.responses, 'r2', repaired);
const afterFirst = JSON.stringify(repaired.request);
applyAwardToRequest('REQ-2024-0015', repaired.responses.find((r) => r.awarded), repaired);
check('re-applying leaves the same request patch', JSON.stringify(repaired.request) === afterFirst);
check('re-applying does not re-flag or un-flag the award',
  repaired.responses.filter((r) => r.awarded).length === 1);
// A half-applied award is exactly the state the repair action detects.
const halfApplied = { event: { awardedSupplierId: 'SUP-003' }, request: { supplierId: null } };
const needsReapply = (e, r) => Boolean(e.awardedSupplierId && r && r.supplierId !== e.awardedSupplierId);
check('a half-applied award is detected', needsReapply(halfApplied.event, halfApplied.request));
check('a fully applied award is not flagged for repair',
  !needsReapply({ awardedSupplierId: 'SUP-003' }, { supplierId: 'SUP-003' }));

// ── mirrors nodeToStatus + the 'stage' branch of engine.executeNode ─────────
// validation/approval/sourcing are NOT node types — they are stage nodes
// discriminated by their label, which is why the label map matters as much as
// the branch does.
const LABEL_TO_STATUS = {
  'intake': 'intake', 'validation': 'validation', 'approval': 'approval',
  'sourcing': 'sourcing', 'sourcing (rfp)': 'sourcing', 'contracting': 'contracting',
};
const nodeToStatus = (label) => LABEL_TO_STATUS[label.toLowerCase().trim()] ?? label.toLowerCase().trim().replace(/\s+/g, '-');
const executeStageNode = (label) => {
  const status = nodeToStatus(label);
  if (status === 'approval') return 'suspend';
  if (status === 'sourcing') return 'suspend';
  return 'continue';
};

console.log('\nSourcing stage gate');
check('WF-001 "Sourcing" normalises to the sourcing status', nodeToStatus('Sourcing') === 'sourcing');
check('WF-004 "Sourcing (RFP)" normalises to the same status',
  nodeToStatus('Sourcing (RFP)') === 'sourcing');
// Without the label-map entry this slugified to 'sourcing-(rfp)' — an invalid
// request status that also slipped past the gate.
check('the RFP label never produces a slugified status',
  nodeToStatus('Sourcing (RFP)') !== 'sourcing-(rfp)');
check('entering sourcing suspends the engine', executeStageNode('Sourcing') === 'suspend');
check('entering sourcing (rfp) suspends the engine', executeStageNode('Sourcing (RFP)') === 'suspend');
check('approval still suspends', executeStageNode('Approval') === 'suspend');
check('validation still continues', executeStageNode('Validation') === 'continue');
check('contracting still continues', executeStageNode('Contracting') === 'continue');
// getNextNodeIds falls back to outgoing[0] when no edge label matches, and both
// sourcing nodes have a single unlabelled outgoing edge — so 'awarded' resumes.
const getNextNodeIds = (edges, outcome) => {
  const outgoing = edges;
  if (outgoing.length === 0) return [];
  const matched = outgoing.find((e) => !e.label || e.label === outcome);
  return [(matched ?? outgoing[0]).target];
};
check('an unlabelled sourcing edge resumes on the "awarded" outcome',
  getNextNodeIds([{ source: 'n6', target: 'n7' }], 'awarded')[0] === 'n7');

console.log('\nEvaluation persistence');
// The stored weighted total is recomputed from the event's criteria rather than
// trusted from the grid, so the two can never disagree.
const saveScores = (scores, criteria) => ({ scores, weighted_total: calcWeightedTotal(scores, criteria) });
const saved = saveScores({ c1: 5, c2: 3, c3: 4 }, CRITERIA);
check('the saved total is derived from the criteria', saved.weighted_total === calcWeightedTotal(saved.scores, CRITERIA));
check('a client-supplied total cannot override it', saveScores({ c1: 1, c2: 1, c3: 1 }, CRITERIA).weighted_total === 1);
check('an event with no criteria stores a zero total, not NaN',
  saveScores({ c1: 5 }, []).weighted_total === 0);
check('a non-responder is never rankable however well scored',
  !rankResponses([{ id: 'r4', supplierId: 'SUP-007', supplierName: 'Echo', status: 'not-viewed', shortlisted: true, weightedTotal: 5 }]).length);

// ── mirrors the "Active Sourcing" KPI and the pipeline page's stage mapping ─
// Both used to count/render something other than sourcing events: the KPI
// counted requests parked in the stage, the pipeline page a hardcoded SE-* array.
const isActiveSourcing = (e) => AWARDABLE_EVENT_STATUSES.includes(e.status);
const STATUS_TO_STAGE = {
  draft: 'Draft', published: 'Published', 'in-evaluation': 'In Evaluation',
  'award-pending': 'Award Pending', completed: 'Completed',
};

const KPI_EVENTS = [
  { id: 'SRC-0003', status: 'draft' },
  { id: 'SRC-0004', status: 'published' },
  { id: 'SRC-0005', status: 'in-evaluation' },
  { id: 'SRC-0006', status: 'award-pending' },
  { id: 'SRC-0007', status: 'completed' },
  { id: 'SRC-0008', status: 'cancelled' },
];

console.log('\nActive Sourcing counts events, not requests');
check('counts only live events', KPI_EVENTS.filter(isActiveSourcing).length === 3);
check('a draft event is not sourcing activity', !isActiveSourcing({ status: 'draft' }));
check('a completed event is not sourcing activity', !isActiveSourcing({ status: 'completed' }));
check('a cancelled event is not sourcing activity', !isActiveSourcing({ status: 'cancelled' }));
// The bug this replaced: six requests sat in status='sourcing' against one
// unrelated event, and the tile reported six.
const REQUESTS_IN_STAGE = 6;
check('the count is decoupled from requests parked in the stage',
  KPI_EVENTS.filter(isActiveSourcing).length !== REQUESTS_IN_STAGE);

console.log('\nPipeline stage mapping');
check('every funnel stage maps from exactly one status',
  new Set(Object.values(STATUS_TO_STAGE)).size === Object.keys(STATUS_TO_STAGE).length);
check('cancelled has no stage — it is not part of the funnel',
  STATUS_TO_STAGE['cancelled'] === undefined);
check('a cancelled event is dropped, not filed under Draft',
  KPI_EVENTS.filter((e) => STATUS_TO_STAGE[e.status]).length === KPI_EVENTS.length - 1);

console.log('\nBackfill (idempotent, seeded from the request)');
// Mirrors supabase/backfills/2026-08-27-sourcing-events.sql.
const backfill = (requests, events) =>
  requests
    .filter((r) => r.status === 'sourcing' && !events.some((e) => e.requestId === r.id))
    .map((r, i) => ({
      id: `SRC-BF-${i}`,
      requestId: r.id,
      status: 'draft',
      budget: r.value,
      type: r.value >= 250000 ? 'RFP' : 'RFQ',
      criteria: [],
    }));

const STRANDED = [
  { id: 'REQ-A', status: 'sourcing', value: 290000, supplierId: 'SUP-012' },
  { id: 'REQ-B', status: 'sourcing', value: 160000, supplierId: null },
  { id: 'REQ-C', status: 'approval', value: 500000, supplierId: null },
];
const created = backfill(STRANDED, []);
check('one event per stranded request', created.length === 2);
check('a request outside the sourcing stage is left alone',
  !created.some((e) => e.requestId === 'REQ-C'));
check('high value goes out as an RFP', created.find((e) => e.requestId === 'REQ-A').type === 'RFP');
check('lower value goes out as an RFQ', created.find((e) => e.requestId === 'REQ-B').type === 'RFQ');
check('backfilled events start as drafts, not published',
  created.every((e) => e.status === 'draft'));
// Criteria are left empty on purpose: inventing them would fabricate the basis
// of a future award, and an event with none cannot be scored.
check('no criteria are invented', created.every((e) => e.criteria.length === 0));
check('a backfilled event cannot be awarded until it is published and scored',
  canAward({ status: 'draft' }, [], created[0].id).blocker === 'event-not-live');
check('re-running the backfill creates nothing',
  backfill(STRANDED, created).length === 0);

console.log('\nInvitation idempotency (UNIQUE event_id, supplier_id)');
const key = (r) => `${r.eventId}:${r.supplierId}`;
check('no duplicate invitation exists in the set',
  new Set(RESPONSES.map(key)).size === RESPONSES.length);
check('the same supplier can be invited to different events',
  RESPONSES.filter((r) => r.supplierId === 'SUP-001').length === 2);

// ── mirrors the request -> event link and the create-action gate ────────────
// The gate is stage-based on purpose: sourcing_type only fills for requests
// created after it was added, so gating the action on it would hide the button
// on every pre-existing request — including the ones stuck in the stage.
const EVENTS = [
  { id: 'SRC-0002', requestId: 'REQ-2024-0015', status: 'published' },
  { id: 'SRC-0003', requestId: null, status: 'draft' },
];
const listEventsForRequest = (requestId) => EVENTS.filter((e) => e.requestId === requestId);
const canRaiseSourcingEvent = (request) => request.status === 'sourcing';

console.log('\nRequest link');
check('an event raised from a request resolves back to it',
  listEventsForRequest('REQ-2024-0015').map((e) => e.id).join() === 'SRC-0002');
// A standing category event (requestId null) must never surface under a real
// request. The hook is `enabled: Boolean(requestId)`, so null is never queried.
check('a standing event never surfaces under a real request',
  !listEventsForRequest('REQ-2024-0015').some((e) => e.id === 'SRC-0003'));
check('a request with no event returns empty', listEventsForRequest('REQ-9999').length === 0);

console.log('\nCreate-action gate');
check('shown in the sourcing stage', canRaiseSourcingEvent({ status: 'sourcing' }));
check('hidden in the approval stage', !canRaiseSourcingEvent({ status: 'approval' }));
check('hidden in the po stage', !canRaiseSourcingEvent({ status: 'po' }));
check('shown even when sourcingType is unset (every pre-existing request)',
  canRaiseSourcingEvent({ status: 'sourcing', sourcingType: undefined }));
check('shown even when sourcingType says none — the stage is authoritative',
  canRaiseSourcingEvent({ status: 'sourcing', sourcingType: 'none' }));

// ── mirrors the portal read + response lifecycle ────────────────────────────
// getSourcingEventForSupplier withholds buyer-side fields at the SELECT and
// returns null unless an invitation exists. Both are query-level rules — a
// component that merely declined to render them would still ship them.
const SUPPLIER_SAFE_FIELDS = ['id', 'title', 'description', 'type', 'status', 'deadline', 'requirements'];
const BUYER_ONLY_FIELDS = ['criteria', 'budget', 'budgetMin', 'awardedSupplierId', 'requestId', 'ownerId'];

function getEventForSupplier(eventId, supplierId) {
  const invited = RESPONSES.some((r) => r.eventId === eventId && r.supplierId === supplierId);
  if (!invited) return null;
  const full = {
    id: eventId, title: 'Cleaning services', description: 'd', type: 'RFP',
    status: 'published', deadline: '2026-12-01', requirements: ['r1'],
    criteria: CRITERIA, budget: 420000, budgetMin: 300000,
    awardedSupplierId: null, requestId: 'REQ-2025-0113', ownerId: 'u1',
  };
  return Object.fromEntries(SUPPLIER_SAFE_FIELDS.filter((k) => k in full).map((k) => [k, full[k]]));
}

console.log('\nPortal read — buyer-side data never leaves the query');
const supplierView = getEventForSupplier('SRC-0002', 'SUP-001');
check('an invited supplier can read the event', supplierView !== null);
check('the requirements they must answer are included', supplierView.requirements.length === 1);
for (const field of BUYER_ONLY_FIELDS) {
  check(`withholds ${field}`, !(field in supplierView));
}
check('an uninvited supplier gets null, not a redacted event',
  getEventForSupplier('SRC-0002', 'SUP-999') === null);
check('a non-existent event is indistinguishable from an uninvited one',
  getEventForSupplier('SRC-9999', 'SUP-001') === null);

console.log('\nResponse lifecycle');
const markViewed = (r) => (r.status !== 'not-viewed' ? r : { ...r, status: 'viewed' });
check('opening an invitation moves not-viewed to viewed',
  markViewed({ status: 'not-viewed' }).status === 'viewed');
check('opening a submitted response does not regress it',
  markViewed({ status: 'responded' }).status === 'responded');
check('opening an already-viewed invitation is a no-op',
  markViewed({ status: 'viewed' }).status === 'viewed');

const isClosed = (deadline, now) => (deadline ? new Date(deadline).getTime() < now : false);
const NOW = new Date('2026-08-26T12:00:00Z').getTime();
check('past the deadline the event is closed', isClosed('2026-01-01', NOW));
check('before the deadline it is open', !isClosed('2026-12-01', NOW));
check('no deadline never counts as closed', !isClosed(undefined, NOW));

console.log(failures === 0 ? '\n\x1b[32mAll checks passed\x1b[0m' : `\n\x1b[31m${failures} check(s) failed\x1b[0m`);
process.exit(failures === 0 ? 0 : 1);
