import { useState, useEffect } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AIAgent } from '@/data/types';
import { toast } from 'sonner';
import { useSaveAiAgent } from '@/lib/db/hooks/use-ai-agents';


const AGENT_TYPES = [
  { value: 'classification', label: 'Classification' },
  { value: 'validation', label: 'Validation' },
  { value: 'extraction', label: 'Extraction' },
  { value: 'recommendation', label: 'Recommendation' },
  { value: 'knowledge-base', label: 'Knowledge Base' },
  { value: 'anomaly-detection', label: 'Anomaly Detection' },
];

interface AgentConfigFormProps {
  agent: AIAgent;
  onClose: () => void;
  /** Called after the agent persists, so the page can drop its edit buffer. */
  onSaved?: () => void;
}

export function AgentConfigForm({ agent, onClose, onSaved }: AgentConfigFormProps) {
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description);
  const [type, setType] = useState(agent.type);
  const [status, setStatus] = useState(agent.status);

  useEffect(() => {
    setName(agent.name);
    setDescription(agent.description);
    setType(agent.type);
    setStatus(agent.status);
  }, [agent]);


  const saveAiAgent = useSaveAiAgent();

  async function handleSave() {
    const updated: AIAgent = {
      ...agent,
      name,
      description,
      type,
      status,
      lastUpdated: new Date().toISOString(),
    };
    try {
      await saveAiAgent.mutateAsync(updated);
      // Release the page's edit buffer so the refetched agent renders.
      onSaved?.();
      toast.success(`Agent "${name}" saved.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      toast.error(`Save failed: ${msg}`);
    }
  }

  return (
    <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Agent Configuration</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      {/* Basic info */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="text-xs text-gray-500">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs text-gray-500">Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as AIAgent['type'])}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-xs text-gray-500">Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1" />
      </div>

      <div className="flex items-center gap-4">
        <Label className="text-xs text-gray-500">Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as AIAgent['status'])}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* What this agent actually configures.
          There used to be four more sections here — an Input Configuration
          checkbox list, a confidence-threshold slider, Human Override and
          Feedback Loop switches, and hardcoded Rules & Logic / Output
          Configuration panels rendered as if they were state. None of them were
          included in the save payload, none were seeded from the agent (so every
          agent showed identical values), and `ai_agents` has no columns for any
          of them. The only field any runtime code reads is `status`, which gates
          the classifier in api/ai.ts.

          They were removed rather than wired up: persisting a confidence
          threshold nothing consults would be configuration for a reader that
          does not exist, which is the same shape as the toast that said
          "configuration saved" while sending four fields. */}
      <p className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
        Setting an agent to <span className="font-medium">Active</span> is what enables it.
        A disabled or draft agent returns a deterministic response instead of calling the
        model. Thresholds and input selection are not configurable yet.
      </p>

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saveAiAgent.isPending} className="flex-1">
          <Save className="size-4" />
          {saveAiAgent.isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="outline" onClick={onClose} className="flex-1">
          Cancel
        </Button>
      </div>
    </div>
  );
}
