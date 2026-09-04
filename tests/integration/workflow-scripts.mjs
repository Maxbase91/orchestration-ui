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
