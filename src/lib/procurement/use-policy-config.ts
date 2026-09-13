// The governed thresholds, as a React subscription.
//
// `getActivePolicyConfig()` returns the same values but is a module singleton,
// so a component reading it does not re-render when an admin saves a new
// threshold. Anything that shows a decision — a routing preview, a rule
// diagnostic, a channel — has to re-derive when the numbers move, or the screen
// quietly disagrees with the configuration it is meant to reflect.
//
// `overrides` is selected rather than `effective()` because the latter builds a
// fresh object on every call, which a Zustand selector would treat as a change
// on every render.
import { useMemo } from 'react';
import { usePolicyConfigStore } from '@/stores/policy-config-store';
import { resolvePolicyConfig, type PolicyConfig } from './policy-config';

export function usePolicyConfig(): PolicyConfig {
  const overrides = usePolicyConfigStore((s) => s.overrides);
  return useMemo(() => resolvePolicyConfig(overrides), [overrides]);
}
