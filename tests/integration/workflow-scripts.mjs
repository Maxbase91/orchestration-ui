#!/usr/bin/env node
// Guards the workflow files against calling npm scripts that no longer exist.
//
// Why this exists: .github/workflows/ci.yml names its browser suites
// explicitly (they are the subset that runs offline against the stub, and the
// rest of the BROWSER set needs a live database or a dev server). An explicit
// list drifts — the Simple/Expert refactor deleted `test:experience-mode-ui`
// from package.json and left the call in CI, so three pushes failed on a
// missing script rather than on anything about the code. `tsc`, lint and the
// suites cannot see inside a YAML file; this can.

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const WORKFLOW_DIR = path.join(ROOT, '.github', 'workflows');

const scripts = new Set(
  Object.keys(JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts),
);

// Matches `npm run <script>` anywhere in the YAML — inside a `run:` block
// scalar, a one-line step, or a comment. A comment naming a dead script is a
// stale instruction too, so it is worth catching rather than parsing around.
const INVOCATION = /npm run (?:--silent )?([A-Za-z0-9:_-]+)/g;

const missing = [];
for (const file of readdirSync(WORKFLOW_DIR).filter((name) => /\.ya?ml$/.test(name)).sort()) {
  const yaml = readFileSync(path.join(WORKFLOW_DIR, file), 'utf8');
  for (const [, name] of yaml.matchAll(INVOCATION)) {
    // `npm run -- --flag` style trailing args are not script names.
    if (!scripts.has(name)) missing.push({ file, name });
  }
}

if (missing.length) {
  console.error(`workflow-scripts: ${missing.length} workflow call(s) name a script that is not in package.json`);
  for (const { file, name } of missing) console.error(`  .github/workflows/${file}: npm run ${name}`);
  process.exit(1);
}

console.log(`workflow-scripts: every npm run call in .github/workflows resolves (${scripts.size} scripts defined)`);

// ── The other direction: a suite nobody can find is a suite nobody runs ──────
// The test playbook's catalogue is the one index of what each suite covers
// (docs/testing/TEST_PLAYBOOK.md → "The catalogue"). It was the README's
// Testing section until the documentation boundaries of 2026-09-26, and it
// drifted there: sixteen `test:*` scripts existed with no entry, including whole
// areas (approval derivation, the lifecycle e2e, schema drift), and a reader
// looking for "is this covered?" concluded it was not. Only the catalogue
// counts — a script named in passing elsewhere in the playbook is not an entry.
const playbook = readFileSync(path.join(ROOT, 'docs', 'testing', 'TEST_PLAYBOOK.md'), 'utf8');
const catalogueStart = playbook.indexOf('### The catalogue');
if (catalogueStart < 0) {
  console.error('workflow-scripts: docs/testing/TEST_PLAYBOOK.md has no "### The catalogue" section');
  process.exit(1);
}
const catalogueEnd = playbook.slice(catalogueStart + 1).search(/\n##? /);
const catalogue = catalogueEnd < 0 ? playbook.slice(catalogueStart) : playbook.slice(catalogueStart, catalogueStart + 1 + catalogueEnd);
const undocumented = [...scripts]
  .filter((name) => name.startsWith('test:'))
  // The two aggregates are described in prose rather than as list entries.
  .filter((name) => name !== 'test:all' && name !== 'test:ui:all')
  .filter((name) => !catalogue.includes(`npm run ${name} `) && !catalogue.includes(`npm run ${name}\n`));

if (undocumented.length) {
  console.error(`workflow-scripts: ${undocumented.length} test script(s) are not in the test playbook's catalogue`);
  for (const name of undocumented) console.error(`  npm run ${name}`);
  console.error('  Add a one-line entry to "The catalogue" in docs/testing/TEST_PLAYBOOK.md saying what the suite covers.');
  process.exit(1);
}

console.log('workflow-scripts: every test:* script has an entry in the test playbook\'s catalogue');
