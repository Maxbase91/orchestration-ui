import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserPreferences, updateUserPreferences, type UserPrefs } from '@/lib/db/user-preferences';

const KEYS = {
  all: ['user-preferences'] as const,
  byUser: (userId: string) => ['user-preferences', userId] as const,
};

export function useUserPreferences(userId: string | undefined) {
  return useQuery({
    queryKey: KEYS.byUser(userId ?? ''),
    queryFn: () => getUserPreferences(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000, // 5 min — prefs rarely change
  });
}

export function useUpdateUserPreferences(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<UserPrefs>) => updateUserPreferences(userId!, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.byUser(userId ?? '') });
    },
  });
}
