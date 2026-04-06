import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, RotateCcw, ChevronRight, AlertTriangle, X } from 'lucide-react';
import type { Node, Edge } from '@xyflow/react';

interface SimulationRunnerProps {
  nodes: Node[];
  edges: Edge[];
  onHighlightNode: (nodeId: string | null) => void;
  onClose: () => void;
}

interface SimulationStep {
  nodeId: string;
  label: string;
  type: string;
  data: string;
}

function buildSimulationPath(nodes: Node[], edges: Edge[]): SimulationStep[] {
  const steps: SimulationStep[] = [];
  const visited = new Set<string>();

  const startNode = nodes.find((n) => n.type === 'start');
  if (!startNode) return steps;

  let current: Node | undefined = startNode;

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    steps.push({
      nodeId: current.id,
      label: (current.data as Record<string, string>).label ?? current.id,
      type: current.type ?? 'unknown',
      data: getSimulatedData(current.type ?? 'unknown'),
    });

    const outgoing = edges.filter((e) => e.source === current!.id);
    if (outgoing.length === 0) break;

    // For decisions/approvals, take the first path
    const nextEdge = outgoing[0];
    current = nodes.find((n) => n.id === nextEdge.target);
  }

  return steps;
}

function getSimulatedData(type: string): string {
  const dataMap: Record<string, string> = {
    start: 'Trigger received. Request PRQ-2025-0042 submitted.',
    userTask: 'Assigned to GP Analyst. SLA: 2 business days.',
    approval: 'Routed to Budget Owner for approval. Threshold: EUR 25,000.',
    systemAction: 'Automated PO creation triggered. PO-2025-0187 generated.',
    aiAgent: 'AI classification: Services > IT Consulting. Confidence: 94%.',
    decision: 'Evaluating routing rules. Value > EUR 5,000 = true.',
    notification: 'Email notification sent to requestor.',
    timer: 'Waiting 48 hours for response.',
    subWorkflow: 'Invoking supplier onboarding sub-workflow.',
    end: 'Workflow completed. Total duration: 4.2 days.',
  };
  return dataMap[type] ?? 'Processing...';
}

function detectIssues(nodes: Node[], edges: Edge[]): string[] {
  const warnings: string[] = [];

  // Dead paths: nodes with no incoming edges (except start)
  const targetIds = new Set(edges.map((e) => e.target));
  const deadNodes = nodes.filter((n) => n.type !== 'start' && !targetIds.has(n.id));
  if (deadNodes.length > 0) {
    warnings.push(`Dead path: ${deadNodes.map((n) => (n.data as Record<string, string>).label ?? n.id).join(', ')} unreachable`);
  }

  // Nodes with no outgoing edges (except end)
  const sourceIds = new Set(edges.map((e) => e.source));
  const terminalNodes = nodes.filter((n) => n.type !== 'end' && !sourceIds.has(n.id));
  if (terminalNodes.length > 0) {
    warnings.push(`Dead end: ${terminalNodes.map((n) => (n.data as Record<string, string>).label ?? n.id).join(', ')} has no outgoing connections`);
  }

  // Simple loop detection
  const visited = new Set<string>();
  function dfs(nodeId: string, path: Set<string>): boolean {
    if (path.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visited.add(nodeId);
    path.add(nodeId);
    const outgoing = edges.filter((e) => e.source === nodeId);
    for (const edge of outgoing) {
      if (dfs(edge.target, new Set(path))) return true;
    }
    return false;
  }
  const startNode = nodes.find((n) => n.type === 'start');
  if (startNode && dfs(startNode.id, new Set())) {
    warnings.push('Potential loop detected in workflow path');
  }

  return warnings;
}

export function SimulationRunner({ nodes, edges, onHighlightNode, onClose }: SimulationRunnerProps) {
  const [steps] = useState<SimulationStep[]>(() => buildSimulationPath(nodes, edges));
  const [currentStep, setCurrentStep] = useState(-1);
  const [warnings] = useState<string[]>(() => detectIssues(nodes, edges));

  const handleNext = useCallback(() => {
    setCurrentStep((prev) => {
      const next = Math.min(prev + 1, steps.length - 1);
      onHighlightNode(steps[next]?.nodeId ?? null);
      return next;
    });
  }, [steps, onHighlightNode]);

  const handleReset = useCallback(() => {
    setCurrentStep(-1);
    onHighlightNode(null);
  }, [onHighlightNode]);

  const handleStart = useCallback(() => {
    setCurrentStep(0);
    if (steps.length > 0) onHighlightNode(steps[0].nodeId);
  }, [steps, onHighlightNode]);

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-[560px] rounded-xl border border-gray-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
        <h4 className="text-sm font-semibold text-gray-900">Simulation</h4>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {currentStep >= 0 ? `Step ${currentStep + 1} of ${steps.length}` : 'Ready'}
          </span>
          <button onClick={() => { onHighlightNode(null); onClose(); }} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {currentStep >= 0 && steps[currentStep] && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <div className="flex items-center gap-2">
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 capitalize">
                {steps[currentStep].type.replace(/([A-Z])/g, ' $1').trim()}
              </span>
              <span className="text-sm font-semibold text-green-900">{steps[currentStep].label}</span>
            </div>
            <p className="text-xs text-green-700 mt-1.5">{steps[currentStep].data}</p>
          </div>
        )}

        {currentStep < 0 && (
          <p className="text-sm text-gray-500 text-center py-2">Click "Start" to begin step-by-step simulation.</p>
        )}

        <div className="flex items-center gap-2">
          {currentStep < 0 ? (
            <Button size="sm" onClick={handleStart} disabled={steps.length === 0}>
              <Play className="h-3.5 w-3.5 mr-1" />
              Start
            </Button>
          ) : (
            <>
              <Button size="sm" onClick={handleNext} disabled={currentStep >= steps.length - 1}>
                <ChevronRight className="h-3.5 w-3.5 mr-1" />
                Next Step
              </Button>
              <Button size="sm" variant="outline" onClick={handleReset}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Reset
              </Button>
            </>
          )}
        </div>

        {warnings.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">Warnings</span>
            </div>
            {warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-700">{w}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
