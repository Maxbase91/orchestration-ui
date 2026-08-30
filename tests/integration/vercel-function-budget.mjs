#!/usr/bin/env node
// Prevents accidental Vercel Hobby deployment failures by enforcing the
// twelve-function budget and the explicit low-volume route dispatcher.

import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const API_DIR = path.join(ROOT, 'api');
const MAX_FUNCTIONS = 12;

function routeFiles(directory) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('_')) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...routeFiles(file));
    else if (entry.isFile() && file.endsWith('.ts')) result.push(file);
  }
  return result;
}

const routes = routeFiles(API_DIR).sort();
if (routes.length > MAX_FUNCTIONS) {
  console.error(`vercel-function-budget: ${routes.length} deployable functions found (maximum ${MAX_FUNCTIONS})`);
  for (const route of routes) console.error(`  ${path.relative(ROOT, route)}`);
  process.exit(1);
}

console.log(`vercel-function-budget: ${routes.length}/${MAX_FUNCTIONS} deployable functions`);
