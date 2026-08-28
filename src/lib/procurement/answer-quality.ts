// Does an answer actually address the question that was asked?
//
// The intake chat had no validation of any kind: whatever the requester typed
// went straight into the slot, so "bla" became the objective and "blub" the
// scope, and the service description that the risk assessment, the sourcing
// event and the contract request all read downstream was junk that nothing
// had ever questioned.
//
// This is the DETERMINISTIC judge — the one that runs when the assistant is
// unavailable, and the floor the whole feature can be tested against. When the
// LLM is up it judges instead (it is the only thing that can tell a fluent but
// off-topic answer from a real one); this module is what stops the offline path
// from being a free pass.
//
// It is deliberately conservative. A false accept costs a flagged section that
// a reviewer can still see; a false reject argues with a requester who answered
// honestly, which is worse. Everything here is a signal of "no attempt", not a
// judgement of quality.

import type { DemandSlot } from './demand-conversation';

export interface AnswerVerdict {
  /** Does this look like a genuine attempt at the question? */
  addresses: boolean;
  /** Why not — shown to the requester, so it names the gap, not the rule. */
  reason?: string;
}

/**
 * Filler that carries no information whatever it is asked of. Kept short and
 * exact-match only: substring matching would reject "blackout dates" for
 * containing "bla".
 */
const FILLER = new Set([
  'bla', 'blabla', 'blablabla', 'blub', 'blah', 'blahblah',
  'asdf', 'asdfasdf', 'qwerty', 'test', 'testing', 'tbd', 'tba', 'n/a', 'na',
  'none', 'nothing', 'idk', 'dunno', 'xxx', 'yyy', 'zzz', 'foo', 'bar', 'baz',
  'dfd', 'dfdf', 'dsd', 'dsdsd', 'bli', 'blib', '-', '--', '.', '..', '...',
]);

/**
 * Slots that can legitimately be answered in a few words.
 *
 * A delivery date is "end of Q3" and a budget is "150k"; demanding a sentence
 * of those would be the rule arguing with a correct answer. The narrative slots
 * are the ones where a two-word reply means nothing was said.
 */
const TERSE_OK = new Set(['value', 'deliveryDate', 'title']);

/** Minimum words for a narrative slot. Three is "a phrase", not "an essay". */
const MIN_WORDS = 3;

const words = (t: string) => t.split(/\s+/).filter(Boolean);
const letters = (t: string) => t.replace(/[^a-z]/gi, '');

/**
 * Consonant runs no English word has — the signature of a keyboard mash.
 *
 * Only ever applied to purely alphabetic tokens. Anything with a digit is a
 * quantity, a code or a date fragment, and the vowel test rejects those wrongly:
 * "150k" has no vowels and is a perfectly good answer to a budget question.
 */
function looksLikeMash(token: string): boolean {
  const t = token.toLowerCase();
  if (!/^[a-z]+$/.test(t)) return false;
  if (t.length < 4) return false;
  if (!/[aeiou]/.test(t)) return true;
  return /[bcdfghjklmnpqrstvwxz]{5,}/.test(t);
}

/**
 * Assess one answer against the slot it was given for.
 *
 * `slot` is optional so a caller with only the raw text still gets the
 * content-free checks; pass it to get the slot-aware length floor.
 */
export function assessAnswer(answer: string, slot?: DemandSlot): AnswerVerdict {
  const text = (answer ?? '').trim();

  if (!text) return { addresses: false, reason: 'nothing was entered' };

  const w = words(text);
  const normalised = text.toLowerCase().replace(/[^a-z0-9\s/]/gi, '').trim();

  // Every token is filler — "bla", "bla bla", "tbd".
  if (w.length > 0 && w.every((t) => FILLER.has(t.toLowerCase().replace(/[^a-z0-9/.-]/gi, '')))) {
    return { addresses: false, reason: 'that looks like placeholder text' };
  }
  if (FILLER.has(normalised)) {
    return { addresses: false, reason: 'that looks like placeholder text' };
  }

  // No letters at all, for a slot that is not a number or a date.
  if (slot && !TERSE_OK.has(slot.id) && letters(text).length < 3) {
    return { addresses: false, reason: 'that has no wording in it' };
  }

  // Keyboard mash: every token is one.
  if (w.length > 0 && w.every(looksLikeMash)) {
    return { addresses: false, reason: 'that does not read as words' };
  }

  // Echoing the question back instead of answering it.
  if (slot && normalised.length > 0) {
    const q = slot.prompt.toLowerCase().replace(/[^a-z0-9\s]/gi, '').trim();
    if (q && (normalised === q || (normalised.length > 12 && q.includes(normalised)))) {
      return { addresses: false, reason: 'that repeats the question back' };
    }
  }

  // A narrative slot answered in one or two words.
  if (slot && !TERSE_OK.has(slot.id) && w.length < MIN_WORDS) {
    return { addresses: false, reason: 'that is too short to describe it' };
  }

  return { addresses: true };
}
