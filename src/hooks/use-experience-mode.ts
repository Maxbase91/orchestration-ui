// Resolves the requester's Simple/Expert mode: a stored preference when set,
// otherwise the role default. Persisted through user preferences so the choice
// survives a reload, and normalised so an unrecognised stored value falls back
// to the default rather than rendering neither surface.
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useUpdateUserPreferences, useUserPreferences } from '@/lib/db/hooks/use-user-preferences';
import {
  canUseSimpleExperience,
  defaultExperienceMode,
  normalizeExperienceMode,
  type ExperienceMode,
} from '@/lib/experience-mode';

/**
 * The optimistic selection, shared across every consumer of this hook.
 *
 * It used to be `useState` inside the hook, which meant each caller held its
 * own copy: the switcher updated instantly while the intake page waited for the
 * preference write to land and the query to refetch. That was invisible while
 * the two modes were two page components — the switch swapped which one
 * mounted — but with one page and a density prop, clicking "Expert view" left
 * the page in Simple until the round trip finished.
 *
 * A module-level store rather than a context: this is one value, read in a
 * handful of places, and a provider would have to wrap the app for it.
 */
let optimisticSelection: { userId: string; mode: ExperienceMode } | null = null;
const selectionListeners = new Set<() => void>();

function subscribeToSelection(listener: () => void): () => void {
  selectionListeners.add(listener);
  return () => { selectionListeners.delete(listener); };
}

function setOptimisticSelection(next: { userId: string; mode: ExperienceMode }): void {
  optimisticSelection = next;
  for (const listener of selectionListeners) listener();
}

interface ExperienceModeState {
  mode: ExperienceMode;
  canUseSimple: boolean;
  isLoading: boolean;
  setMode: (mode: ExperienceMode) => void;
}

/** Resolves a role default plus a per-user preference without changing auth. */
export function useExperienceMode(): ExperienceModeState {
  const { currentRole, currentUser } = useAuthStore();
  const { data: preferences, isLoading } = useUserPreferences(currentUser.id);
  const updatePreferences = useUpdateUserPreferences(currentUser.id);
  const localSelection = useSyncExternalStore(
    subscribeToSelection,
    () => optimisticSelection,
    () => optimisticSelection,
  );
  const canUseSimple = canUseSimpleExperience(currentUser.id, currentRole);

  const mode = useMemo(() => {
    const local = localSelection?.userId === currentUser.id ? localSelection.mode : undefined;
    const saved = normalizeExperienceMode(preferences?.requestExperienceMode);
    const selected = local ?? saved ?? defaultExperienceMode(currentRole);
    return selected === 'simple' && !canUseSimple ? 'expert' : selected;
  }, [canUseSimple, currentRole, currentUser.id, localSelection, preferences]);

  const setMode = useCallback((next: ExperienceMode) => {
    const safeMode = next === 'simple' && !canUseSimple ? 'expert' : next;
    setOptimisticSelection({ userId: currentUser.id, mode: safeMode });
    void updatePreferences.mutateAsync({ requestExperienceMode: safeMode }).catch(() => {
      // The local selection keeps the switch responsive; the role default is
      // still the safe fallback on the next session if persistence is offline.
    });
  }, [canUseSimple, currentUser.id, updatePreferences]);

  return { mode, canUseSimple, isLoading, setMode };
}
