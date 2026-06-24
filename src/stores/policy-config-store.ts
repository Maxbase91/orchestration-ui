import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  type PolicyConfig,
  DEFAULT_POLICY_CONFIG,
  resolvePolicyConfig,
  applyPolicyOverrides,
} from '@/lib/procurement/policy-config';

// Admin-managed overrides for the decisioning thresholds. Persisted, and applied
// to the active policy config (which the decisioning functions default to) on
// every change and on boot — so admin edits drive the live front door.

interface PolicyConfigState {
  /** Only the fields the admin has changed from the defaults. */
  overrides: Partial<PolicyConfig>;
  /** Set/replace one threshold; `undefined` clears it back to the default. */
  setOverride: <K extends keyof PolicyConfig>(key: K, value: PolicyConfig[K] | undefined) => void;
  /** Replace the whole override set (e.g. on Save). */
  setOverrides: (overrides: Partial<PolicyConfig>) => void;
  /** Clear all overrides — back to shipped defaults. */
  reset: () => void;
  /** The effective config = defaults + overrides. */
  effective: () => PolicyConfig;
}

export const usePolicyConfigStore = create<PolicyConfigState>()(
  persist(
    (set, get) => ({
      overrides: {},
      setOverride: (key, value) => {
        const next = { ...get().overrides };
        if (value === undefined || value === DEFAULT_POLICY_CONFIG[key]) delete next[key];
        else next[key] = value;
        set({ overrides: next });
        applyPolicyOverrides(next);
      },
      setOverrides: (overrides) => {
        set({ overrides });
        applyPolicyOverrides(overrides);
      },
      reset: () => {
        set({ overrides: {} });
        applyPolicyOverrides({});
      },
      effective: () => resolvePolicyConfig(get().overrides),
    }),
    {
      name: 'policy-config',
      // Re-apply the persisted overrides to the active config after rehydration.
      onRehydrateStorage: () => (state) => {
        if (state) applyPolicyOverrides(state.overrides);
      },
    },
  ),
);
