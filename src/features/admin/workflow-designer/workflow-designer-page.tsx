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
  // Every palette type maps back to a template type the engine handles. It
  // mapped four of ten, so an Approval or Timer node dropped on the canvas
  // saved as a plain stage — the label survived and the node kind did not.
  // The palette is six now and this covers all of them.
  const reverseType: Record<string, string> = {
    start: 'start',
    end: 'end',
    userTask: 'stage',
    decision: 'decision',
    systemAction: 'integration',
    aiAgent: 'integration',
    notification: 'integration',
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
        // Which kind of integration node this is. Without it the three collapse
        // into one on reload and the canvas shows a System Action where the
        // author dropped an AI Agent.
        ...(templateType === 'integration' && data.integrationKind
          ? { integrationKind: data.integrationKind as string }
          : {}),
      };
    }),
    edges: edges.map((e) => ({
      source: e.source,
      target: e.target,
      label: typeof e.label === 'string' ? e.label : undefined,
      // The branch condition. Dropping it here is what left WF-002's decision
      // as a caption with nothing behind it.
      ...(e.data?.condition ? { condition: e.data.condition as EdgeCondition } : {}),
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
import { diagnoseTemplate, type EdgeCondition } from '@/lib/workflow/edge-conditions';
import { usePolicyConfig } from '@/lib/procurement/use-policy-config';

function mapTemplateToFlow(template: WorkflowTemplate): { nodes: Node[]; edges: Edge[] } {
  const typeMapping: Record<string, string> = {
    start: 'start',
    end: 'end',
    stage: 'userTask',
    decision: 'decision',
    parallel: 'decision',
    error: 'end',
    // The canvas has no integration node of its own; `integrationKind` on the
    // node data says which of the three it is, and reverseType maps all three
    // back to `integration`.
    integration: 'systemAction',
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
      ...(n.integrationKind ? { integrationKind: n.integrationKind } : {}),
    },
  }));

  const edges: Edge[] = template.edges.map((e, i) => ({
    id: `e-${e.source}-${e.target}-${i}`,
    source: e.source,
    target: e.target,
    label: e.label,
    ...(e.condition ? { data: { condition: e.condition } } : {}),
    animated: true,
    style: { stroke: '#94a3b8' },
  }));

  return { nodes, edges };
}

/**
 * The designer. Every template here defines the lifecycle of a buying channel.
 * Supplier onboarding and contract renewal had their own "side process"
 * templates and screen; nothing ever started one, and both were retired on
 * 2026-09-25 — onboarding is a stage inside a request, and a renewal comes in
 * through Door 1.
 */
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

  // The config panel renders a decision's outgoing branches, so the edges have
  // to be state: a ref read during render is stale the moment a condition is
  // edited, and the panel would show the previous value.
  // Both mirrored into state: the diagnostics banner and the branch editor
  // render from them, and a ref read during render is stale the moment
  // anything is edited.
  const [editedNodes, setCanvasNodes] = useState<Node[]>([]);
  const [editedEdges, setCanvasEdges] = useState<Edge[]>([]);
  // `useState(initialNodes)` captured the FIRST render — before the templates
  // query resolved — and never caught up, so the diagnostics had an empty graph
  // to read and reported nothing. Falling back to the mapped template keeps the
  // edited state authoritative once there is any, without an effect that sets
  // state during render.
  // Channel claims and the requester's wording, held locally and merged on
  // save like the graph. Declared here because a template switch resets them.
  const [editedChannels, setEditedChannels] = useState<string[] | null>(null);
  const [editedWording, setEditedWording] = useState<{ headline: string; description: string } | null>(null);
  const canvasNodes = editedNodes.length > 0 ? editedNodes : initialNodes;
  const canvasEdges = editedEdges.length > 0 ? editedEdges : initialEdges;

  // Branches that cannot do what their caption says — a condition on a field
  // nothing supplies, a label that reads like a rule and is not one, a decision
  // with no default. WF-002's `> €5K` was all three at once and nothing
  // anywhere reported it.
  const policyConfig = usePolicyConfig();
  const templateProblems = useMemo(() => {
    if (!template) return [];
    const graph = mapFlowToTemplateGraph(canvasNodes, canvasEdges);
    return diagnoseTemplate(graph, policyConfig);
  }, [template, canvasNodes, canvasEdges, policyConfig]);

  // Initialize refs on template change
  useEffect(() => {
    if (!template) return;
    const flow = mapTemplateToFlow(template);
    nodesRef.current = flow.nodes;
    edgesRef.current = flow.edges;
  }, [template]);

  const handleTemplateChange = useCallback((templateId: string) => {
    // Reset the panel's view of the branches here rather than in an effect:
    // the template is changing because someone chose one, which is exactly
    // where the new edges are known.
    const next = workflowTemplates.find((t) => t.id === templateId);
    const flow = next ? mapTemplateToFlow(next) : { nodes: [] as Node[], edges: [] as Edge[] };
    setCanvasNodes(flow.nodes);
    setCanvasEdges(flow.edges);
    setSelectedTemplateId(templateId);
    // Unsaved channel and wording edits belong to the template they were made
    // on. They were kept across a switch, so saving the next template wrote
    // the previous one's channels onto it.
    setEditedChannels(null);
    setEditedWording(null);
    setSelectedNode(null);
    setShowSimulation(false);
    setHighlightedNodeId(null);
    setCanvasKey((k) => k + 1);
  }, [workflowTemplates]);

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

  // A decision's branches are edges, so the panel edits those too. The panel
  // stays open: configuring several branches is one task.
  const handleEdgeUpdate = useCallback((edgeId: string, data: Record<string, unknown>) => {
    const wrapper = canvasWrapperRef.current?.querySelector('[class*="flex-1"]') as HTMLDivElement & {
      __canvasApi?: { updateEdgeData: (id: string, data: Record<string, unknown>) => void };
    };
    wrapper?.__canvasApi?.updateEdgeData(edgeId, data);
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

  // The requester's wording for the channel(s) this template claims.
  const wording = editedWording ?? {
    headline: template?.requesterHeadline ?? '',
    description: template?.requesterDescription ?? '',
  };

  const handleSave = useCallback(async () => {
    if (!template) {
      toast.error('No template selected.');
      return;
    }
    const graph = mapFlowToTemplateGraph(nodesRef.current, edgesRef.current);
    try {
      await saveTemplate.mutateAsync({
        ...template, ...graph, channels,
        ...(editedWording ? {
          requesterHeadline: editedWording.headline.trim(),
          requesterDescription: editedWording.description.trim(),
        } : {}),
      });
      setEditedChannels(null);
      setEditedWording(null);
      toast.success(`Workflow "${template.name}" saved.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      toast.error(`Save failed: ${msg}`);
    }
  }, [template, saveTemplate, channels, editedWording]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const containerClass = isFullscreen
    ? 'fixed inset-0 z-50 bg-card flex flex-col'
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
        <div className="border-b border-accent-line bg-accent-soft px-4 py-2">
          <p className="text-xs text-accent-solid">
            <strong>This graph is the lifecycle.</strong> The stages a request visits, their
            owner roles and their SLAs are read from the template that claims its buying
            channel — the stepper, the stage gates and the intake writer all derive from
            here. Saves persist to <code>workflow_templates</code>.
          </p>
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-line bg-card px-4 py-2.5">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-ink">
            Workflow Designer
          </h1>
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
          <div className="flex flex-wrap items-center gap-1.5 border-l border-line pl-3">
            <span className="text-xs text-ink-3">Lifecycle for</span>
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
                      ? 'border-accent-line bg-accent-soft text-accent-solid'
                      : 'border-line bg-card-2 text-ink-3 hover:bg-idle-soft',
                  )}
                >
                  {channel}
                </button>
              );
            })}
            {channels.length === 0 && (
              <span className="text-xs text-ink-3">none — no request will run on this template</span>
            )}
            {/* What a requester is told about this channel, on the intake's
                How you'll buy step and the buying-channel review. It was a
                hard-coded map in code, so reshaping a template here left the
                wording describing the old one. */}
            {channels.length > 0 && (
              <div className="flex w-full flex-wrap items-center gap-2 pt-1.5">
                <span className="text-xs text-ink-3">Requester wording</span>
                <input
                  aria-label="Requester headline"
                  value={wording.headline}
                  onChange={(e) => setEditedWording({ ...wording, headline: e.target.value })}
                  placeholder="e.g. Procurement runs a sourcing exercise"
                  className="h-7 min-w-56 flex-1 rounded-md border border-line bg-card px-2 text-xs"
                />
                <input
                  aria-label="Requester description"
                  value={wording.description}
                  onChange={(e) => setEditedWording({ ...wording, description: e.target.value })}
                  placeholder="One sentence: what happens, in the requester's words"
                  className="h-7 min-w-72 flex-[2] rounded-md border border-line bg-card px-2 text-xs"
                />
              </div>
            )}
            {templateProblems.length > 0 && !isFullscreen && (
        <div className="border-b border-warn-line bg-warn-soft px-4 py-2">
          <p className="flex items-center gap-2 text-xs font-medium text-warn">
            <AlertTriangle className="size-3.5 shrink-0" />
            Some branches will not do what their label says
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-9 text-xs text-warn">
            {templateProblems.flatMap((d) => d.problems.map((problem) => (
              <li key={`${d.nodeId}-${problem}`}>
                <button
                  type="button"
                  className="font-medium underline underline-offset-2"
                  onClick={() => {
                    const node = canvasNodes.find((n) => n.id === d.nodeId);
                    if (node) setSelectedNode(node);
                  }}
                >
                  {canvasNodes.find((n) => n.id === d.nodeId)?.data?.label as string ?? d.nodeId}
                </button>
                {' — '}{problem}
              </li>
            )))}
          </ul>
        </div>
      )}
      {channelIssues.length > 0 && (
              <span
                className="flex items-center gap-1 text-xs text-warn"
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
            onNodesChange={(n) => { nodesRef.current = n; setCanvasNodes(n); }}
            onEdgesChange={(e) => { edgesRef.current = e; setCanvasEdges(e); }}
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
            edges={canvasEdges}
            onUpdate={handleNodeUpdate}
            onUpdateEdge={handleEdgeUpdate}
            onDelete={handleNodeDelete}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  );
}
