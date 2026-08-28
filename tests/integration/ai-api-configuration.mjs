#!/usr/bin/env node
// Verifies that the AI endpoint reports missing server configuration as a
// controlled 503 response instead of failing during Vercel function loading.

const keys = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
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
console.log('AI missing-configuration response is a controlled 503.');
