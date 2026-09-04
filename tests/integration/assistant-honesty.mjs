#!/usr/bin/env node
// The assistant never claims it did something it did not do.
//
// Reported: typing "I need to buy business consultant" into the assistant
// answered
//
//     "Your request has been routed to the procurement demand workflow.
//      We'll begin the process to acquire a business consultant for you."
//
// Nothing was routed. Nobody began anything. No record existed — a pre-filled
// form had been offered, and that is all. The requester reads that sentence and
// stops: they believe the work is in hand.
//
// Two causes, both fixed here:
//
//   1. `start_demand` returned `{ category, deepLinkReady: true }`. That gives a
//      model nothing to ground a closing sentence on, so it invented a
//      plausible one. The result now states what happened — created: false,
//      routed: false — in terms the model can only paraphrase truthfully.
//   2. The offline action path said "Task created and routed to the relevant
//      team. Reference: ACT-1234. You'll be notified when they respond." for
//      six action types that push to an in-memory array with no consumer.
//
// A prompt rule is a request, not a mechanism, so there is also a deterministic
// guard on the demand path. This suite pins all three.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { claimsWorkAlreadyDone, demandOfferedMessage } from '../../api/chat.ts';

let failures = 0;
const check = (label, fn) => {
  try { fn(); console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (error) { failures++; console.error(`  \x1b[31m✗\x1b[0m ${label} — ${error.message.split('\n')[0]}`); }
};

// Comments are stripped before scanning: this change is documented by quoting
// the sentences it removed, and a quotation must not read as the sentence still
// being in the code.
const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');
const read = (path) => stripComments(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));
const CHAT_SRC = read('api/chat.ts');
const ACTION_SRC = read('src/lib/assistant/capabilities/action.ts');

// ── The guard catches what was actually said ────────────────────────────────

console.log('\nA claim that work has begun is caught');

// The reported sentence, verbatim, in both apostrophe forms a model may emit.
const REPORTED = [
  "Your request has been routed to the procurement demand workflow. We'll begin the process to acquire a business consultant for you.",
  'Your request has been routed to the procurement demand workflow. We will begin the process to acquire a business consultant for you.',
];
for (const [i, sentence] of REPORTED.entries()) {
  check(`the reported reply is rejected (${i + 1})`, () => {
    assert.equal(claimsWorkAlreadyDone(sentence), true);
  });
}

check('other completion claims are rejected too', () => {
  for (const claim of [
    "I've created the request for you.",
    'The request was submitted and is now with Procurement.',
    'Your request is now in the sourcing queue.',
    'I have raised this for you.',
    'It was routed to the demand workflow.',
    'We will start the sourcing process.',
    'Your request has been logged.',
  ]) {
    assert.equal(claimsWorkAlreadyDone(claim), true, claim);
  }
});

console.log('\nTruthful answers are left alone');

check('offering, explaining and describing policy all pass', () => {
  for (const honest of [
    "I've prepared a pre-filled consulting request — open it below, add anything missing and submit it when you're ready.",
    'Open the New Request wizard below to complete this. You can submit it from there.',
    'Procurement-led sourcing typically takes about 30 days once submitted.',
    'You will need a full request; the form below is pre-filled.',
    'Requests above EUR 100,000 are routed to procurement-led sourcing.',
    'This category is normally started by the business.',
    'A catalogue order needs no new sourcing exercise.',
  ]) {
    assert.equal(claimsWorkAlreadyDone(honest), false, honest);
  }
});

check('the replacement says what is actually true, and what is not', () => {
  const message = demandOfferedMessage('consulting');
  assert.match(message, /pre-filled/i);
  assert.match(message, /nothing is created or sent/i);
  // The replacement must not itself trip the guard.
  assert.equal(claimsWorkAlreadyDone(message), false);
});

// ── The tool result gives the model nothing to invent from ─────────────────

console.log('\nThe demand tool reports what happened, not that a link exists');

check('start_demand states created/submitted/routed as false', () => {
  assert.match(CHAT_SRC, /created:\s*false/);
  assert.match(CHAT_SRC, /submitted:\s*false/);
  assert.match(CHAT_SRC, /routed:\s*false/);
  // The thin result that caused this.
  assert.equal(/deepLinkReady:\s*true/.test(CHAT_SRC), false);
});

check('the tool description says it creates nothing', () => {
  assert.match(CHAT_SRC, /creates nothing and submits nothing/i);
});

check('the system prompt forbids claiming work was done', () => {
  assert.match(CHAT_SRC, /NEVER claim that something was done/);
  // create_ticket is the one tool that really does create something; the rule
  // must not forbid it saying so.
  assert.match(CHAT_SRC, /exception is create_ticket/);
});

check('the guard is applied on both emit paths, not just one', () => {
  assert.equal((CHAT_SRC.match(/claimsWorkAlreadyDone\(/g) ?? []).length >= 3, true);
  // Narrow by design: only where a demand deep link was offered.
  assert.match(CHAT_SRC, /demandCategory && claimsWorkAlreadyDone/);
});

// ── The offline path claims nothing either ─────────────────────────────────

console.log('\nThe offline action path claims nothing it did not do');

check('no "task created and routed" for actions that reach no system', () => {
  assert.equal(/Task created and routed to the relevant team/.test(ACTION_SRC), false);
  assert.equal(/You'll be notified when they respond/.test(ACTION_SRC), false);
});

check('it says nothing was sent, and where to go instead', () => {
  assert.match(ACTION_SRC, /nothing has been sent/i);
  assert.match(ACTION_SRC, /raise it directly with them/i);
});

check('read-backs stop promising routing and notification', () => {
  assert.equal(/A task will be routed to the Vendor Management team/.test(ACTION_SRC), false);
  assert.equal(/The contract owner will be notified/.test(ACTION_SRC), false);
  assert.equal(/Procurement Operations will be notified/.test(ACTION_SRC), false);
});

console.log(
  failures === 0
    ? '\nAll assistant-honesty checks passed.'
    : `\n${failures} assistant-honesty check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
