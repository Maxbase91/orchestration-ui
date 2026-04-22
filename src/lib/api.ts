// Thin wrappers around the handful of Vercel serverless routes that remain after
// the Wave 1 migration. Every read/write for an individual entity now goes
// through `src/lib/db/*` + React Query hooks — use those instead of adding new
// helpers here.
//
// Retained:
// - apiWorkflowAction: multi-table transactional status change (requests +
//   stage_history) — lives server-side for atomicity.
// - apiSaveConversation: persists chat-intake transcripts; paired with the
//   LLM calls in api/ai.ts + api/chat-intake.ts.

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

export async function apiSaveConversation(data: {
  requestId: string;
  messages: unknown[];
  category: string;
  status: string;
}): Promise<void> {
  const res = await fetch('/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      request_id: data.requestId,
      messages: data.messages,
      category: data.category,
      status: data.status,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? 'Failed to save conversation');
  }
}
