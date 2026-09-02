#!/usr/bin/env node
// Verifies that the AI endpoint reports missing server configuration as a
// controlled 503 response instead of failing during Vercel function loading.
//
// The variables removed below are the ones the handler actually gates on:
// api/ai.ts -> getAgent -> getDbAdmin(), which throws ServerConfigurationError
// when neither connection variable is set. This used to remove SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY, which nothing has read since the Neon cutover — so
// the suite only passed on a machine that happened to have no connection
// configured, and asserted nothing on one that did.

import { readFileSync } from 'node:fs';

const keys = ['NEON_DATABASE_URL', 'DATABASE_URL'];
const previous = new Map(keys.map((key) => [key, process.env[key]]));
for (const key of keys) delete process.env[key];

let statusCode = 0;
let responseBody;
const response = {
  status(code) { statusCode = code; return this; },
  json(body) { responseBody = body; return this; },
};

try {
  const { default: handler } = await import('../../api/ai.ts');
  await handler({ method: 'POST', body: { query: 'classify office chairs' } }, response);
} finally {
  for (const [key, value] of previous) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

const ok = statusCode === 503
  && responseBody?.code === 'service_unavailable'
  && responseBody?.error === 'AI service is temporarily unavailable.';
if (!ok) {
  console.error(`Expected controlled 503, got status=${statusCode} body=${JSON.stringify(responseBody)}`);
  process.exit(1);
}
const llmSource = readFileSync(new URL('../../src/lib/llm.ts', import.meta.url), 'utf8');
if (!llmSource.includes("DEFAULT_GROQ_MODEL = 'openai/gpt-oss-20b'")) {
  console.error('Expected the current Groq replacement model to be configured.');
  process.exit(1);
}
console.log('AI missing-configuration response is a controlled 503 and uses the current Groq model.');
