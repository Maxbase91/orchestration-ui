#!/usr/bin/env node
// The request screen shows what the request actually is.
//
// Three faults, each on a different tab:
//
//   Workflow rendered all eleven LIFECYCLE_STAGES for every request. A route
//   that never visits a stage still got a stripped grey card carrying a label
//   and nothing else, so a catalogue order — which traverses six — showed five
//   placeholders for things that will never happen.
//
//   Compliance never named the contract. The requisition carries the contract
//   the spend was called off against and the evidence the match was checked;
//   there was no read path for that table at all, so the tab whose job is to
//   justify the decision could not mention it.
//
//   Activity took no comments. The only composer in the app was mounted on the
//   Workflow tab's current-stage card, and only while that stage was open, so a
//   completed request could not be commented on and the tab actually labelled
//   for comments had no way to add one.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getStagesForChannel } from '../../src/lib/workflow/channel-stages.ts';
import { channelStageMapFromTemplates } from '../../src/lib/workflow/channel-stages.ts';
import { workflowTemplates } from '../../src/data/workflows.ts';
// The lifecycle comes from the templates now — buying-channel-stages.ts is
// deleted. Derived once here rather than restated, which is the point.
const CHANNEL_STAGES = channelStageMapFromTemplates(workflowTemplates);


let failures = 0;
const check = (label, fn) => {
  try { fn(); console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (error) { failures++; console.error(`  \x1b[31m✗\x1b[0m ${label} — ${error.message.split('\n')[0]}`); }
};
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const read = (path) => stripComments(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));

console.log('\nWorkflow shows the stages this route runs');

const workflow = read('src/features/requests/request-detail/tab-workflow.tsx');
check('the stage list is filtered before it is mapped', () => {
  assert.match(workflow, /stagesForThisRoute/, 'all eleven stages are still rendered');
  assert.match(workflow, /isStageSkippedForChannel\(channelStageMap, request\.buyingChannel/,
    'the filter does not consult the channel and the template-derived map');
});
check('a stage the request actually visited is kept', () => {
  // A referred-back or re-routed request visited a stage its channel no longer
  // lists; dropping that row would erase history rather than tidy it.
  assert.match(workflow, /stageEntries\.has\(stage\.id\)/, 'history is not consulted');
});
check('the current stage is always kept', () => {
  assert.match(workflow, /request\.status === stage\.id/, 'a request could hide its own stage');
});
check('a catalogue order really has fewer stages than the union', () => {
  const catalogue = getStagesForChannel(CHANNEL_STAGES, 'catalogue');
  assert.ok(catalogue.length < 11, `catalogue traverses ${catalogue.length}`);
  assert.ok(!catalogue.includes('sourcing'), 'catalogue should not visit sourcing');
});

console.log('\nThe sourcing event is reachable from the stage running it');

check('the sourcing stage links to its event', () => {
  assert.match(workflow, /useSourcingEventsForRequest/, 'the tab does not read the events');
  assert.match(workflow, /\/sourcing\/\$\{event\.id\}/, 'no link to the event');
});

console.log('\nCompliance names the contract and its evidence');

const compliance = read('src/features/requests/request-detail/tab-compliance.tsx');
check('there is a read path for the requisition', () => {
  const module = read('src/lib/db/purchase-requisitions.ts');
  assert.match(module, /export async function getRequisitionForRequest/);
});
check('the tab reads it', () => {
  assert.match(compliance, /useRequisitionForRequest/, 'the requisition is never read');
});
check('it shows the contract called off against', () => {
  assert.match(compliance, /Called off against/);
});
check('it shows the match evidence that was stored', () => {
  assert.match(compliance, /contractScopeVersionId/, 'the scope version is not shown');
  assert.match(compliance, /contractMatchScore/, 'the match score is not shown');
  assert.match(compliance, /contractMatchReasons/, 'the reasons are not shown');
});
check('a check that did not run says so rather than showing blank', () => {
  assert.match(compliance, /not-evaluated/, 'an unevaluated coverage check renders as empty');
  assert.match(compliance, /Did not run/);
});
check('a requisition alone is enough to render the tab', () => {
  // Catalogue orders often have no compliance report; without this they showed
  // the empty state on the tab that explains their governance.
  assert.match(compliance, /\|\| requisition;/, 'the empty-state guard ignores the requisition');
});

console.log('\nActivity takes comments');

const activity = read('src/features/requests/request-detail/tab-activity.tsx');
check('the composer is mounted on the tab named for it', () => {
  assert.match(activity, /StageCommentComposer/, 'the comments tab still cannot take a comment');
});
check('it reuses the existing composer rather than a second one', () => {
  assert.match(activity, /from '\.\/components\/stage-comment-composer'/);
});
check('a closed request reads but does not take new comments', () => {
  assert.match(activity, /isTerminal/, 'a cancelled request still invites comment');
});

if (failures > 0) { console.error(`\nrequest-tabs: ${failures} check(s) failed.`); process.exit(1); }
console.log('\nRequest tab checks passed.');
