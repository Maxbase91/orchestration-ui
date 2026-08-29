import { useCallback, useMemo, useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useUpdateUserPreferences, useUserPreferences } from '@/lib/db/hooks/use-user-preferences';
import {
  canUseSimpleExperience,
  defaultExperienceMode,
  normalizeExperienceMode,
  type ExperienceMode,
} from '@/lib/experience-mode';

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
  const [localSelection, setLocalSelection] = useState<{ userId: string; mode: ExperienceMode } | null>(null);
  const canUseSimple = canUseSimpleExperience(currentUser.id, currentRole);

  const mode = useMemo(() => {
    const local = localSelection?.userId === currentUser.id ? localSelection.mode : undefined;
    const saved = normalizeExperienceMode(preferences?.requestExperienceMode);
    const selected = local ?? saved ?? defaultExperienceMode(currentRole);
    return selected === 'simple' && !canUseSimple ? 'expert' : selected;
  }, [canUseSimple, currentRole, currentUser.id, localSelection, preferences]);

  const setMode = useCallback((next: ExperienceMode) => {
    const safeMode = next === 'simple' && !canUseSimple ? 'expert' : next;
    setLocalSelection({ userId: currentUser.id, mode: safeMode });
    void updatePreferences.mutateAsync({ requestExperienceMode: safeMode }).catch(() => {
      // The local selection keeps the switch responsive; the role default is
      // still the safe fallback on the next session if persistence is offline.
    });
  }, [canUseSimple, currentUser.id, updatePreferences]);

  return { mode, canUseSimple, isLoading, setMode };
}
