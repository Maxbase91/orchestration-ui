import { useState, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { aiAgents } from '@/data/ai-agents';
import type { AIAgent } from '@/data/types';
import { AgentLibrary } from './components/agent-library';
import { AgentConfigForm } from './components/agent-config-form';
import { AgentTestPanel } from './components/agent-test-panel';
import { AgentPerformance } from './components/agent-performance';

export function AIAgentsPage() {
  const [agents, setAgents] = useState<AIAgent[]>(aiAgents);
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
    setAgents((prev) => [...prev, newAgent]);
    setSelectedAgent(newAgent);
  }, [agents.length]);

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
