#!/usr/bin/env node
// Verifies the support-ticket data layer: entitlement filtering, the internal-note
// boundary, and the status lifecycle.
//
// The two rules that matter most here are security-shaped, so they are asserted
// first: a requester sees only their own tickets, and an internal note never
// reaches a requester. Both are enforced in the query rather than a component —
// RLS is "allow all", so a component-level filter would be a display convention.
//
// Self-contained — mirrors src/lib/db/tickets.ts and src/config/roles.ts against a
// fake data client. Keep in sync.
// Run: node tests/integration/tickets.mjs

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

// ── mirrors src/config/roles.ts ──────────────────────────────────────────────
const ticketAgentRoles = ['admin', 'procurement-manager', 'operations-lead'];
const canWorkTickets = (role) => ticketAgentRoles.includes(role);

// ── fixtures ────────────────────────────────────────────────────────────────
const TICKETS = [
  { id: 'TKT-0001', created_by: 'Sarah Mitchell', status: 'open', owner_id: null },
  { id: 'TKT-0002', created_by: 'Sarah Mitchell', status: 'resolved', owner_id: 'u-2' },
  { id: 'TKT-0003', created_by: 'Marcus Johnson', status: 'open', owner_id: 'u-2' },
  { id: 'TKT-0004', created_by: 'Anna Müller', status: 'in-progress', owner_id: null },
];
const RESPONSES = [
  { id: 'r1', ticket_id: 'TKT-0001', body: 'Looking into it now.', is_internal: false },
  { id: 'r2', ticket_id: 'TKT-0001', body: 'Requester has a history of duplicates.', is_internal: true },
  { id: 'r3', ticket_id: 'TKT-0001', body: 'Resolved — see below.', is_internal: false },
];

// ── mirrors listTickets() ───────────────────────────────────────────────────
function listTickets(userName, opts = {}) {
  let rows = [...TICKETS];
  if (!opts.allTickets) rows = rows.filter((t) => t.created_by === userName);
  if (opts.status && opts.status !== 'all') rows = rows.filter((t) => t.status === opts.status);
  if (opts.ownerId === 'unassigned') rows = rows.filter((t) => t.owner_id === null);
  else if (opts.ownerId) rows = rows.filter((t) => t.owner_id === opts.ownerId);
  return rows;
}

// ── mirrors listTicketResponses() ───────────────────────────────────────────
function listTicketResponses(ticketId, opts = {}) {
  let rows = RESPONSES.filter((r) => r.ticket_id === ticketId);
  if (!opts.includeInternal) rows = rows.filter((r) => r.is_internal === false);
  return rows;
}

// ── mirrors setTicketStatus() ───────────────────────────────────────────────
function setTicketStatus(status, resolution) {
  if (status === 'resolved' && !resolution?.trim()) {
    throw new Error('A resolution note is required to resolve a ticket.');
  }
  const terminal = status === 'resolved' || status === 'cancelled';
  return {
    status,
    resolved_at: terminal ? '2026-08-26T00:00:00Z' : null,
    ...(resolution?.trim() ? { resolution: resolution.trim() } : {}),
  };
}

console.log('Entitlement — requesters see only their own tickets');
check('requester sees own only', listTickets('Sarah Mitchell').every((t) => t.created_by === 'Sarah Mitchell'));
check('requester sees the right count', listTickets('Sarah Mitchell').length === 2);
check('requester cannot see another requester\'s ticket',
  !listTickets('Sarah Mitchell').some((t) => t.id === 'TKT-0003'));
check('agent view sees all', listTickets('', { allTickets: true }).length === TICKETS.length);
check('a status filter cannot widen the entitlement',
  listTickets('Sarah Mitchell', { status: 'open' }).every((t) => t.created_by === 'Sarah Mitchell'));
check('an owner filter cannot widen the entitlement',
  listTickets('Sarah Mitchell', { ownerId: 'u-2' }).every((t) => t.created_by === 'Sarah Mitchell'));

console.log('\nInternal notes never reach a requester');
check('default excludes internal notes', listTicketResponses('TKT-0001').every((r) => !r.is_internal));
check('default returns the public replies', listTicketResponses('TKT-0001').length === 2);
check('omitting the option leaks nothing', listTicketResponses('TKT-0001', {}).every((r) => !r.is_internal));
check('agents opting in see everything', listTicketResponses('TKT-0001', { includeInternal: true }).length === 3);
check('the internal note is the one withheld',
  !listTicketResponses('TKT-0001').some((r) => r.body.includes('history of duplicates')));

console.log('\nRole gate');
check('admin works tickets', canWorkTickets('admin'));
check('procurement-manager works tickets', canWorkTickets('procurement-manager'));
check('operations-lead works tickets', canWorkTickets('operations-lead'));
check('service-owner does not', !canWorkTickets('service-owner'));
check('vendor-manager does not', !canWorkTickets('vendor-manager'));
check('supplier does not', !canWorkTickets('supplier'));

console.log('\nStatus lifecycle');
check('resolving without a note throws', (() => {
  try { setTicketStatus('resolved'); return false; } catch { return true; }
})());
check('resolving with a note stamps resolved_at',
  setTicketStatus('resolved', 'Fixed the access rights.').resolved_at !== null);
check('resolution is trimmed and kept',
  setTicketStatus('resolved', '  Fixed.  ').resolution === 'Fixed.');
check('cancelled is terminal too', setTicketStatus('cancelled').resolved_at !== null);
check('cancelling needs no note', setTicketStatus('cancelled').status === 'cancelled');
check('reopening clears resolved_at', setTicketStatus('in-progress').resolved_at === null);
check('waiting-on-user is not terminal', setTicketStatus('waiting-on-user').resolved_at === null);

console.log('\nQueue filters');
check('unassigned view', listTickets('', { allTickets: true, ownerId: 'unassigned' }).length === 2);
check('unassigned view has no owners',
  listTickets('', { allTickets: true, ownerId: 'unassigned' }).every((t) => t.owner_id === null));
check('mine view', listTickets('', { allTickets: true, ownerId: 'u-2' }).length === 2);
check('open filter', listTickets('', { allTickets: true, status: 'open' }).length === 2);

// ── mirrors ticket_links + TICKET_LINK_TYPES ────────────────────────────────
const TICKET_LINK_TYPES = ['purchase-request', 'purchase-order', 'supplier', 'contract', 'invoice'];

const LINKS = [
  { id: 'l1', ticket_id: 'TKT-0001', object_type: 'purchase-order', object_id: 'PO-006', label: 'Bosch' },
  { id: 'l2', ticket_id: 'TKT-0001', object_type: 'supplier', object_id: 'SUP-001', label: 'Robert Bosch GmbH' },
  { id: 'l3', ticket_id: 'TKT-0003', object_type: 'purchase-request', object_id: 'REQ-2025-0107', label: 'Laptops' },
];

const listTicketLinks = (ticketId) => LINKS.filter((l) => l.ticket_id === ticketId);
const listTicketsForObject = (type, id) =>
  LINKS.filter((l) => l.object_type === type && l.object_id === id)
       .map((l) => TICKETS.find((t) => t.id === l.ticket_id))
       .filter(Boolean);

console.log('\nReferences');
check('a ticket carries multiple references', listTicketLinks('TKT-0001').length === 2);
check('references span object types',
  new Set(listTicketLinks('TKT-0001').map((l) => l.object_type)).size === 2);
check('a ticket with no references returns empty', listTicketLinks('TKT-0002').length === 0);
check('every link type is in the canonical set',
  LINKS.every((l) => TICKET_LINK_TYPES.includes(l.object_type)));
check('reverse lookup finds the ticket from a PO',
  listTicketsForObject('purchase-order', 'PO-006').map((t) => t.id).join() === 'TKT-0001');
check('reverse lookup finds the ticket from a supplier',
  listTicketsForObject('supplier', 'SUP-001').map((t) => t.id).join() === 'TKT-0001');
check('reverse lookup on an unlinked object is empty',
  listTicketsForObject('supplier', 'SUP-999').length === 0);
check('the same object linked to a different ticket does not bleed across',
  listTicketsForObject('purchase-request', 'REQ-2025-0107').map((t) => t.id).join() === 'TKT-0003');

// The unique constraint means re-linking the same object is a no-op, not a
// duplicate row — the data layer returns the existing link rather than erroring.
const isDuplicate = (ticketId, type, objectId) =>
  LINKS.some((l) => l.ticket_id === ticketId && l.object_type === type && l.object_id === objectId);
check('re-linking the same object is detected as a duplicate',
  isDuplicate('TKT-0001', 'purchase-order', 'PO-006'));
check('linking a different object is not a duplicate',
  !isDuplicate('TKT-0001', 'purchase-order', 'PO-007'));

console.log(failures === 0 ? '\n\x1b[32mAll checks passed\x1b[0m' : `\n\x1b[31m${failures} check(s) failed\x1b[0m`);
process.exit(failures === 0 ? 0 : 1);
