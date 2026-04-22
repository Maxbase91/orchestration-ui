import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from '@/data/types';
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
} from '../users';

const KEYS = {
  all: ['users'] as const,
  list: () => ['users', 'list'] as const,
  detail: (id: string) => ['users', 'detail', id] as const,
};

export function useUsers() {
  return useQuery({
    queryKey: KEYS.list(),
    queryFn: listUsers,
  });
}

export function useUser(id: string | undefined) {
  return useQuery({
    queryKey: KEYS.detail(id ?? ''),
    queryFn: () => getUser(id!),
    enabled: Boolean(id),
  });
}

/**
 * Synchronous lookup over the cached user list. Pair with `useUsers()` in the
 * same component so the cache is primed.
 */
export function useUserLookup() {
  const { data } = useUsers();
  return (id: string | undefined): User | undefined => {
    if (!id) return undefined;
    return data?.find((u) => u.id === id);
  };
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (record: User) => createUser(record),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<User> }) => updateUser(id, patch),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: KEYS.list() });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}
