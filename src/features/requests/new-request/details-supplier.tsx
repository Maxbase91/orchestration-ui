// The supplier question on the Details step — who the requester expects to buy
// from, if they know.
//
// It is what remained of the "compliance" step (step-compliance.tsx) once its
// conclusions moved to the Channel page on 2026-09-26. Two other pieces went
// with that file rather than moving here: an intake copy of the IT Security
// Assessment, which discarded what was typed and then said "submitted" (the
// form is filled at the risk stage it is configured for, where it is saved);
// and a "smart assessment" that re-derived contract coverage and the need for
// sourcing with its own €25,000 literal, beside the determination that decides
// both.
import type { Supplier } from '@/data/types';
import { SupplierRecommenderCard } from './components/supplier-recommender-card';

interface DetailsSupplierProps {
  category: string;
  estimatedValue: number;
  supplierId: string;
  supplier?: string;
  /** How the current supplier got here — a named one is a suggestion to confirm. */
  supplierProvenance?: 'named' | 'chosen';
  onSelectSupplier: (supplier: Supplier) => void;
  supplierCandidateIds: readonly string[];
  onToggleSupplierCandidate: (supplier: Supplier) => void;
  supplierIntent?: 'named' | 'to-be-sourced';
  onSupplierIntentChange: (intent: 'named' | 'to-be-sourced') => void;
  supplierOverrideReason?: string;
  onSupplierOverrideReasonChange: (reason: string) => void;
}

export function DetailsSupplier(props: DetailsSupplierProps) {
  return (
    <div className="space-y-3">
      <div className="pt-1">
        <div className="flex items-center gap-2">
          <span className="text-eyebrow font-semibold uppercase tracking-wider text-ink-3">Supplier</span>
          <span className="h-px flex-1 bg-idle-soft" />
        </div>
        <p className="mt-1 text-xs text-ink-3">
          Who you expect to buy from, if you already know. Leaving it open is fine — sourcing will identify candidates.
        </p>
      </div>
      <SupplierRecommenderCard
        category={props.category}
        estimatedValue={props.estimatedValue}
        selectedSupplierId={props.supplierId}
        selectedSupplierName={props.supplier}
        supplierProvenance={props.supplierProvenance}
        onSelect={props.onSelectSupplier}
        candidateIds={props.supplierCandidateIds}
        onToggleCandidate={props.onToggleSupplierCandidate}
        intent={props.supplierIntent}
        onIntentChange={props.onSupplierIntentChange}
        overrideReason={props.supplierOverrideReason}
        onOverrideReasonChange={props.onSupplierOverrideReasonChange}
      />
    </div>
  );
}
