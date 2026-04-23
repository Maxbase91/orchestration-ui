#!/usr/bin/env node
// Verifies the restructured intake sequence:
//   1. catalogue match check
//   2. contract match check
//   3. only if neither, proceed to chat with mandatory SOW
//
// The test runs the pre-check algorithm against live Supabase data with
// realistic titles and asserts on the resulting matches. It also asserts
// the chat-intake API prompt no longer contains the 'would you like to
// keep it quick' branch.
//
// Run: node tests/integration/intake-sequence.mjs

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  const raw = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const sb = createClient(
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const results = [];
const pass = (n, d = '') => results.push({ n, o: 'PASS', d });
const fail = (n, d) => results.push({ n, o: 'FAIL', d });
const assert = (cond, n, d) => (cond ? pass(n, d) : fail(n, d));

// Mirror of tokeniser + matchers from step-pre-check.tsx. Keep in sync.
const STOP_WORDS = new Set([
  'i', 'a', 'an', 'the', 'of', 'for', 'to', 'we', 'us', 'our', 'my',
  'need', 'want', 'would', 'like', 'please', 'can', 'new', 'some',
]);
function tokenize(text) {
  return text.toLowerCase().split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9-]/g, ''))
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}
function tokenMatches(haystack, token) {
  if (haystack.includes(token)) return true;
  if (token.endsWith('s') && token.length > 3 && haystack.includes(token.slice(0, -1))) return true;
  return false;
}
function matchCatalogueItem(item, tokens) {
  if (tokens.length === 0) return 0;
  const name = item.name.toLowerCase();
  const haystack = `${item.description} ${item.catalogue_name}`.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (tokenMatches(name, t)) score += 1.0;
    else if (tokenMatches(haystack, t)) score += 0.4;
  }
  return score / Math.max(tokens.length, 2);
}
function matchContract(contract, ctx) {
  if (contract.status !== 'active' && contract.status !== 'expiring') return null;
  let score = 0;
  const reasons = [];
  let hasPrimarySignal = false;
  if (ctx.supplierId && contract.supplier_id === ctx.supplierId) {
    score += 0.5; hasPrimarySignal = true; reasons.push('supplier match');
  }
  const catLower = (contract.category ?? '').toLowerCase();
  if (catLower.includes(ctx.category) && ctx.category) {
    score += 0.3; hasPrimarySignal = true; reasons.push('category match');
  } else {
    let kwHits = 0;
    for (const t of ctx.tokens) {
      if (catLower.includes(t) || (contract.title ?? '').toLowerCase().includes(t)) {
        kwHits += 1;
      }
    }
    score += kwHits * 0.1;
    if (kwHits >= 2) hasPrimarySignal = true;
  }
  if (!hasPrimarySignal) return null;
  const remainingPct = Math.max(0, 100 - (contract.utilisation_percentage ?? 0));
  if (remainingPct < 5) return null;
  if (ctx.estimatedValue > 0 && contract.value > 0) {
    const remaining = contract.value * (remainingPct / 100);
    if (remaining >= ctx.estimatedValue) {
      score += 0.2; reasons.push('capacity ok');
    }
  }
  return score >= 0.3 ? { score, reasons } : null;
}

async function loadTables() {
  const [cat, con] = await Promise.all([
    sb.from('catalogue_items').select('*'),
    sb.from('contracts').select('*'),
  ]);
  if (cat.error) throw cat.error;
  if (con.error) throw con.error;
  return { catalogueItems: cat.data ?? [], contracts: con.data ?? [] };
}

async function scenarioCatalogueMatch(catalogueItems) {
  // A clearly catalogue-shaped query: ThinkPad laptops (IT-001 in seed).
  const tokens = tokenize('I need ThinkPad laptops for the engineering team');
  const matches = catalogueItems
    .map((item) => ({ item, score: matchCatalogueItem(item, tokens) }))
    .filter((r) => r.score > 0.3)
    .sort((a, b) => b.score - a.score);
  assert(matches.length > 0, 'catalogue: laptop query finds matches', `matches=${matches.slice(0, 3).map((m) => `${m.item.id} (${m.score.toFixed(2)})`).join(', ')}`);
  assert(matches[0]?.item.id?.startsWith('IT-'), 'catalogue: top match is IT category', `top=${matches[0]?.item.id}`);

  // A simpler single-word search should still work
  const pens = catalogueItems
    .map((item) => ({ item, score: matchCatalogueItem(item, tokenize('pens')) }))
    .filter((r) => r.score > 0.3)
    .sort((a, b) => b.score - a.score);
  assert(pens.length > 0 && pens[0].item.id.startsWith('OS-'), 'catalogue: single-word query "pens" matches office supplies', `top=${pens[0]?.item.id}`);
}

async function scenarioContractMatch(contracts) {
  // Target a contract that exists in seed: CON-xxx for Accenture consulting
  const ctx = {
    tokens: tokenize('strategy consulting engagement with Accenture'),
    category: 'consulting',
    estimatedValue: 50_000,
    supplierId: 'SUP-001', // Accenture in seed
  };
  const out = [];
  for (const c of contracts) {
    const m = matchContract(c, ctx);
    if (m) out.push({ id: c.id, score: m.score, reasons: m.reasons });
  }
  out.sort((a, b) => b.score - a.score);
  assert(out.length > 0, 'contract: Accenture consulting query finds active contracts', `top=${out.slice(0, 3).map((o) => `${o.id}(${o.score.toFixed(2)})`).join(', ')}`);
  assert(out[0]?.score >= 0.5, 'contract: top candidate has supplier-match bonus', `score=${out[0]?.score}`);
}

async function scenarioNoMatch(catalogueItems, contracts) {
  // Query unlikely to match anything catalogue/contract
  const title = 'custom Antarctic research expedition logistics';
  const tokens = tokenize(title);

  const catMatches = catalogueItems.filter((item) => matchCatalogueItem(item, tokens) > 0.3);
  assert(catMatches.length === 0, 'no-match: catalogue yields nothing for exotic query', `cat=${catMatches.length}`);

  // Use a category that doesn't exist in any contract — this proves the
  // matcher doesn't fire on pure category-name collisions.
  const ctx = { tokens, category: 'antarctic-logistics', estimatedValue: 100_000, supplierId: '' };
  const conMatches = contracts.filter((c) => matchContract(c, ctx));
  assert(conMatches.length === 0, 'no-match: contracts yield nothing for exotic query', `con=${conMatches.length}`);
}

async function scenarioChatIntakePromptMandatorySow() {
  // The chat-intake system prompt lives in the serverless function. We don't
  // call the endpoint (that would burn a real LLM credit); we read the
  // committed file and assert the SOW branch was removed.
  const src = readFileSync(new URL('../../api/chat-intake.ts', import.meta.url), 'utf8');
  assert(
    !src.includes('Would you like me to help build a detailed service description'),
    'chat: optional-SOW prompt removed from server',
  );
  assert(
    src.includes('SOW is MANDATORY'),
    'chat: mandatory-SOW enforcement present',
  );
  assert(
    src.includes('Never ask "do you want a detailed SOW?"') || src.includes('Never offer to "keep it quick"'),
    'chat: explicit rule against offering to skip SOW',
  );
  assert(
    src.includes('NEVER ask meta-questions') &&
    src.includes('Would you like to refine this?') &&
    src.includes('step directly to the NEXT question'),
    'chat: explicit rule forbids refine/expand meta-questions',
  );

  // Client-side welcome message must also not offer to refine — it should
  // dive into the next question in the sequence instead.
  const clientSrc = readFileSync(
    new URL('../../src/features/requests/new-request/step-chat-intake.tsx', import.meta.url),
    'utf8',
  );
  assert(
    !clientSrc.includes('Would you like to refine this'),
    'chat: welcome does not ask "refine or ask questions"',
  );
  assert(
    clientSrc.includes('firstMissingQuestion'),
    'chat: welcome routes to the next unanswered question in the mandated sequence',
  );
}

// Mirror of isTriageRequired in step-compliance.tsx. Keep in sync.
function isTriageRequired(p) {
  if (!p.supplierRegistered) return { required: true, reason: 'new or unselected supplier' };
  if (p.supplierSraStatus === 'not-assessed' || p.supplierSraStatus === 'expired' || !p.supplierSraStatus) {
    return { required: true, reason: `supplier SRA status is ${p.supplierSraStatus ?? 'unknown'}` };
  }
  if (p.supplierRiskRating === 'high' || p.supplierRiskRating === 'critical') {
    return { required: true, reason: `supplier risk rating is ${p.supplierRiskRating}` };
  }
  if (p.matchingReusableSraCount > 0) {
    if (p.inferredDataSensitivity === 'high' || p.inferredDataSensitivity === 'critical') {
      return { required: true, reason: `data sensitivity is ${p.inferredDataSensitivity}` };
    }
    return { required: false, reason: 'reusable SRA covers this supplier' };
  }
  if (p.inferredDataSensitivity === 'high' || p.inferredDataSensitivity === 'critical') {
    return { required: true, reason: `data sensitivity is ${p.inferredDataSensitivity}` };
  }
  return { required: true, reason: 'no reusable SRA on file' };
}

async function scenarioRiskTriageGate() {
  const cases = [
    {
      label: 'valid SRA + low sensitivity + reusable match → skip',
      params: { supplierRegistered: true, supplierSraStatus: 'valid', supplierRiskRating: 'low', matchingReusableSraCount: 1, inferredDataSensitivity: 'low' },
      expect: false,
    },
    {
      label: 'valid SRA + critical sensitivity → required',
      params: { supplierRegistered: true, supplierSraStatus: 'valid', supplierRiskRating: 'low', matchingReusableSraCount: 1, inferredDataSensitivity: 'critical' },
      expect: true,
    },
    {
      label: 'no registered supplier → required',
      params: { supplierRegistered: false, matchingReusableSraCount: 0, inferredDataSensitivity: 'medium' },
      expect: true,
    },
    {
      label: 'expired SRA → required',
      params: { supplierRegistered: true, supplierSraStatus: 'expired', supplierRiskRating: 'low', matchingReusableSraCount: 1, inferredDataSensitivity: 'low' },
      expect: true,
    },
    {
      label: 'high-risk supplier → required regardless of reusable SRA',
      params: { supplierRegistered: true, supplierSraStatus: 'valid', supplierRiskRating: 'high', matchingReusableSraCount: 2, inferredDataSensitivity: 'low' },
      expect: true,
    },
    {
      label: 'no reusable SRA + low sensitivity → required (safer default)',
      params: { supplierRegistered: true, supplierSraStatus: 'valid', supplierRiskRating: 'low', matchingReusableSraCount: 0, inferredDataSensitivity: 'low' },
      expect: true,
    },
  ];
  for (const { label, params, expect } of cases) {
    const got = isTriageRequired(params);
    assert(got.required === expect, `triage-gate: ${label}`, `required=${got.required} reason=${got.reason}`);
  }
}

// Mirror of inferDataSensitivity in step-compliance.tsx. Keep in sync.
function inferDataSensitivity(sow) {
  const blob = [sow?.objective, sow?.scope, sow?.deliverables, sow?.resources, sow?.narrative]
    .filter(Boolean).join(' ').toLowerCase();
  if (!blob) return 'medium';
  const critical = ['payment data', 'card data', 'pci', 'health data', 'medical records', 'classified', 'state secret'];
  const high = ['personal data', 'pii', 'gdpr', 'customer data', 'confidential', 'financial records', 'payroll', 'employee data', 'ip address'];
  const medium = ['internal', 'proprietary', 'commercial', 'contract terms', 'supplier data'];
  const low = ['public', 'marketing', 'brochure', 'website content'];
  if (critical.some((k) => blob.includes(k))) return 'critical';
  if (high.some((k) => blob.includes(k))) return 'high';
  if (medium.some((k) => blob.includes(k))) return 'medium';
  if (low.some((k) => blob.includes(k))) return 'low';
  return 'medium';
}

async function scenarioRiskTriagePrefill() {
  // Four canonical SOW shapes, each mapping to a different sensitivity.
  const cases = [
    { sow: { scope: 'Process customer credit card data end-to-end' }, expected: 'critical' },
    { sow: { scope: 'Handle GDPR-regulated personal data for EU users', deliverables: 'privacy-compliant pipeline' }, expected: 'high' },
    { sow: { scope: 'Integrate with our internal procurement tooling', deliverables: 'proprietary dashboards' }, expected: 'medium' },
    { sow: { scope: 'Produce a public marketing brochure', deliverables: 'website content refresh' }, expected: 'low' },
    { sow: { scope: 'Run a networking mixer for partners' }, expected: 'medium' }, // generic → default
  ];
  for (const { sow, expected } of cases) {
    const got = inferDataSensitivity(sow);
    assert(got === expected, `risk-prefill: "${sow.scope.slice(0, 40)}..." → ${expected}`, `got=${got}`);
  }
}

async function main() {
  const { catalogueItems, contracts } = await loadTables();
  console.log(`Loaded ${catalogueItems.length} catalogue items, ${contracts.length} contracts`);
  await scenarioCatalogueMatch(catalogueItems);
  await scenarioContractMatch(contracts);
  await scenarioNoMatch(catalogueItems, contracts);
  await scenarioChatIntakePromptMandatorySow();
  await scenarioRiskTriagePrefill();
  await scenarioRiskTriageGate();

  const failed = results.filter((r) => r.o === 'FAIL').length;
  for (const r of results) {
    const tag = r.o === 'PASS' ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    console.log(`  ${tag}  ${r.n}`);
    if (r.d) console.log(`        ${r.d}`);
  }
  console.log(`\n  ${results.length - failed} passed, ${failed} failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
