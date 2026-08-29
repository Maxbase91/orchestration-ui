#!/usr/bin/env node
// Guards against a production-only crash class: a relative import inside an
// api/*.ts function's dependency graph that is missing its file extension.
//
// Neither `tsc -b` (this repo's app tsconfig uses bundler-mode resolution,
// which tolerates it) nor `vercel dev` (its dev-server loader is also
// lenient) can catch this. Only Vercel's real per-function build — which
// compiles each api/ entrypoint under strict node16/nodenext resolution and
// then runs the emitted JS under Node's real ESM loader ("type": "module")
// — enforces it, and that throws ERR_MODULE_NOT_FOUND at import time,
// before the handler body runs, producing a bare 500 FUNCTION_INVOCATION_FAILED
// with no JSON body. `api/chat-intake.ts` shipped broken this way because
// `src/lib/procurement/demand-conversation.ts` imported two sibling modules
// without ".js" — see tasks/lessons.md.
//
// This walks the real import graph reached from every routable api/*.ts
// entrypoint (source-level, no build/network needed) and fails on any
// relative specifier lacking an extension — value or type-only, so a later
// edit that turns a type-only import into a value one can't silently
// reintroduce the crash.
//
// Run: node tests/integration/api-import-extensions.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const RESOLVABLE_EXT = ['.ts', '.tsx', '.js', '.jsx', '.json', '.mjs', '.cjs'];
const IMPORT_RE = /(?:^|\n)\s*import\s+(?:type\s+)?(?:[\s\S]*?from\s+)?['"](\.[^'"]*)['"]/g;
const REEXPORT_RE = /(?:^|\n)\s*export\s+(?:type\s+)?(?:[\s\S]*?from\s+)?['"](\.[^'"]*)['"]/g;

function listEntrypoints() {
  const apiDir = path.join(ROOT, 'api');
  const out = [];
  for (const entry of readdirSync(apiDir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;
    if (entry.name.startsWith('_')) continue; // shared helper, not a route
    out.push(path.join(entry.path ?? entry.parentPath, entry.name));
  }
  return out.sort();
}

// This codebase writes source specifiers as '../lib/llm.js' per TS's
// nodenext convention: the specifier names the COMPILED output, and tsc maps
// it back to the .ts source file that produces it. Mirror that swap here.
const SOURCE_COUNTERPART = { '.js': '.ts', '.jsx': '.tsx', '.mjs': '.mts', '.cjs': '.cts' };

/** Resolve a relative specifier to a real source file, the way Node/tsc would. */
function resolve(fromFile, specifier) {
  const base = path.resolve(path.dirname(fromFile), specifier);
  if (RESOLVABLE_EXT.some((ext) => base.endsWith(ext))) {
    if (existsAsFile(base)) return base;
    for (const [compiled, source] of Object.entries(SOURCE_COUNTERPART)) {
      if (base.endsWith(compiled)) {
        const sourceFile = base.slice(0, -compiled.length) + source;
        if (existsAsFile(sourceFile)) return sourceFile;
      }
    }
    return null;
  }
  for (const ext of RESOLVABLE_EXT) {
    if (existsAsFile(base + ext)) return base + ext;
  }
  for (const ext of RESOLVABLE_EXT) {
    const idx = path.join(base, 'index' + ext);
    if (existsAsFile(idx)) return idx;
  }
  return null;
}

function existsAsFile(p) {
  try { return statSync(p).isFile(); } catch { return false; }
}

const violations = [];
const reported = new Set();
const visited = new Set();

function walk(file) {
  if (visited.has(file)) return;
  visited.add(file);

  let source;
  try { source = readFileSync(file, 'utf8'); } catch { return; }

  for (const re of [IMPORT_RE, REEXPORT_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(source))) {
      const specifier = m[1];
      const hasExt = RESOLVABLE_EXT.some((ext) => specifier.endsWith(ext));
      if (!hasExt) {
        const line = source.slice(0, m.index).split('\n').length;
        const key = `${file}:${line}:${specifier}`;
        if (!reported.has(key)) {
          reported.add(key);
          violations.push({ file: path.relative(ROOT, file), line, specifier });
        }
      }
      const resolved = resolve(file, specifier);
      if (resolved) walk(resolved);
      // else: unresolvable even with an extension guess — a separate,
      // pre-existing problem tsc/build already catches; not this test's job.
    }
  }
}

for (const entry of listEntrypoints()) walk(entry);

if (violations.length > 0) {
  console.error(`Found ${violations.length} extensionless relative import(s) reachable from an api/ entrypoint:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  from '${v.specifier}'`);
  }
  console.error(
    '\nEach of these will throw ERR_MODULE_NOT_FOUND under Vercel\'s real production build, ' +
    'crashing the function before it can return a controlled response. Add the file extension.',
  );
  process.exit(1);
}

console.log(`api-import-extensions: ${visited.size} files walked from ${listEntrypoints().length} api/ entrypoints, 0 extensionless relative imports.`);
