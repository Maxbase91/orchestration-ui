#!/usr/bin/env node
// Regression guard for Vercel Hobby routing: domain endpoints must resolve
// through the existing database function instead of falling through to SPA HTML.
import { readFileSync } from 'node:fs';

const vercel = readFileSync('vercel.json', 'utf8');
const db = readFileSync('api/db.ts', 'utf8');
const domains = ['commodity-match', 'contract-match', 'contract-scope', 'contract-vocabulary', 'intake-upload', 'intake-submit', 'policy-config', 'neon-health'];
let failures = 0;
for (const domain of domains) {
  const ok = vercel.includes(`/api/${domain}`) && vercel.includes(`/api/db?domain=${domain}`) && db.includes(`'${domain}'`);
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${domain} uses the shared API dispatcher`);
  if (!ok) failures += 1;
}
if (failures) process.exit(1);
console.log('API domain routing checks passed.');
