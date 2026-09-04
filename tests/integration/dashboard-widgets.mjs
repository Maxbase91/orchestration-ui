#!/usr/bin/env node
// The dashboard widget catalogue and its renderer must agree.
//
// A widget lives in two places: `widget-registry.tsx` (what the picker offers,
// and to which roles) and `widgets/index.ts` (what actually renders). An id in
// the first and not the second is a picker entry that adds an invisible tile;
// an id in the second and not the first is a component nobody can reach. The
// barrel's own comment says "ids must stay in sync" — this is what checks it.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { widgetRegistry, allQuickActions, getDefaultLayout } from '../../src/features/dashboard/widget-registry.tsx';

// The registry is importable (its only import is a type). The barrel is not —
// it pulls in every widget component, and those are React. So the renderer's
// ids are read out of its source instead of by importing it.
const barrel = readFileSync(
  new URL('../../src/features/dashboard/widgets/index.ts', import.meta.url), 'utf8');
const componentMap = barrel.slice(barrel.indexOf('widgetComponents'));
const widgetComponents = Object.fromEntries(
  [...componentMap.matchAll(/^\s*'([a-z0-9-]+)':\s*Widget\w+,/gm)].map((m) => [m[1], true]),
);

let failures = 0;
const check = (label, fn) => {
  try { fn(); console.log(`  \x1b[32m\u2713\x1b[0m ${label}`); }
  catch (error) { failures++; console.error(`  \x1b[31m\u2717\x1b[0m ${label} \u2014 ${error.message.split('\n')[0]}`); }
};

const registryIds = widgetRegistry.map((w) => w.id);
const componentIds = Object.keys(widgetComponents);

console.log('\nEvery offered widget renders, and every renderer is offered');

check('no registry entry is missing a component', () => {
  const missing = registryIds.filter((id) => !componentIds.includes(id));
  assert.deepEqual(missing, [], `picker offers but cannot render: ${missing.join(', ')}`);
});

check('no component is unreachable from the picker', () => {
  const orphans = componentIds.filter((id) => !registryIds.includes(id));
  assert.deepEqual(orphans, [], `renders but is never offered: ${orphans.join(', ')}`);
});

check('widget ids are unique', () => {
  assert.equal(new Set(registryIds).size, registryIds.length);
});

console.log('\nEvery widget is reachable by at least one role');

check('no widget is offered to nobody', () => {
  const stranded = widgetRegistry.filter((w) => w.availableTo.length === 0).map((w) => w.id);
  assert.deepEqual(stranded, []);
});

check('every widget has a title and a description worth reading', () => {
  for (const widget of widgetRegistry) {
    assert.ok(widget.title.trim().length > 0, `${widget.id} has no title`);
    assert.ok(widget.description.trim().length > 20, `${widget.id} has a thin description`);
  }
});

console.log('\nThe purchasing and vendor surfaces exist');
// The dashboard had nothing for purchase orders, invoices or supplier
// onboarding, so a PO waiting on a receipt or an invoice nobody could match was
// invisible until somebody opened the module.
for (const id of ['open-pos', 'invoice-exceptions', 'supplier-onboarding', 'requests-by-stage']) {
  check(`${id} is offered and renders`, () => {
    assert.ok(registryIds.includes(id), 'missing from the registry');
    assert.ok(componentIds.includes(id), 'missing from the renderer');
  });
}

console.log('\nThe picker can draw every icon it offers');
// A missing icon silently falls back to a generic one, so every widget in the
// catalogue would look the same.
check('every registry icon is in the picker\'s icon map', () => {
  const dialog = readFileSync(
    new URL('../../src/features/dashboard/components/add-widget-dialog.tsx', import.meta.url), 'utf8');
  const mapBody = dialog.slice(dialog.indexOf('const iconMap'), dialog.indexOf('const sizeLabels'));
  const missing = [...new Set(widgetRegistry.map((w) => w.icon))]
    .filter((icon) => !new RegExp(`\\b${icon}\\b`).test(mapBody));
  assert.deepEqual(missing, [], `icons not mapped: ${missing.join(', ')}`);
});

console.log('\nQuick actions point somewhere');

check('every quick action has a destination or a named action', () => {
  for (const action of allQuickActions) {
    assert.ok(action.to || action.action, `${action.id} does neither`);
  }
});

console.log('\nDefault layouts name real widgets the role can have');
// A default layout is just a list of ids. A typo, or an id a role is not
// entitled to, renders nothing at all — the dashboard skips ids it cannot
// resolve, so the tile simply is not there and nobody sees an error.
const ROLES = ['service-owner', 'procurement-manager', 'vendor-manager', 'operations-lead', 'supplier', 'admin'];
for (const role of ROLES) {
  check(`${role}'s default layout is resolvable`, () => {
    const layout = getDefaultLayout(role);
    assert.ok(layout.length > 0, 'the role opens on an empty dashboard');
    const unknown = layout.filter((id) => !registryIds.includes(id));
    assert.deepEqual(unknown, [], `not in the registry: ${unknown.join(', ')}`);
    const notEntitled = layout.filter(
      (id) => !widgetRegistry.find((w) => w.id === id).availableTo.includes(role));
    assert.deepEqual(notEntitled, [], `not available to this role: ${notEntitled.join(', ')}`);
  });
}

check('the purchasing and vendor widgets are on a default dashboard, not only in the picker', () => {
  const defaulted = new Set(ROLES.flatMap((role) => getDefaultLayout(role)));
  const hidden = ['open-pos', 'invoice-exceptions', 'supplier-onboarding', 'requests-by-stage']
    .filter((id) => !defaulted.has(id));
  assert.deepEqual(hidden, [], `reachable only by hunting in "Add Widget": ${hidden.join(', ')}`);
});

console.log(
  failures === 0
    ? '\nAll dashboard-widget checks passed.'
    : `\n${failures} dashboard-widget check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
