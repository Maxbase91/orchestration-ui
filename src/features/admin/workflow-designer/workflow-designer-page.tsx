import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Save, Play, Maximize2, Minimize2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWorkflowTemplates, useSaveWorkflowTemplate } from '@/lib/db/hooks/use-workflow-templates';
import type { WorkflowTemplate } from '@/data/types';
import type { Node, Edge } from '@xyflow/react';

// Invert mapTemplateToFlow: take the current canvas Nodes/Edges back
// into the WorkflowTemplate.nodes/edges shape that the DB stores.
//
// This used to persist only id/type/label/x/y, so every field the config panel
// collected — the owner role, the SLA, the instructions — was written to local
// state and thrown away on save. An admin could set a stage owner and nothing
// anywhere would read it. The engine now reads role, slaDays, purpose and gate,
// so they have to survive the round trip.
function mapFlowToTemplateGraph(
  nodes: Node[],
  edges: Edge[],
): { nodes: WorkflowTemplate['nodes']; edges: WorkflowTemplate['edges'] } {
  // Reverse the typeMapping. 'userTask' flattens back to 'stage'
  // since that's the most common node kind in the template schema.
  const reverseType: Record<string, string> = {
    start: 'start',
    end: 'end',
    userTask: 'stage',
    decision: 'decision',
  };
  return {
    nodes: nodes.map((n) => {
      const data = (n.data ?? {}) as Record<string, unknown>;
      // The canvas has fewer node types than the template schema: `parallel`
      // renders as `decision` and `error` as `end`. Without carrying the
      // original type through, opening and saving a template silently
      // destroyed WF-001's "Referred Back" error node.
      const templateType =
        (data.templateType as string | undefined) ?? reverseType[n.type ?? 'userTask'] ?? 'stage';
      const slaDays = Number(data.slaDays);
      return {
        id: n.id,
        type: templateType,
        label: (data.label as string | undefined) ?? n.id,
        x: n.position.x,
        y: n.position.y,
        ...(data.role ? { role: data.role as string } : {}),
        ...(Number.isFinite(slaDays) && slaDays > 0 ? { slaDays } : {}),
        ...(data.purpose ? { purpose: data.purpose as string } : {}),
        ...(data.gate === 'auto' || data.gate === 'manual'
          ? { gate: data.gate as 'auto' | 'manual' }
          : {}),
      };
    }),
    edges: edges.map((e) => ({
      source: e.source,
      target: e.target,
      label: typeof e.label === 'string' ? e.label : undefined,
    })),
  };
}

import { NodePalette } from './components/node-palette';
import { DesignerCanvas } from './components/designer-canvas';
import { NodeConfigPanel } from './components/node-config-panel';
import { TemplateLibrary } from './components/template-library';
import { SimulationRunner } from './components/simulation-runner';
import { cn } from '@/lib/utils';
import {
  BUYING_CHANNELS, channelStageMapFromTemplates, unclaimedChannels,
} from '@/lib/workflow/channel-stages';

function mapTemplateToFlow(template: WorkflowTemplate): { nodes: Node[]; edges: Edge[] } {
  const typeMapping: Record<string, string> = {
    start: 'start',
    end: 'end',
    stage: 'userTask',
    decision: 'decision',
    parallel: 'decision',
    error: 'end',
  };

  const nodes: Node[] = template.nodes.map((n) => ({
    id: n.id,
    type: typeMapping[n.type] ?? 'userTask',
    position: { x: n.x ?? 0, y: n.y ?? 0 },
    // templateType preserves the schema type the canvas cannot represent, so a
    // round trip through the designer does not collapse parallel/error nodes.
    data: {
      label: n.label,
      templateType: n.type,
      ...(n.role ? { role: n.role } : {}),
      ...(n.slaDays != null ? { slaDays: n.slaDays } : {}),
      ...(n.purpose ? { purpose: n.purpose } : {}),
      ...(n.gate ? { gate: n.gate } : {}),
    },
  }));

  const edges: Edge[] = template.edges.map((e, i) => ({
    id: `e-${e.source}-${e.target}-${i}`,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: true,
    style: { stroke: '#94a3b8' },
  }));

  return { nodes, edges };
}

export function WorkflowDesignerPage() {
  const { data: workflowTemplates = [] } = useWorkflowTemplates();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSimulation, setShowSimulation] = useState(false);
  /**
   * The graph the simulation runs against, snapshotted when it is opened.
   *
   * The refs below track the live canvas without re-rendering this page on
   * every drag — that is worth keeping. But reading `nodesRef.current` during
   * render to pass as props meant the simulation's input was untracked: it
   * happened to be correct only because opening the panel also set state, and
   * nothing would have re-rendered it if the canvas changed underneath.
   * Snapshotting on open says what is actually meant — simulate the canvas as
   * it stands now — and keeps render pure.
   */
  const [simulationGraph, setSimulationGraph] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [canvasKey, setCanvasKey] = useState(0);

  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);

  // The effective selection, derived rather than mirrored into state by an
  // effect: an explicit choice wins, otherwise the first template. The effect
  // that used to copy the default into state existed only so the Select had a
  // value to show — line below already fell back the same way — and it cost a
  // second render every time the templates loaded.
  const effectiveTemplateId = selectedTemplateId || workflowTemplates[0]?.id || '';

  const template = workflowTemplates.find((t) => t.id === effectiveTemplateId) ?? workflowTemplates[0];
  const { nodes: initialNodes, edges: initialEdges } = template
    ? mapTemplateToFlow(template)
    : { nodes: [] as Node[], edges: [] as Edge[] };

  // Initialize refs on template change
  useEffect(() => {
    if (!template) return;
    const flow = mapTemplateToFlow(template);
    nodesRef.current = flow.nodes;
    edgesRef.current = flow.edges;
  }, [template]);

  const handleTemplateChange = useCallback((templateId: string) => {
    setSelectedTemplateId(templateId);
    setSelectedNode(null);
    setShowSimulation(false);
    setHighlightedNodeId(null);
    setCanvasKey((k) => k + 1);
  }, []);

  const handleNodeClick = useCallback((node: Node) => {
    setSelectedNode(node);
  }, []);

  const handleNodeUpdate = useCallback((nodeId: string, data: Record<string, unknown>) => {
    // Access the canvas API through the DOM ref
    const wrapper = canvasWrapperRef.current?.querySelector('[class*="flex-1"]') as HTMLDivElement & {
      __canvasApi?: { updateNodeData: (id: string, data: Record<string, unknown>) => void };
    };
    wrapper?.__canvasApi?.updateNodeData(nodeId, data);
    setSelectedNode(null);
  }, []);

  const handleNodeDelete = useCallback((nodeId: string) => {
    const wrapper = canvasWrapperRef.current?.querySelector('[class*="flex-1"]') as HTMLDivElement & {
      __canvasApi?: { deleteNode: (id: string) => void };
    };
    wrapper?.__canvasApi?.deleteNode(nodeId);
    setSelectedNode(null);
  }, []);

  const saveTemplate = useSaveWorkflowTemplate();

  // Which channels this template defines the lifecycle for. Until now the
  // lifecycle lived twice — in `buying-channel-stages.ts` and in the graph
  // below — with no key to join them on, so renaming a stage here changed the
  // graph the engine walks and not the map the stepper draws.
  //
  // Held locally and merged on save, the same shape as the graph itself.
  const [editedChannels, setEditedChannels] = useState<string[] | null>(null);
  // Memoised because it feeds a useMemo and a useCallback below: a fresh
  // array every render would invalidate both on every render.
  const channels = useMemo(
    () => editedChannels ?? template?.channels ?? [],
    [editedChannels, template?.channels],
  );

  // A channel two templates claim, and a channel none claims, are both silent
  // failures: the first claim wins, and an unclaimed channel has no lifecycle
  // at all. Reported here, where they are made.
  const channelIssues = useMemo(() => {
    const claimedHere = new Set(channels);
    const takenElsewhere = workflowTemplates
      .filter((t) => t.id !== template?.id)
      .flatMap((t) => (t.channels ?? []).filter((c) => claimedHere.has(c))
        .map((c) => `${c} is also claimed by ${t.id}`));
    const asClaimedNow = workflowTemplates.map((t) => (
      t.id === template?.id ? { ...t, channels } : t
    ));
    const orphans = unclaimedChannels(
      channelStageMapFromTemplates(asClaimedNow), BUYING_CHANNELS,
    ).map((c) => `${c} has no template`);
    return [...takenElsewhere, ...orphans];
  }, [channels, workflowTemplates, template?.id]);

  const handleSave = useCallback(async () => {
    if (!template) {
      toast.error('No template selected.');
      return;
    }
    const graph = mapFlowToTemplateGraph(nodesRef.current, edgesRef.current);
    try {
      await saveTemplate.mutateAsync({ ...template, ...graph, channels });
      setEditedChannels(null);
      toast.success(`Workflow "${template.name}" saved.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      toast.error(`Save failed: ${msg}`);
    }
  }, [template, saveTemplate, channels]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const containerClass = isFullscreen
    ? 'fixed inset-0 z-50 bg-white flex flex-col'
    : 'flex h-full flex-col';

  return (
    <div className={containerClass}>
      {/* This banner said the runtime "still follows the 9-stage enum" and that
          a template-derived lifecycle was a future phase. That stopped being
          true when buying-channel-stages.ts was deleted and every consumer
          started deriving the path from the graph below — a banner describing
          behaviour the platform no longer has is the same defect class as a
          control that configures nothing. */}
      {!isFullscreen && (
        <div className="border-b border-blue-200 bg-blue-50 px-4 py-2">
          <p className="text-xs text-blue-800">
            <strong>This graph is the lifecycle.</strong> The stages a request visits, their
            owner roles and their SLAs are read from the template that claims its buying
            channel — the stepper, the stage gates and the intake writer all derive from
            here. Saves persist to <code>workflow_templates</code>.
          </p>
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-gray-900">Workflow Designer</h1>
          <Select value={effectiveTemplateId} onValueChange={handleTemplateChange}>
            <SelectTrigger className="w-52 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {workflowTemplates.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <TemplateLibrary onSelect={handleTemplateChange} />
          {/* Empty is legitimate: WF-003 and WF-004 are workflows for other
              objects (supplier onboarding, contract renewal), selected by
              category rather than by channel. */}
          <div className="flex flex-wrap items-center gap-1.5 border-l border-gray-200 pl-3">
            <span className="text-xs text-gray-500">Lifecycle for</span>
            {BUYING_CHANNELS.map((channel) => {
              const active = channels.includes(channel);
              return (
                <button
                  key={channel}
                  type="button"
                  onClick={() => setEditedChannels(
                    active ? channels.filter((c) => c !== channel) : [...channels, channel],
                  )}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    active
                      ? 'border-blue-300 bg-blue-100 text-blue-700'
                      : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100',
                  )}
                >
                  {channel}
                </button>
              );
            })}
            {channels.length === 0 && (
              <span className="text-xs text-gray-400">none — a side process</span>
            )}
            {channelIssues.length > 0 && (
              <span
                className="flex items-center gap-1 text-xs text-amber-700"
                title={channelIssues.join('\n')}
              >
                <AlertTriangle className="size-3.5 shrink-0" />
                {channelIssues[0]}
                {channelIssues.length > 1 ? ` (+${channelIssues.length - 1} more)` : ''}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setShowSimulation((v) => {
                const next = !v;
                setSimulationGraph(next
                  ? {
                      nodes: nodesRef.current.length > 0 ? nodesRef.current : initialNodes,
                      edges: edgesRef.current.length > 0 ? edgesRef.current : initialEdges,
                    }
                  : null);
                return next;
              });
            }}
          >
            <Play className="h-3.5 w-3.5 mr-1.5" />
            {showSimulation ? 'Hide Simulation' : 'Simulate'}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saveTemplate.isPending}>
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {saveTemplate.isPending ? 'Saving…' : 'Save'}
          </Button>
          <Button size="sm" variant="ghost" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Main area */}
      <div ref={canvasWrapperRef} className="flex flex-1 overflow-hidden relative">
        <NodePalette />

        <div className="relative flex-1">
          {/* Key on the resolved template id (not just canvasKey): the templates
              query resolves AFTER first mount, so without this the canvas stays
              initialised with the empty node set until a manual template switch.
              Remounting when the template first becomes available picks up its
              nodes on initial load. */}
          <DesignerCanvas
            key={`${template?.id ?? 'empty'}-${canvasKey}`}
            initialNodes={initialNodes}
            initialEdges={initialEdges}
            onNodeClick={handleNodeClick}
            highlightedNodeId={highlightedNodeId}
            onNodesChange={(n) => { nodesRef.current = n; }}
            onEdgesChange={(e) => { edgesRef.current = e; }}
          />

          {showSimulation && simulationGraph && (
            <SimulationRunner
              nodes={simulationGraph.nodes}
              edges={simulationGraph.edges}
              onHighlightNode={setHighlightedNodeId}
              onClose={() => {
                setShowSimulation(false);
                setSimulationGraph(null);
                setHighlightedNodeId(null);
              }}
            />
          )}
        </div>

        {selectedNode && (
          <NodeConfigPanel
            key={selectedNode.id}
            node={selectedNode}
            onUpdate={handleNodeUpdate}
            onDelete={handleNodeDelete}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  );
}
