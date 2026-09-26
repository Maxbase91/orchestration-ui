#!/usr/bin/env node
// Every pinned model is still served by its provider.
//
// `gemini-2.0-flash` was shut down on 2026-06-01 and stayed in api/_llm.ts for
// three months. Nothing caught it: GEMINI_API_KEY is absent from local .env
// files, so the fallback never ran outside production — where it only fires
// when Groq is already failing, which is the worst possible place to discover a
// second dead endpoint. A retired id returns 404 from the completions endpoint,
// which reads like an outage rather than a config problem.
//
// So this asks the providers what they serve instead of trusting the constant.
// It also prints the served list, because the standing rule is to run the
// latest free model on each provider (CLS-G0, see AGENTS.md rule 5) and you cannot
// follow that rule without seeing what has been released.
//
// A missing provider key is a coverage gap, not a breakage: the suite passes on
// the providers it can reach and prints UNVERIFIED for the rest, so a key that
// only exists in production does not turn into a red build. It skips (exit 3)
// only when no provider is reachable at all. The gap is real, though — an
// unverified pin is exactly how gemini-2.0-flash rotted for three months — so
// the unverified line names what it would take to close it.
import { readFileSync } from 'node:fs';
import { loadEnv } from '../lib/live.mjs';

// loadEnv() returns a merged object; it deliberately does not mutate
// process.env, so read the keys from what it hands back.
const env = loadEnv();

const REQUIRE_LIVE = process.env.REQUIRE_LIVE === '1';
const source = readFileSync(new URL('../../api/_llm.ts', import.meta.url), 'utf8');

/** Read a pinned model id out of api/_llm.ts so the test cannot drift from it. */
function pinned(constName) {
  const match = new RegExp(`${constName} = '([^']+)'`).exec(source);
  if (!match) throw new Error(`${constName} is not declared in api/_llm.ts`);
  return match[1];
}

const GROQ_TOOL = pinned('GROQ_TOOL_MODEL');
const GROQ_COMPLETION = pinned('DEFAULT_GROQ_MODEL');
const GEMINI = pinned('GEMINI_MODEL');

let failures = 0;
let skipped = 0;
const ok = (label) => console.log(`  \x1b[32m✓\x1b[0m ${label}`);
const bad = (label, detail) => {
  failures += 1;
  console.error(`  \x1b[31m✗\x1b[0m ${label}`);
  if (detail) console.error(`      ${detail}`);
};

async function checkGroq() {
  console.log('\nGroq');
  const key = env.GROQ_API_KEY;
  if (!key) {
    skipped += 1;
    console.log('  – skipped: GROQ_API_KEY is not set');
    return;
  }
  const response = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!response.ok) {
    bad('the model list is reachable', `HTTP ${response.status}`);
    return;
  }
  const body = await response.json();
  const served = new Set((body.data ?? []).filter((m) => m.active !== false).map((m) => m.id));
  for (const [label, id] of [['tool-calling', GROQ_TOOL], ['single-shot', GROQ_COMPLETION]]) {
    if (served.has(id)) ok(`${label} model ${id} is served`);
    else bad(`${label} model ${id} is served`, 'retired or renamed — a request would 404');
  }
  // Chat-capable models only: the audio and guard models are not candidates.
  const candidates = [...served]
    .filter((id) => !/whisper|orpheus|prompt-guard|tts/i.test(id))
    .sort();
  console.log(`  served chat models (${candidates.length}): ${candidates.join(', ')}`);
}

async function checkGemini() {
  console.log('\nGemini');
  const key = env.GEMINI_API_KEY;
  if (!key) {
    skipped += 1;
    console.log('  – skipped: GEMINI_API_KEY is not set');
    console.log(`    ${GEMINI} is therefore unverified, and the Groq→Gemini fallback`);
    console.log('    has never run outside production. Set the key to cover it.');
    return;
  }
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
  if (!response.ok) {
    bad('the model list is reachable', `HTTP ${response.status}`);
    return;
  }
  const body = await response.json();
  // The API returns "models/<id>"; the request path uses the bare id.
  const served = new Set((body.models ?? []).map((m) => String(m.name).replace(/^models\//, '')));
  if (served.has(GEMINI)) ok(`fallback model ${GEMINI} is served`);
  else bad(`fallback model ${GEMINI} is served`, 'retired or renamed — the fallback would 404');
  const flash = [...served].filter((id) => /flash/.test(id) && !/tts|live|audio|image/.test(id)).sort();
  console.log(`  served flash models (${flash.length}): ${flash.join(', ')}`);
}

await checkGroq();
await checkGemini();

const PROVIDERS = 2;

if (failures > 0) {
  console.error(`\nmodel-currency: ${failures} pinned model(s) are no longer served.`);
  console.error('Changing a model id is a CLS-G0 decision — see rule 5 of AGENTS.md.');
  process.exit(1);
}
if (skipped === PROVIDERS) {
  console.log('\nmodel-currency: no provider key configured — nothing could be checked.');
  if (REQUIRE_LIVE) {
    console.error('REQUIRE_LIVE=1 and not one provider was reachable.');
    process.exit(1);
  }
  process.exit(3);
}
if (skipped > 0) {
  console.log(`\nUNVERIFIED: ${skipped} provider(s) went unchecked for want of a key.`);
  // Deliberately not naming the local env file here: test:neon-migration flags
  // any file under tests/ or db/ that carries that path string, because a
  // second copy of the env loader is how CI and local runs drifted apart. The
  // path lives in tests/lib/live.mjs only.
  console.log('Add the key to the local env file, and as a CI secret, to cover them.');
  console.log('An unverified pin is how gemini-2.0-flash stayed in the code for three');
  console.log('months after it was shut down.');
}
console.log('\nEvery pinned model that could be checked is still served.');
