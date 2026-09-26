// What the platform can honestly say about its upstream handovers.
//
// `/admin/health` reported four green "Connected" cards, 99.97% uptime, a 0.02%
// error rate and 47 active sessions. Every number was a literal, and two of the
// cards were contradicted by the store at the moment they rendered: SAP Ariba
// had a handover in `timeout` and Coupa Risk one in `error`.
//
// There is no uptime to report. Nothing pings these systems — R1 has no live
// connections at all (see AGENTS.md rule 2), so "connected" is not a fact the platform
// possesses, and neither is an error rate or a session count. What it does
// possess is `system_integrations`: one row per handover, with the status it
// reached and, when it came back, when. That is what this derives.
//
// Pure and dependency-free so a test can drive it without a browser.
import type { IntegrationStatus, SystemIntegration } from '../../data/system-integrations.js';

/** Statuses that mean the handover did not land. */
const FAILED: readonly IntegrationStatus[] = ['error', 'timeout'];
/** Statuses that mean it is still out there. */
const OPEN: readonly IntegrationStatus[] = ['pending-handover', 'submitted', 'awaiting-response', 'processing'];

export interface SystemHealth {
  system: string;
  label: string;
  total: number;
  completed: number;
  failed: number;
  open: number;
  /** The most recent submission, or null when this system has never been used. */
  lastActivity: string | null;
  /** Mean submitted→responded, in minutes, over handovers that came back. */
  meanResponseMinutes: number | null;
  /**
   * How the card reads. Not "connected": nothing here is a connection. It is a
   * summary of what happened to the handovers this platform recorded.
   */
  state: 'failing' | 'waiting' | 'healthy' | 'unused';
}

function meanMinutes(records: SystemIntegration[]): number | null {
  const answered = records.filter((r) => r.respondedAt && r.submittedAt);
  if (answered.length === 0) return null;
  const total = answered.reduce((sum, r) => {
    const ms = new Date(r.respondedAt!).getTime() - new Date(r.submittedAt).getTime();
    return sum + (Number.isFinite(ms) && ms > 0 ? ms : 0);
  }, 0);
  return Math.round(total / answered.length / 60_000);
}

/**
 * One row per system the platform hands over to, from the records it holds.
 *
 * `systems` is passed in rather than derived from the records so a system with
 * no handovers still appears — as `unused`, which is a different statement from
 * "healthy" and the one the data supports. A card that silently disappears when
 * a system goes quiet is how an outage looks like a clean dashboard.
 */
export function systemHealth(
  records: SystemIntegration[],
  systems: ReadonlyArray<{ system: string; label: string }>,
): SystemHealth[] {
  return systems.map(({ system, label }) => {
    const mine = records.filter((r) => r.system === system);
    const failed = mine.filter((r) => FAILED.includes(r.status)).length;
    const open = mine.filter((r) => OPEN.includes(r.status)).length;
    const completed = mine.filter((r) => r.status === 'completed').length;
    const lastActivity = mine
      .map((r) => r.submittedAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

    // Failing beats waiting beats healthy: a system with one error and nine
    // completions has a problem, and averaging it away is how the four green
    // cards happened in the first place.
    const state: SystemHealth['state'] =
      mine.length === 0 ? 'unused'
        : failed > 0 ? 'failing'
          : open > 0 ? 'waiting'
            : 'healthy';

    return { system, label, total: mine.length, completed, failed, open, lastActivity, meanResponseMinutes: meanMinutes(mine), state };
  });
}

/** Handovers that did not land, newest first — the real error log. */
export function failedHandovers(records: SystemIntegration[]): SystemIntegration[] {
  return records
    .filter((r) => FAILED.includes(r.status))
    .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
}

/** A duration a person can read: "18 min", "6 h", "13 d". */
export function humaniseMinutes(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 90) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} d`;
}
