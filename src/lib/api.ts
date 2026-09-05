// Thin wrappers around the handful of Vercel serverless routes that remain after
// the Wave 1 migration. Every read/write for an individual entity now goes
// through `src/lib/db/*` + React Query hooks — use those instead of adding new
// helpers here.
//
// Retained:
// - apiWorkflowAction: multi-table status change (requests + stage_history) —
//   lives server-side so both writes commit together.

export async function apiWorkflowAction(data: {
  requestId: string;
  action: string;
  newStatus: string;
  ownerId?: string;
  notes?: string;
}): Promise<void> {
  const res = await fetch('/api/workflow-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? 'Failed to execute workflow action');
  }
}
