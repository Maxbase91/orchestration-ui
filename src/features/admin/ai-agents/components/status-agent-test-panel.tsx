// Test the Status Answers agent with a real question, as any role. It runs the
// same answer the Home box gives — through the connectors, with the saved
// configuration — rather than the canned results the other agents' panels show.
import { useState } from 'react';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { roles, type Role } from '@/config/roles';
import { personaForRole, useAuthStore } from '@/stores/auth-store';
import { answerStatusQuestion } from '@/lib/assistant/status-lookup';
import type { StatusAnswer } from '@/lib/assistant/status-answer';
import { StatusAnswerView } from '@/components/shared/status-answer-view';

export function StatusAgentTestPanel() {
  const currentRole = useAuthStore((s) => s.currentRole);
  const [role, setRole] = useState<Role>(currentRole);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<StatusAnswer | 'not-a-status-question' | null>(null);
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    try {
      const result = await answerStatusQuestion(question, { userId: personaForRole(role).id, role });
      setAnswer(result ?? 'not-a-status-question');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-lg border border-line bg-card p-4">
      <h4 className="text-sm font-semibold text-ink">Test the answer</h4>
      <p className="mt-0.5 text-xs text-ink-3">Ask as a role — the answer uses the saved configuration and live data.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[12rem_1fr]">
        <div>
          <Label htmlFor="status-test-role" className="text-xs text-ink-3">Ask as</Label>
          <select id="status-test-role" className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="status-test-question" className="text-xs text-ink-3">Question</Label>
          <Input
            id="status-test-question"
            className="mt-1"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && question.trim()) void run(); }}
            placeholder="where is REQ-2024-0001? · what's waiting for me? · due date of INV-001"
          />
        </div>
      </div>
      <Button className="mt-3 w-full" onClick={run} disabled={running || !question.trim()}>
        <Play className="size-3.5" />
        {running ? 'Answering…' : 'Ask'}
      </Button>
      {answer && (
        <div className="mt-4 rounded-lg border border-line bg-card-2 p-3" data-testid="status-test-answer">
          {answer === 'not-a-status-question'
            ? <p className="text-sm text-ink-2">Not a status question — it would go to the assistant instead.</p>
            : <StatusAnswerView answer={answer} />}
        </div>
      )}
    </div>
  );
}
