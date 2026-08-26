#!/usr/bin/env node
// Verifies ticket SLA: target lookup, due-date computation, breach/at-risk
// classification, the waiting-on-user pause, and the queue metrics.
//
// The pause is the rule most likely to be broken by a later change: while the
// requester is the blocker, an agent-side breach would be a lie.
//
// Self-contained — mirrors src/lib/procurement/ticket-sla.ts. Keep in sync.
// Run: node tests/integration/ticket-sla.mjs

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

const DEFAULT_TICKET_SLA_HOURS = 8;
const AT_RISK_THRESHOLD_HOURS = 1;
const HOUR_MS = 60 * 60 * 1000;
const PAUSED_STATUSES = ['waiting-on-user', 'resolved', 'cancelled'];

const TARGETS = [
  { channel: 'high', hours: 4 },
  { channel: 'medium', hours: 8 },
  { channel: 'low', hours: 24 },
  { channel: 'default', hours: 8 },
];

function slaHoursForPriority(priority, targets) {
  const exact = targets.find((t) => t.channel === (priority ?? 'default'));
  if (exact) return exact.hours;
  return targets.find((t) => t.channel === 'default')?.hours ?? DEFAULT_TICKET_SLA_HOURS;
}

function computeDueAt(from, priority, targets) {
  return new Date(from.getTime() + slaHoursForPriority(priority, targets) * HOUR_MS).toISOString();
}

const isSlaPaused = (status) => PAUSED_STATUSES.includes(status);

function slaState(ticket, now = new Date()) {
  if (isSlaPaused(ticket.status)) return 'paused';
  if (!ticket.dueAt) return 'none';
  const remaining = new Date(ticket.dueAt).getTime() - now.getTime();
  if (remaining <= 0) return 'breached';
  if (remaining <= AT_RISK_THRESHOLD_HOURS * HOUR_MS) return 'at-risk';
  return 'on-track';
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function ticketSlaMetrics(tickets, now = new Date()) {
  const openTickets = tickets.filter((t) => t.status !== 'resolved' && t.status !== 'cancelled');
  const resolvedDurations = tickets
    .filter((t) => t.status === 'resolved' && t.resolvedAt)
    .map((t) => (new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime()) / HOUR_MS)
    .filter((h) => Number.isFinite(h) && h >= 0);
  const openAges = openTickets.map((t) => (now.getTime() - new Date(t.createdAt).getTime()) / HOUR_MS);
  return {
    open: openTickets.length,
    breached: tickets.filter((t) => slaState(t, now) === 'breached').length,
    atRisk: tickets.filter((t) => slaState(t, now) === 'at-risk').length,
    medianHoursToResolve: median(resolvedDurations),
    oldestOpenHours: openAges.length ? Math.max(...openAges) : null,
  };
}

const NOW = new Date('2026-08-26T12:00:00Z');
const ago = (h) => new Date(NOW.getTime() - h * HOUR_MS).toISOString();
const ahead = (h) => new Date(NOW.getTime() + h * HOUR_MS).toISOString();

console.log('Target lookup');
check('high → 4h', slaHoursForPriority('high', TARGETS) === 4);
check('medium → 8h', slaHoursForPriority('medium', TARGETS) === 8);
check('low → 24h', slaHoursForPriority('low', TARGETS) === 24);
check('unknown priority falls back to default', slaHoursForPriority('urgent', TARGETS) === 8);
check('missing priority falls back to default', slaHoursForPriority(undefined, TARGETS) === 8);
check('no targets at all still bounds the ticket',
  slaHoursForPriority('high', []) === DEFAULT_TICKET_SLA_HOURS);

console.log('\nDue date');
check('high priority is due 4h out',
  computeDueAt(NOW, 'high', TARGETS) === ahead(4));
check('low priority is due 24h out',
  computeDueAt(NOW, 'low', TARGETS) === ahead(24));

console.log('\nClassification');
check('comfortably ahead → on-track',
  slaState({ status: 'open', dueAt: ahead(5) }, NOW) === 'on-track');
check('inside the last hour → at-risk',
  slaState({ status: 'open', dueAt: ahead(0.5) }, NOW) === 'at-risk');
check('exactly at the at-risk threshold → at-risk',
  slaState({ status: 'open', dueAt: ahead(1) }, NOW) === 'at-risk');
check('past due → breached',
  slaState({ status: 'open', dueAt: ago(1) }, NOW) === 'breached');
check('exactly due → breached',
  slaState({ status: 'open', dueAt: NOW.toISOString() }, NOW) === 'breached');
check('no target set → none, not on-track',
  slaState({ status: 'open' }, NOW) === 'none');

console.log('\nThe clock pauses');
check('waiting-on-user is paused, even when overdue',
  slaState({ status: 'waiting-on-user', dueAt: ago(99) }, NOW) === 'paused');
check('resolved is paused', slaState({ status: 'resolved', dueAt: ago(99) }, NOW) === 'paused');
check('cancelled is paused', slaState({ status: 'cancelled', dueAt: ago(99) }, NOW) === 'paused');
check('in-progress still runs', slaState({ status: 'in-progress', dueAt: ago(1) }, NOW) === 'breached');
check('a paused ticket never counts as breached',
  ticketSlaMetrics([{ status: 'waiting-on-user', dueAt: ago(50), createdAt: ago(60) }], NOW).breached === 0);

console.log('\nMetrics');
const FIXTURE = [
  { status: 'open', createdAt: ago(10), dueAt: ago(2) },
  { status: 'in-progress', createdAt: ago(3), dueAt: ahead(0.5) },
  { status: 'open', createdAt: ago(1), dueAt: ahead(6) },
  { status: 'waiting-on-user', createdAt: ago(30), dueAt: null },
  { status: 'resolved', createdAt: ago(20), resolvedAt: ago(14) },
  { status: 'resolved', createdAt: ago(10), resolvedAt: ago(8) },
  { status: 'cancelled', createdAt: ago(40), resolvedAt: ago(39) },
];
const m = ticketSlaMetrics(FIXTURE, NOW);
check('open excludes resolved and cancelled', m.open === 4);
check('breached counts only the overdue running ticket', m.breached === 1);
check('at-risk counts the one inside the last hour', m.atRisk === 1);
check('median to resolve over resolved only (6h, 2h → 4h)', m.medianHoursToResolve === 4);
check('cancelled is excluded from resolution timing',
  ticketSlaMetrics([{ status: 'cancelled', createdAt: ago(40), resolvedAt: ago(39) }], NOW)
    .medianHoursToResolve === null);
check('oldest open is the waiting-on-user ticket at 30h', m.oldestOpenHours === 30);
check('no tickets → null medians, no crash',
  ticketSlaMetrics([], NOW).medianHoursToResolve === null &&
  ticketSlaMetrics([], NOW).oldestOpenHours === null);

console.log(failures === 0 ? '\n\x1b[32mAll checks passed\x1b[0m' : `\n\x1b[31m${failures} check(s) failed\x1b[0m`);
process.exit(failures === 0 ? 0 : 1);
