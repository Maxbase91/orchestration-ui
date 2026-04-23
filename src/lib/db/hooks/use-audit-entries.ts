import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuditEntry } from '@/data/types';
import { listAuditEntries, createAuditEntry } from '../audit-entries';

const KEYS = {
  all: ['audit-entries'] as const,
  list: () => ['audit-entries', 'list'] as const,
};

export function useAuditEntries() {
  return useQuery({
    queryKey: KEYS.list(),
    queryFn: () => listAuditEntries(),
    // Refresh periodically so the audit log stays close to real-time
    // without needing a realtime subscription.
    refetchInterval: 30_000,
  });
}

export function useCreateAuditEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (record: Omit<AuditEntry, 'id'> & { id?: string }) => createAuditEntry(record),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}
