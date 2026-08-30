#!/usr/bin/env node
// Regression coverage for the unified requester intake primitives.

import { resolveCommodityCandidates } from '../../src/lib/procurement/commodity-candidates.ts';
import { seedServiceDescriptionFromText } from '../../src/lib/procurement/intake-seed.ts';
import { readFileSync } from 'node:fs';

let failures = 0;
function check(name, condition) { if (condition) console.log(`  \x1b[32m✓\x1b[0m ${name}`); else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}`); } }

const candidates = resolveCommodityCandidates('Buy laptop computers and workstation equipment for the new team', 'goods');
check('specific commodity candidates are returned', candidates.length > 0 && candidates[0].code === '43211500');
check('candidate list follows high-confidence cap', candidates.length <= 3);
check('low-confidence classification shows one fallback', resolveCommodityCandidates('something unknown', 'goods').length === 1);

const seeded = seedServiceDescriptionFromText('We need a new customer analytics platform for the sales team. The work should include implementation, data migration and training. Deliverables include a configured platform and handover report.');
check('long pasted brief seeds objective and scope', Boolean(seeded.objective && seeded.scope));
check('deliverables remain a distinct section', Boolean(seeded.deliverables));
check('exclusions are distinct from scope in the intake model', /exclusions/.test(readFileSync('src/features/requests/new-request/new-request-page.tsx', 'utf8')) && /id: 'exclusions'/.test(readFileSync('src/lib/procurement/service-description-defaults.ts', 'utf8')));
check('scope prompt does not combine Included and Excluded questions', !readFileSync('src/lib/procurement/demand-conversation.ts', 'utf8').includes('in scope — and anything explicitly out of scope'));
check('document context carries into the adaptive chat', readFileSync('src/features/requests/new-request/step-chat-intake.tsx', 'utf8').includes('data.serviceDescription ?? {}'));
check('requester-facing intake does not render a business justification field', !/label.*Business Justification/.test(readFileSync('src/features/requests/new-request/step-chat-intake.tsx', 'utf8')));
check('upload and guidance API boundaries exist', readFileSync('api/intake-upload.ts', 'utf8').includes('PDF') && readFileSync('api/intake-guidance.ts', 'utf8').includes('similar approved request'));
check('guidance supports classification, route, details and review moments', ['classification', 'route', 'details', 'review'].every((section) => readFileSync('api/intake-guidance.ts', 'utf8').includes(section)));

if (failures) process.exit(1);
console.log('Unified intake checks passed.');
