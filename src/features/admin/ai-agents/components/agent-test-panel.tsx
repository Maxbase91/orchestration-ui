import { useState } from 'react';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { AIAgent } from '@/data/types';

const MOCK_RESULTS: Record<string, { label: string; confidence: number; reasoning: string }> = {
  classification: {
    label: 'Software',
    confidence: 92.4,
    reasoning: 'Request mentions "SaaS platform", "annual licence", and "cloud deployment". Historical pattern matches software category with high confidence. Suggested commodity code: 432-100.',
  },
  validation: {
    label: 'PASS',
    confidence: 88.1,
    reasoning: 'All required fields present. Budget check: sufficient funds in cost centre CC-4500. No duplicate requests found within 90-day window. Value within policy threshold for business-led procurement.',
  },
  extraction: {
    label: 'Extraction Complete',
    confidence: 91.3,
    reasoning: 'Extracted: Supplier = "TechCorp Solutions Ltd", Amount = EUR 45,000, Start Date = 01/03/2025, End Date = 28/02/2026, Payment Terms = Net 30. 4 line items identified.',
  },
  recommendation: {
    label: 'Top Match: Accenture (Score: 87)',
    confidence: 78.6,
    reasoning: 'Based on category match (consulting), performance score (4.2/5), risk rating (low), and pricing history. Alternative: Deloitte (Score: 82), McKinsey (Score: 79).',
  },
  'anomaly-detection': {
    label: 'Anomaly Detected',
    confidence: 94.7,
    reasoning: 'Spend spike: This request is 3.2x the average for this category/cost centre combination over the past 12 months. Previous average: EUR 15,200. This request: EUR 48,500. Flagged for review.',
  },
  'knowledge-base': {
    label: 'Policy Match Found',
    confidence: 86.0,
    reasoning: 'Relevant policy: GP-POL-2024-017 "Software Procurement Policy". Key requirements: Security assessment required for all SaaS, DPA must be in place, minimum 3 vendor evaluation for >EUR 50K.',
  },
};

interface AgentTestPanelProps {
  agent: AIAgent;
}

export function AgentTestPanel({ agent }: AgentTestPanelProps) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<{ label: string; confidence: number; reasoning: string } | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  function handleRun() {
    setIsRunning(true);
    // Simulate processing delay
    setTimeout(() => {
      setResult(MOCK_RESULTS[agent.type] ?? MOCK_RESULTS.classification);
      setIsRunning(false);
    }, 800);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h4 className="text-sm font-semibold text-gray-900">Test Agent</h4>
      <p className="mt-0.5 text-xs text-gray-500">
        Provide sample input to test {agent.name}
      </p>

      <div className="mt-4">
        <Label className="text-xs text-gray-500">Sample Input</Label>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={4}
          className="mt-1"
          placeholder={
            agent.type === 'extraction'
              ? 'Paste document text or describe a document...'
              : 'Describe a procurement request to test...'
          }
        />
      </div>

      <div className="mt-3 flex gap-2">
        <Button onClick={handleRun} disabled={isRunning} className="flex-1">
          <Play className="size-3.5" />
          {isRunning ? 'Running...' : 'Run Test'}
        </Button>
      </div>

      {result && (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-green-700">Result</p>
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                {result.confidence}% confidence
              </span>
            </div>
            <p className="mt-1 text-sm font-semibold text-gray-900">{result.label}</p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-medium text-gray-500">Reasoning</p>
            <p className="mt-1 text-xs text-gray-600 leading-relaxed">{result.reasoning}</p>
          </div>
        </div>
      )}
    </div>
  );
}
