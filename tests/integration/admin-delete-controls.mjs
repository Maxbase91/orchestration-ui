#!/usr/bin/env node
// Configuration you can create and edit, you can also remove.
//
// Six admin screens exported a `useDeleteX` hook that nothing called, so an
// approval chain, form, agent or routing rule could be created and edited and
// never deleted. A row added by mistake stayed forever, and the only way out
// was the database.
//
// FOUR, not six. Cost centres and delivery locations are deliberately
// undeletable and stay that way: requests store the code as TEXT with no
// foreign key, so removing a row orphans every record charged to it, and
// retiring (`active: false`) is already implemented, already visible in the
// table, and keeps the history. `test:reference-data-ui` guards their absence —
// that guard matched on a button's accessible name, so an icon-only trash
// button would have sailed past it, and it now checks the markup.
//
// For the four that do delete, a one-click button would have been worse than
// the gap. Exactly ONE of them — approval_chains — has a foreign key to stop a
// bad delete; the rest would silently orphan whatever referenced them. So every
// screen goes through the same confirmation, which names the record and states
// the consequence, and surfaces the database's own refusal instead of a generic
// "Failed to delete" — a refusal is the constraint working, and hiding it makes
// a correct database look broken.
// Run: npm run test:admin-delete-controls

import { readFileSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, ROOT), 'utf8');
let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
};

// Each screen, the hook it must call, and the module that exports it.
const SURFACES = [
  ['approval chains', 'src/features/admin/approval-chains-page.tsx', 'useDeleteApprovalChain', 'src/lib/db/hooks/use-approval-chains.ts'],
  ['form builder', 'src/features/admin/forms/form-builder-page.tsx', 'useDeleteFormTemplate', 'src/lib/db/hooks/use-form-templates.ts'],
  ['ai agents', 'src/features/admin/ai-agents/ai-agents-page.tsx', 'useDeleteAiAgent', 'src/lib/db/hooks/use-ai-agents.ts'],
  ['routing rules', 'src/features/admin/routing-rules/routing-rules-page.tsx', 'useDeleteRoutingRule', 'src/lib/db/hooks/use-routing-rules.ts'],
];

console.log('Every delete hook has a caller');
for (const [label, page, hook, hookModule] of SURFACES) {
  const source = read(page);
  check(`${label} calls ${hook}`, source.includes(`${hook}()`),
    'the hook is exported and nothing calls it — the exact gap this closes');
  check(`${hook} exists to be called`, read(hookModule).includes(`export function ${hook}`));
}

console.log('\nEvery delete is confirmed, and the confirmation says what it does');
for (const [label, page] of SURFACES) {
  const source = read(page);
  check(`${label} routes through the shared confirmation`,
    /<ConfirmDeleteDialog/.test(source) && /from '@\/components\/shared\/confirm-delete-dialog'/.test(source),
    'a one-click delete on a referenced record is worse than no delete at all');
  // `consequence` is a required prop, so a page that renders the dialog must
  // supply one — but an empty string would satisfy the type and say nothing.
  const consequence = /consequence=(?:\{`([^`]+)`\}|"([^"]+)")/.exec(source);
  check(`${label} states a real consequence`,
    Boolean(consequence) && (consequence[1] ?? consequence[2]).length > 40,
    consequence ? (consequence[1] ?? consequence[2]) : '(none found)');
}

console.log('\nThe dialog is honest about failure');
const dialog = read('src/components/shared/confirm-delete-dialog.tsx');
check('a foreign-key refusal is reported as "still referenced"',
  /foreign key\|still referenced\|violates/.test(dialog),
  'requests.approval_chain is a real FK; Postgres will refuse and the admin must be told why');
check('any other error keeps its own message',
  /setError\(\s*[\s\S]{0,400}?:\s*message,?\s*\)/.test(dialog),
  'swallowing the reason is how a working constraint looks like a broken button');
check('consequence is a required prop, not an optional one',
  /consequence: string;/.test(dialog),
  'every one of these tables is referenced by something');
check('the confirm button is destructive-styled', /variant="destructive"/.test(dialog));

console.log('\nThe row click and the delete click do not both fire');
// The agent library opens the record on row click, so its delete button must
// stop propagation or deleting also navigates into what was deleted.
{
  const source = read('src/features/admin/ai-agents/components/agent-library.tsx');
  check('ai agents stops propagation on the delete button',
    /e\.stopPropagation\(\); onDeleteAgent/.test(source));
}

console.log('\nThe reference tables stay undeletable, on purpose');
// Requests carry `cost_centre` and the delivery location as text. Deleting the
// row they name does not fail — it orphans them, silently, on records that are
// already closed. Retiring is the way out and it already exists.
for (const [label, page, hook] of [
  ['cost centres', 'src/features/admin/cost-centres-page.tsx', 'useDeleteCostCentre'],
  ['delivery locations', 'src/features/admin/delivery-locations-page.tsx', 'useDeleteDeliveryLocation'],
]) {
  const source = read(page);
  check(`${label} offers no delete`, !source.includes(`${hook}()`),
    'retiring keeps the history; deleting orphans every record that names the code');
  check(`${label} offers retiring instead`, /active/.test(source));
}

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exit(1); }
console.log('All admin-delete-control checks passed.');
