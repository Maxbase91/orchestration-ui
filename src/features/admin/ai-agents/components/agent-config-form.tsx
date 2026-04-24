import { useState, useEffect } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
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

const INPUT_DATA_OPTIONS = [
  { id: 'request-fields', label: 'Request Fields (title, description, value)' },
  { id: 'documents', label: 'Uploaded Documents' },
  { id: 'supplier-data', label: 'Supplier Data & History' },
  { id: 'contract-data', label: 'Contract Information' },
  { id: 'spend-data', label: 'Historical Spend Data' },
  { id: 'user-context', label: 'User & Department Context' },
  { id: 'market-data', label: 'External Market Data' },
];

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
}

export function AgentConfigForm({ agent, onClose }: AgentConfigFormProps) {
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description);
  const [type, setType] = useState(agent.type);
  const [status, setStatus] = useState(agent.status);
  const [selectedInputs, setSelectedInputs] = useState<string[]>([
    'request-fields',
    'documents',
    'supplier-data',
  ]);
  const [humanOverride, setHumanOverride] = useState(true);
  const [feedbackLoop, setFeedbackLoop] = useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState(85);

  useEffect(() => {
    setName(agent.name);
    setDescription(agent.description);
    setType(agent.type);
    setStatus(agent.status);
  }, [agent]);

  function toggleInput(id: string) {
    setSelectedInputs((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

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
      toast.success(`Agent "${name}" configuration saved.`);
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

      {/* Input Configuration */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Input Configuration
        </h4>
        <div className="space-y-2 rounded-lg border border-gray-200 p-3">
          {INPUT_DATA_OPTIONS.map((opt) => (
            <label key={opt.id} className="flex items-center gap-2 text-sm text-gray-700">
              <Checkbox
                checked={selectedInputs.includes(opt.id)}
                onCheckedChange={() => toggleInput(opt.id)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* Rules/Logic section (varies by type) */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Rules & Logic
        </h4>
        <div className="space-y-3 rounded-lg border border-gray-200 p-3">
          {type === 'classification' && (
            <>
              <p className="text-xs text-gray-500">Category classification with confidence threshold</p>
              <div>
                <Label className="text-xs text-gray-500">
                  Confidence Threshold: {confidenceThreshold}%
                </Label>
                <input
                  type="range"
                  min={50}
                  max={99}
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                  className="mt-1 w-full"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>50%</span>
                  <span>99%</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-600">Categories:</p>
                {['Goods', 'Services', 'Software', 'Consulting', 'Contingent Labour'].map((cat) => (
                  <div key={cat} className="flex items-center justify-between rounded bg-gray-50 px-2 py-1 text-xs text-gray-600">
                    <span>{cat}</span>
                    <span className="text-gray-400">Auto-assign</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {type === 'validation' && (
            <>
              <p className="text-xs text-gray-500">Validation rules with pass/fail actions</p>
              {[
                { rule: 'Required fields complete', pass: 'Continue', fail: 'Return to requestor' },
                { rule: 'Budget available', pass: 'Continue', fail: 'Flag for finance review' },
                { rule: 'Duplicate detection', pass: 'Continue', fail: 'Alert with match details' },
                { rule: 'Policy threshold check', pass: 'Continue', fail: 'Escalate to manager' },
              ].map((item) => (
                <div key={item.rule} className="rounded border border-gray-100 bg-gray-50 p-2">
                  <p className="text-xs font-medium text-gray-700">{item.rule}</p>
                  <div className="mt-1 flex gap-3 text-xs">
                    <span className="text-green-600">Pass: {item.pass}</span>
                    <span className="text-red-600">Fail: {item.fail}</span>
                  </div>
                </div>
              ))}
            </>
          )}

          {type === 'extraction' && (
            <>
              <p className="text-xs text-gray-500">Document extraction configuration</p>
              <div className="space-y-1">
                {['Supplier Name', 'Amount / Value', 'Dates', 'Line Items', 'Terms & Conditions'].map((field) => (
                  <div key={field} className="flex items-center justify-between rounded bg-gray-50 px-2 py-1 text-xs text-gray-600">
                    <span>{field}</span>
                    <span className="text-green-600">Enabled</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {type === 'recommendation' && (
            <>
              <p className="text-xs text-gray-500">Supplier recommendation scoring weights</p>
              {[
                { factor: 'Category Match', weight: 30 },
                { factor: 'Performance Score', weight: 25 },
                { factor: 'Risk Rating', weight: 20 },
                { factor: 'Price Competitiveness', weight: 15 },
                { factor: 'Capacity', weight: 10 },
              ].map((item) => (
                <div key={item.factor} className="flex items-center justify-between rounded bg-gray-50 px-2 py-1 text-xs text-gray-600">
                  <span>{item.factor}</span>
                  <span className="font-medium">{item.weight}%</span>
                </div>
              ))}
            </>
          )}

          {type === 'anomaly-detection' && (
            <>
              <p className="text-xs text-gray-500">Anomaly detection thresholds</p>
              {[
                { metric: 'Spend spike threshold', value: '2x std. deviation' },
                { metric: 'Off-contract alert', value: 'Any unmatched spend' },
                { metric: 'Invoice duplicate window', value: '90 days' },
                { metric: 'Price variance tolerance', value: '15%' },
              ].map((item) => (
                <div key={item.metric} className="flex items-center justify-between rounded bg-gray-50 px-2 py-1 text-xs text-gray-600">
                  <span>{item.metric}</span>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </>
          )}

          {type === 'knowledge-base' && (
            <>
              <p className="text-xs text-gray-500">Knowledge base retrieval configuration</p>
              <div className="space-y-1">
                {['Policy Documents', 'Procurement Guidelines', 'Category Playbooks', 'FAQ Database'].map((src) => (
                  <div key={src} className="flex items-center justify-between rounded bg-gray-50 px-2 py-1 text-xs text-gray-600">
                    <span>{src}</span>
                    <span className="text-green-600">Indexed</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Output Configuration */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Output Configuration
        </h4>
        <div className="space-y-1 rounded-lg border border-gray-200 p-3">
          {type === 'classification' && (
            <>
              <div className="flex items-center justify-between text-xs text-gray-600"><span>Category Label</span><span className="text-green-600">Enabled</span></div>
              <div className="flex items-center justify-between text-xs text-gray-600"><span>Commodity Code</span><span className="text-green-600">Enabled</span></div>
              <div className="flex items-center justify-between text-xs text-gray-600"><span>Confidence Score</span><span className="text-green-600">Enabled</span></div>
            </>
          )}
          {type === 'validation' && (
            <>
              <div className="flex items-center justify-between text-xs text-gray-600"><span>Pass/Fail Result</span><span className="text-green-600">Enabled</span></div>
              <div className="flex items-center justify-between text-xs text-gray-600"><span>Issue Details</span><span className="text-green-600">Enabled</span></div>
              <div className="flex items-center justify-between text-xs text-gray-600"><span>Suggested Fixes</span><span className="text-green-600">Enabled</span></div>
            </>
          )}
          {(type !== 'classification' && type !== 'validation') && (
            <>
              <div className="flex items-center justify-between text-xs text-gray-600"><span>Result Data</span><span className="text-green-600">Enabled</span></div>
              <div className="flex items-center justify-between text-xs text-gray-600"><span>Confidence Score</span><span className="text-green-600">Enabled</span></div>
              <div className="flex items-center justify-between text-xs text-gray-600"><span>Reasoning</span><span className="text-green-600">Enabled</span></div>
            </>
          )}
        </div>
      </div>

      {/* Human Override */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Human Override
        </h4>
        <div className="space-y-3 rounded-lg border border-gray-200 p-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-gray-600">Allow User Override</Label>
            <Switch checked={humanOverride} onCheckedChange={setHumanOverride} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-gray-600">Feedback Loop</Label>
            <Switch checked={feedbackLoop} onCheckedChange={setFeedbackLoop} />
          </div>
        </div>
      </div>

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
