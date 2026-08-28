#!/usr/bin/env node
// The deterministic answer judge.
//
// The intake chat had no validation of any kind: whatever the requester typed
// went into the slot, so "bla" became the objective of a EUR 500k consulting
// engagement and "blub" its scope — and the risk assessment, the sourcing event
// and the contract request all read that downstream.
//
// This is the judge that runs when the assistant is unavailable, and the floor
// the whole feature is tested against. It is deliberately conservative: a false
// accept costs a flagged section a reviewer can still see, a false reject argues
// with a requester who answered honestly.
//
// Self-contained — mirrors src/lib/procurement/answer-quality.ts. Keep in sync.
// Run: npm run test:answer-quality

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

const FILLER = new Set([
  'bla', 'blabla', 'blablabla', 'blub', 'blah', 'blahblah',
  'asdf', 'asdfasdf', 'qwerty', 'test', 'testing', 'tbd', 'tba', 'n/a', 'na',
  'none', 'nothing', 'idk', 'dunno', 'xxx', 'yyy', 'zzz', 'foo', 'bar', 'baz',
  'dfd', 'dfdf', 'dsd', 'dsdsd', 'bli', 'blib', '-', '--', '.', '..', '...',
]);
const TERSE_OK = new Set(['value', 'deliveryDate', 'title']);
const MIN_WORDS = 3;
const words = (t) => t.split(/\s+/).filter(Boolean);
const letters = (t) => t.replace(/[^a-z]/gi, '');
function looksLikeMash(token) {
  const t = token.toLowerCase();
  // Alphabetic tokens only: "150k" has no vowels and is a valid budget.
  if (!/^[a-z]+$/.test(t)) return false;
  if (t.length < 4) return false;
  if (!/[aeiou]/.test(t)) return true;
  return /[bcdfghjklmnpqrstvwxz]{5,}/.test(t);
}
function assessAnswer(answer, slot) {
  const text = (answer ?? '').trim();
  if (!text) return { addresses: false, reason: 'nothing was entered' };
  const w = words(text);
  const normalised = text.toLowerCase().replace(/[^a-z0-9\s/]/gi, '').trim();
  if (w.length > 0 && w.every((t) => FILLER.has(t.toLowerCase().replace(/[^a-z0-9/.-]/gi, '')))) {
    return { addresses: false, reason: 'that looks like placeholder text' };
  }
  if (FILLER.has(normalised)) return { addresses: false, reason: 'that looks like placeholder text' };
  if (slot && !TERSE_OK.has(slot.id) && letters(text).length < 3) {
    return { addresses: false, reason: 'that has no wording in it' };
  }
  if (w.length > 0 && w.every(looksLikeMash)) {
    return { addresses: false, reason: 'that does not read as words' };
  }
  if (slot && normalised.length > 0) {
    const q = slot.prompt.toLowerCase().replace(/[^a-z0-9\s]/gi, '').trim();
    if (q && (normalised === q || (normalised.length > 12 && q.includes(normalised)))) {
      return { addresses: false, reason: 'that repeats the question back' };
    }
  }
  if (slot && !TERSE_OK.has(slot.id) && w.length < MIN_WORDS) {
    return { addresses: false, reason: 'that is too short to describe it' };
  }
  return { addresses: true };
}

const objective = { id: 'objective', prompt: "What's the primary objective of this engagement?" };
const scope = { id: 'scope', prompt: 'What should be in scope — and anything explicitly out of scope?' };
const value = { id: 'value', prompt: "What's the estimated budget for this?" };
const date = { id: 'deliveryDate', prompt: 'When do you need this delivered or started by?' };

console.log('The reported answers are rejected');
// Verbatim from the screenshot.
for (const junk of ['bla', 'blub', 'dfdf', 'dsdsd', 'bli', 'dfd']) {
  check(`"${junk}" does not address the question`, assessAnswer(junk, objective).addresses === false);
}
check('"bla bla bla" is rejected too', assessAnswer('bla bla bla', objective).addresses === false);
check('and the reason names the gap, not the rule',
  /placeholder/.test(assessAnswer('bla', objective).reason ?? ''), assessAnswer('bla', objective).reason);
check('an empty answer is rejected', assessAnswer('', objective).addresses === false);
check('"tbd" is rejected', assessAnswer('tbd', scope).addresses === false);
check('a keyboard mash is rejected', assessAnswer('sdfghjkl', objective).addresses === false);
check('punctuation only is rejected', assessAnswer('...', objective).addresses === false);
check('echoing the question back is rejected',
  assessAnswer("What's the primary objective of this engagement?", objective).addresses === false);

console.log('\nReal answers are accepted');
const real = [
  'define a target operating model for the finance function',
  'reduce manual reconciliation effort across the shared service centre',
  'in: assessment and design; out: implementation and licences',
  'a short review of our supplier onboarding process',
];
for (const a of real) {
  check(`"${a.slice(0, 42)}…" is accepted`, assessAnswer(a, objective).addresses === true,
    assessAnswer(a, objective).reason);
}
// The rule must not argue with a requester who answered honestly but briefly.
check('a three-word real answer is accepted',
  assessAnswer('improve procurement cycle times', objective).addresses === true);

console.log('\nThe floor is slot-aware');
// A budget and a date are legitimately terse; demanding a sentence of those
// would be the rule rejecting a correct answer.
check('"150k" is a fine budget', assessAnswer('150k', value).addresses === true);
check('"end of Q3" is a fine date', assessAnswer('end of Q3', date).addresses === true);
check('but two words is not an objective',
  assessAnswer('some consulting', objective).addresses === false);
// Filler is filler whatever the slot.
check('"bla" is still rejected for a terse slot', assessAnswer('bla', value).addresses === false);

console.log('\nNo false rejections from substring matching');
// "bla" is filler; "blackout" is a word. Exact-match only.
check('"blackout dates over the holiday period" is accepted',
  assessAnswer('blackout dates over the holiday period', scope).addresses === true);
check('"testing environments for the new platform" is accepted',
  assessAnswer('testing environments for the new platform', scope).addresses === true,
  assessAnswer('testing environments for the new platform', scope).reason);
check('a slotless call still catches filler', assessAnswer('bla').addresses === false);
check('a slotless call accepts real prose',
  assessAnswer('a target operating model for finance').addresses === true);

console.log('');
if (failures) console.error(`FAILED: ${failures} check(s)`);
else console.log('All answer-quality checks passed.');
process.exit(failures === 0 ? 0 : 1);
