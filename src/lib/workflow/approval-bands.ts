// Approval-chain value bands — the fourth dialect, folded into the spine.
//
// A chain's applicability was a free-text English string ("< 10,000",
// "100,000 - 500,000") parsed by regex at read time. Three problems with that,
// all of which have bitten:
//
//  1. A string with no number parsed as [0, ∞), so it matched EVERY value and,
//     being found first, shadowed every properly banded chain behind it. The
//     column defaults to '' and the admin page created new chains at 'TBD', so
//     this was reachable two ways without anyone typing anything odd.
//  2. The numbers were literals, unrelated to the governed thresholds even when
//     they were the same number — 100,000 is `budgetApprovalThreshold` and
//     500,000 is `delegatedAuthorityThreshold`, and moving either moved nothing
//     here.
//  3. Nothing checked the bands were coherent, so a gap or an overlap between
//     two chains was invisible until a request landed in it.
//
// Bands are structured now: `minValue`/`maxValue`, each a literal or a
// `policy:<key>` token, each nullable to mean "open at this end". `null` for
// the resolved band means NOT SELECTABLE BY VALUE — absence is not [0, ∞) —
// which is what lets the compliance chain be reachable by a routing rule
// naming it and by nothing else.
import type { PolicyConfig } from '../procurement/policy-config.js';
import { resolvePolicyValue, describePolicyValue } from '../procurement/policy-tokens.js';

export interface BandSpec {
  /** Inclusive lower bound. A literal, a `policy:` token, or null for open. */
  minValue?: string | null;
  /** Exclusive upper bound. A literal, a `policy:` token, or null for open. */
  maxValue?: string | null;
}

export interface ChainBand {
  min: number;
  max: number;
}

function bound(raw: string | null | undefined, config: PolicyConfig, fallback: number): number | null {
  if (raw === null || raw === undefined || raw === '') return fallback;
  const resolved = resolvePolicyValue(raw, config);
  if (resolved.unresolved) return null;
  const n = Number(resolved.value);
  return Number.isFinite(n) ? n : null;
}

/**
 * The numeric band, or `null` when this chain must not be selected by value.
 *
 * Null happens when neither end is set (the chain has no band at all) or when a
 * bound names a governed threshold that no longer exists. Both mean "we do not
 * know what this chain applies to", and the answer to that is to leave it out,
 * not to let it swallow everything.
 */
export function resolveBand(spec: BandSpec, config: PolicyConfig): ChainBand | null {
  const hasMin = spec.minValue !== null && spec.minValue !== undefined && spec.minValue !== '';
  const hasMax = spec.maxValue !== null && spec.maxValue !== undefined && spec.maxValue !== '';
  if (!hasMin && !hasMax) return null;

  const min = bound(spec.minValue, config, 0);
  const max = bound(spec.maxValue, config, Infinity);
  if (min === null || max === null) return null;
  if (max <= min) return null;
  return { min, max };
}

/**
 * "€10,000 – €100,000", for the chain list and the stored display label.
 *
 * Amounts only, deliberately. Whether a bound is governed or literal is an
 * editing concern — the editor says so beside the field it applies to — and
 * mixing the two forms produced labels like "Above €500,000 — delegated
 * authority threshold" next to a bare "Below €10,000", which reads as though
 * the two chains work differently.
 */
export function bandLabel(spec: BandSpec, config: PolicyConfig): string {
  const band = resolveBand(spec, config);
  if (!band) return 'By routing rule only';
  const money = (n: number) => `€${n.toLocaleString('en-GB')}`;
  if (band.max === Infinity) return `Above ${money(band.min)}`;
  if (band.min === 0) return `Below ${money(band.max)}`;
  return `${money(band.min)} – ${money(band.max)}`;
}

/** Which bounds follow a governed threshold, for the editor to show. */
export function governedBounds(spec: BandSpec, config: PolicyConfig): { min: string | null; max: string | null } {
  const named = (raw: string | null | undefined) => {
    if (!raw) return null;
    const resolved = resolvePolicyValue(raw, config);
    return resolved.key ? describePolicyValue(resolved) : null;
  };
  return { min: named(spec.minValue), max: named(spec.maxValue) };
}

/** Select the chain whose band contains `value`. Unbanded chains are skipped. */
export function selectChainForValue<T extends BandSpec & { id: string }>(
  chains: T[],
  value: number,
  config: PolicyConfig,
): T | undefined {
  return chains.find((c) => {
    const band = resolveBand(c, config);
    return band !== null && value >= band.min && value < band.max;
  });
}

export interface ChainDiagnostic {
  chainId: string;
  chainName: string;
  problems: string[];
}

/**
 * Bands that cannot do their job, for the admin page.
 *
 * A chain with no band is NOT reported: that is the legitimate way to say
 * "reachable only by a routing rule naming me". What is reported is a band that
 * is malformed, one that overlaps another (two chains claiming the same value —
 * whichever is found first silently wins), and a gap between adjacent bands
 * (a value with no chain at all, which is how a request reaches the approval
 * stage with nobody able to approve it).
 */
export function diagnoseChains<T extends BandSpec & { id: string; name: string }>(
  chains: T[],
  config: PolicyConfig,
): ChainDiagnostic[] {
  const out: ChainDiagnostic[] = [];
  const banded: { chain: T; band: ChainBand }[] = [];

  for (const chain of chains) {
    const problems: string[] = [];
    const hasAny = [chain.minValue, chain.maxValue].some((v) => v !== null && v !== undefined && v !== '');
    if (hasAny) {
      const band = resolveBand(chain, config);
      if (!band) {
        problems.push('The value band is malformed — this chain can never be selected by value.');
      } else {
        banded.push({ chain, band });
      }
    }
    if (chain.minValue && resolvePolicyValue(chain.minValue, config).unresolved) {
      problems.push(`Lower bound "${chain.minValue}" names a governed threshold that does not exist.`);
    }
    if (chain.maxValue && resolvePolicyValue(chain.maxValue, config).unresolved) {
      problems.push(`Upper bound "${chain.maxValue}" names a governed threshold that does not exist.`);
    }
    if (problems.length) out.push({ chainId: chain.id, chainName: chain.name, problems });
  }

  banded.sort((a, b) => a.band.min - b.band.min);
  for (let i = 0; i < banded.length; i += 1) {
    const here = banded[i];
    const next = banded[i + 1];
    const add = (problem: string) => {
      const existing = out.find((d) => d.chainId === here.chain.id);
      if (existing) existing.problems.push(problem);
      else out.push({ chainId: here.chain.id, chainName: here.chain.name, problems: [problem] });
    };
    if (i === 0 && here.band.min > 0) {
      add(`Nothing approves a request below €${here.band.min.toLocaleString('en-GB')}.`);
    }
    if (!next) {
      if (here.band.max !== Infinity) {
        add(`Nothing approves a request at or above €${here.band.max.toLocaleString('en-GB')}.`);
      }
      continue;
    }
    if (next.band.min < here.band.max) {
      add(`Overlaps "${next.chain.name}" — both claim €${next.band.min.toLocaleString('en-GB')}, and whichever is found first silently wins.`);
    } else if (next.band.min > here.band.max) {
      add(`Nothing approves a request between €${here.band.max.toLocaleString('en-GB')} and €${next.band.min.toLocaleString('en-GB')}.`);
    }
  }
  return out;
}
