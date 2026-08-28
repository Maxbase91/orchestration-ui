// Admin — AI agent configuration page. Library + detail view for the governed AI
// agents (classification, extraction, etc.) whose settings drive the automated
// decisions made in the front door's intake and determination steps.

import { useState, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { useAiAgents } from '@/lib/db/hooks/use-ai-agents';
import type { AIAgent } from '@/data/types';
import { AgentLibrary } from './components/agent-library';
import { AgentConfigForm } from './components/agent-config-form';
import { AgentTestPanel } from './components/agent-test-panel';
import { AgentPerformance } from './components/agent-performance';

export function AIAgentsPage() {
  const { data: serverAgents = [] } = useAiAgents();
  // `null` until the page owns an edited copy. Before the first edit the server
  // list is shown live; from the first edit onwards local state owns it, so a
  // later refetch cannot clobber in-session additions (draft agents live only
  // in local state).
  //
  // This replaces a seed-once effect. Deriving it says the same thing without
  // the extra render, and without the flash of an empty list while the copy
  // was pending.
  const [editedAgents, setEditedAgents] = useState<AIAgent[] | null>(null);
  const agents = editedAgents ?? serverAgents;
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);

  const handleAddAgent = useCallback(() => {
    const newAgent: AIAgent = {
      id: `AI-${String(agents.length + 1).padStart(3, '0')}`,
      name: 'New Agent',
      type: 'classification',
      status: 'draft',
      accuracy: 0,
      decisionsMade: 0,
      lastUpdated: new Date().toISOString(),
      description: 'Configure this new agent.',
    };
    // `prev` is null until the first edit — fall back to what is on screen.
    setEditedAgents((prev) => [...(prev ?? serverAgents), newAgent]);
    setSelectedAgent(newAgent);
  }, [agents.length, serverAgents]);

  if (selectedAgent) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedAgent(null)}>
            <ArrowLeft className="size-4" />
            Back to Library
          </Button>
        </div>

        <PageHeader
          title={selectedAgent.name}
          subtitle={selectedAgent.description}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <AgentConfigForm
              agent={selectedAgent}
              onClose={() => setSelectedAgent(null)}
            />
            <AgentTestPanel agent={selectedAgent} />
          </div>
          <AgentPerformance agent={selectedAgent} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="AI Agent Configuration"
        subtitle="Manage and configure AI agents that automate procurement decisions."
      />
      <AgentLibrary
        agents={agents}
        onSelectAgent={setSelectedAgent}
        onAddAgent={handleAddAgent}
      />
    </div>
  );
}
