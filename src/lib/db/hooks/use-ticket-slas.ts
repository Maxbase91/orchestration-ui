// Support-ticket response targets (Admin → Support SLAs).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listTicketSlas, saveTicketSla, type TicketSla } from '../ticket-slas';

const KEY = ['ticket-slas'] as const;

export function useTicketSlas() {
  return useQuery<TicketSla[]>({ queryKey: KEY, queryFn: listTicketSlas });
}

export function useSaveTicketSla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sla: TicketSla) => saveTicketSla(sla),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
