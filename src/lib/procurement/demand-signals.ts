// The governance read available at capture time.
//
// The service description is written at wizard step 3; materiality, inherent
// risk and sourcing type are determined at steps 4–5. So generation used to see
// only `category, title, value, supplier, timeline, capturedAnswers,
// commodityCode` — none of the signals that decide what a description actually
// has to cover. A material, high-risk, competitively-sourced engagement needs
// exit provisions, data handling and evaluable acceptance criteria; a €4k
// stationery order does not. The generator could not tell them apart.
//
// This module computes the *provisional* read from what IS known when the chat
// runs, so generation can be steered by it. It composes the existing decisioning
// modules rather than reimplementing them — `determineMateriality`,
// `determineInherentRisk`, `competitiveSourcingCheck` — all reading thresholds
// from the governed policy config.
//
// Two rules it holds to, because this is a governance artefact and not a hint:
//
//  * It invents nothing. Every value carries the driver that produced it, and
//    anything not yet knowable is `'unknown'` rather than a plausible guess.
//  * It is preliminary and says so. The determination at step 5 recomputes with
//    the full picture; `gapsAgainstFinal` reports what the final read requires
//    that the draft lacks, so the requester is told rather than having the
//    document silently rewritten under them.

import { determineMateriality, type Criticality } from './materiality';
import { determineInherentRisk, type RiskTier } from './risk-segmentation';
import { competitiveSourcingCheck, isPreferredSupplier } from './supplier-preference';
import { getActivePolicyConfig, type PolicyConfig } from './policy-config';
import type { Supplier } from '@/data/types';

export type DataSensitivity = 'none' | 'low' | 'medium' | 'high' | 'critical';

/** The sections of a service description that carry text worth scanning. */
export interface SensitivitySource {
  objective?: string;
  scope?: string;
  deliverables?: string;
  resources?: string;
  narrative?: string;
}

/**
 * Infer how sensitive the data handled by this engagement is, from what the
 * requester described.
 *
 * Moved verbatim out of `step-compliance.tsx`, where it sat inside a
 * 1,200-line component. It is the single link between the service description
 * and risk — it drives the inherent-risk cascade, materiality, the operational
 * risk screen and the triage gate — and it was unreachable by any test and
 * unusable by the workflow. The keyword lists and the `medium` defaults are
 * unchanged, deliberately: this is a move, not a retune.
 *
 * Note the two different `medium` returns. An empty description defaults to
 * medium because "we know nothing" must not read as "nothing sensitive"; a
 * described engagement matching no keyword also lands on medium as the neutral
 * middle. Both are conservative on purpose.
 */
export function inferDataSensitivity(sow: SensitivitySource | null | undefined): DataSensitivity {
  const blob = [sow?.objective, sow?.scope, sow?.deliverables, sow?.resources, sow?.narrative]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (!blob) return 'medium';
  const critical = ['payment data', 'card data', 'pci', 'health data', 'medical records', 'classified', 'state secret'];
  const high = ['personal data', 'pii', 'gdpr', 'customer data', 'confidential', 'financial records', 'payroll', 'employee data', 'ip address'];
  const medium = ['internal', 'proprietary', 'commercial', 'contract terms', 'supplier data'];
  const low = ['public', 'marketing', 'brochure', 'website content'];
  if (critical.some((k) => blob.includes(k))) return 'critical';
  if (high.some((k) => blob.includes(k))) return 'high';
  if (medium.some((k) => blob.includes(k))) return 'medium';
  if (low.some((k) => blob.includes(k))) return 'low';
  return 'medium';
}

export interface DemandSignalsInput {
  category: string;
  value: number;
  /** The supplier named or matched so far, if any. */
  supplier?: Partial<Supplier> | null;
  /** What the requester has described so far — drives data sensitivity. */
  sow?: SensitivitySource | null;
  /** A transactable contract already covers this (from the intake pre-check). */
  contractCovered?: boolean;
}

export interface DemandSignals {
  materiality: Criticality;
  material: boolean;
  inherentRiskTier: RiskTier;
  dataSensitivity: DataSensitivity;
  competitiveSourcingRequired: boolean;
  /** What sourcing is likely to look like — a hint, not the determination. */
  sourcingTypeHint: 'none' | 'call-off' | 'competitive' | 'unknown';
  /** Why each value came out as it did. Never empty for a non-default read. */
  drivers: string[];
  /** True while the signals are the capture-time read, not the determination. */
  preliminary: true;
}

/**
 * The provisional governance read for a demand being captured.
 *
 * `criticalService` and `privilegedAccess` are deliberately NOT passed to the
 * cascades: both come from the stage-5 mini-IRQ, which has not run yet. Guessing
 * them here would inflate materiality on demands that turn out not to qualify,
 * and the whole point of this module is that it does not guess.
 */
export function computeDemandSignals(
  input: DemandSignalsInput,
  config: PolicyConfig = getActivePolicyConfig(),
): DemandSignals {
  const drivers: string[] = [];
  const dataSensitivity = inferDataSensitivity(input.sow);
  if (input.sow && Object.values(input.sow).some((v) => v?.trim())) {
    drivers.push(`Data sensitivity read as ${dataSensitivity} from the description`);
  } else {
    drivers.push('Data sensitivity defaulted to medium — nothing described yet');
  }

  const supplierRisk = input.supplier?.riskRating as RiskTier | undefined;
  if (supplierRisk) drivers.push(`Supplier risk rating is ${supplierRisk}`);

  const materialityResult = determineMateriality(
    { dataSensitivity, riskRating: supplierRisk, value: input.value },
    config,
  );
  drivers.push(...materialityResult.reasons);

  const risk = determineInherentRisk(
    { dataSensitivity, supplierRiskRating: supplierRisk, value: input.value },
    config,
  );
  drivers.push(...risk.drivers);

  const isPreferred = input.supplier ? isPreferredSupplier(input.supplier as Supplier) : false;
  const competitive = competitiveSourcingCheck(
    { value: input.value, category: input.category, isPreferred },
    config,
  );
  const competitiveSourcingRequired = !competitive.passed;
  if (competitiveSourcingRequired) drivers.push(competitive.detail);

  // A hint, not the determination: `determineSourcingType` at step 5 has the
  // contract check, the incumbent and the renewal signal. All that can honestly
  // be said here is whether something already covers this and whether the value
  // puts it over the competitive threshold.
  const sourcingTypeHint: DemandSignals['sourcingTypeHint'] = input.contractCovered
    ? 'call-off'
    : competitiveSourcingRequired
      ? 'competitive'
      : input.value > 0
        ? 'none'
        : 'unknown';

  return {
    materiality: materialityResult.criticality,
    material: materialityResult.material,
    inherentRiskTier: risk.tier,
    dataSensitivity,
    competitiveSourcingRequired,
    sourcingTypeHint,
    drivers,
    preliminary: true,
  };
}

/** The shape the generation route and the stored description both carry. */
export type StoredSignals = Omit<DemandSignals, 'preliminary'> & { preliminary?: boolean };

/**
 * Sections the final determination requires that the draft does not have.
 *
 * The reason generation is not simply re-run at step 5: a document that rewrites
 * itself after the requester thought it was finished is worse than one that says
 * what is missing. `requiredSections` comes from the template's `requiredWhen`
 * conditions, so what counts as required is config, not a constant here.
 */
export function gapsAgainstFinal(
  requiredSections: string[],
  sections: Record<string, string | undefined>,
): string[] {
  return requiredSections.filter((id) => !sections[id]?.trim());
}
