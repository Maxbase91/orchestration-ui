import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  type PolicyConfig,
  DEFAULT_POLICY_CONFIG,
  resolvePolicyConfig,
  applyPolicyOverrides,
} from '@/lib/procurement/policy-config';
import { loadPolicyConfig, resetPolicyConfig, savePolicyConfig } from '@/lib/procurement/policy-config-api';

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
  /** Persist the effective config before updating the active browser config. */
  persistOverrides: (overrides: Partial<PolicyConfig>, updatedBy?: string) => Promise<void>;
  /** Hydrate the active config from the server-owned singleton. */
  hydrateFromServer: () => Promise<void>;
  /** Clear all overrides — back to shipped defaults. */
  reset: () => void;
  persistReset: (updatedBy?: string) => Promise<void>;
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
      persistOverrides: async (overrides, updatedBy) => {
        const response = await savePolicyConfig(resolvePolicyConfig(overrides), updatedBy);
        const next = Object.fromEntries(
          (Object.keys(DEFAULT_POLICY_CONFIG) as (keyof PolicyConfig)[])
            .filter((key) => JSON.stringify(response.config[key]) !== JSON.stringify(DEFAULT_POLICY_CONFIG[key]))
            .map((key) => [key, response.config[key]]),
        ) as Partial<PolicyConfig>;
        set({ overrides: next });
        applyPolicyOverrides(next);
      },
      hydrateFromServer: async () => {
        try {
          const response = await loadPolicyConfig();
          const next = Object.fromEntries(
            (Object.keys(DEFAULT_POLICY_CONFIG) as (keyof PolicyConfig)[])
              .filter((key) => JSON.stringify(response.config[key]) !== JSON.stringify(DEFAULT_POLICY_CONFIG[key]))
              .map((key) => [key, response.config[key]]),
          ) as Partial<PolicyConfig>;
          set({ overrides: next });
          applyPolicyOverrides(next);
        } catch {
          // Local defaults/localStorage remain the safe fallback when the API
          // is unavailable; callers do not see a false success message.
        }
      },
      reset: () => {
        set({ overrides: {} });
        applyPolicyOverrides({});
      },
      persistReset: async (updatedBy) => {
        await resetPolicyConfig(updatedBy);
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
