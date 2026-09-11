import type { QueryClient as QueryClientType } from '@tanstack/react-query';
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

/**
 * Every cache a request's lifecycle touches.
 *
 * Each action used to invalidate its own subset, chosen by hand, and the
 * subsets disagreed: reassigning refreshed only `requests` although the server
 * also wrote stage history, so the handover appeared nowhere until a reload;
 * referring back missed approvals and the workflow instance; creating a PO
 * refreshed purchase orders and not the request it belonged to. Every one of
 * those was a screen showing something that was no longer true.
 *
 * Over-invalidating costs a refetch of data the user is already looking at.
 * Under-invalidating costs their trust in the screen, so this errs the other
 * way and lists the lot.
 */
export const REQUEST_LIFECYCLE_KEYS = [
  'requests',
  'stage-history',
  'approvals',
  'workflow-instances',
  'workflow-step-details',
  'audit-entries',
  'compliance-reports',
  'purchase-orders',
  'notifications',
] as const;

/** Refetch everything a change to a request's lifecycle can affect. */
export function invalidateRequestViews(client: QueryClientType, ...extra: string[]): void {
  for (const key of [...REQUEST_LIFECYCLE_KEYS, ...extra]) {
    void client.invalidateQueries({ queryKey: [key] });
  }
}
