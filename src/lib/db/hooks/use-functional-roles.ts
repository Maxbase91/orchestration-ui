// Functional roles and the role map every approval gate reads.
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listFunctionalRoles, upsertFunctionalRole, deleteFunctionalRole } from '../functional-roles';
import type { FunctionalRole } from '@/data/functional-roles';
import { roleMapFrom, type RoleMap } from '@/lib/procurement/approval-derivation';

const KEY = ['functional-roles'] as const;

export function useFunctionalRoles() {
  return useQuery<FunctionalRole[]>({ queryKey: KEY, queryFn: listFunctionalRoles, staleTime: 5 * 60_000 });
}

/** Functional role → the system role whose holders act as it. Empty until loaded: nobody may act on a role step. */
export function useRoleMap(): RoleMap {
  const { data } = useFunctionalRoles();
  return useMemo(() => roleMapFrom(data ?? []), [data]);
}

export function useUpsertFunctionalRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (role: FunctionalRole) => upsertFunctionalRole(role),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); qc.invalidateQueries({ queryKey: ['derived-approvers'] }); },
  });
}

export function useDeleteFunctionalRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => deleteFunctionalRole(name),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); qc.invalidateQueries({ queryKey: ['derived-approvers'] }); },
  });
}
