import { useState, useCallback, useRef, useEffect } from 'react';
import { Save, Play, Maximize2, Minimize2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { workflowTemplates } from '@/data/workflows';
import type { WorkflowTemplate } from '@/data/types';
import type { Node, Edge } from '@xyflow/react';

import { NodePalette } from './components/node-palette';
import { DesignerCanvas } from './components/designer-canvas';
import { NodeConfigPanel } from './components/node-config-panel';
import { TemplateLibrary } from './components/template-library';
import { SimulationRunner } from './components/simulation-runner';

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
    position: { x: n.x, y: n.y },
    data: { label: n.label },
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
  const [selectedTemplateId, setSelectedTemplateId] = useState(workflowTemplates[0].id);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSimulation, setShowSimulation] = useState(false);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [canvasKey, setCanvasKey] = useState(0);

  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);

  const template = workflowTemplates.find((t) => t.id === selectedTemplateId) ?? workflowTemplates[0];
  const { nodes: initialNodes, edges: initialEdges } = mapTemplateToFlow(template);

  // Initialize refs on template change
  useEffect(() => {
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

  const handleSave = useCallback(() => {
    toast.success('Workflow saved successfully');
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const containerClass = isFullscreen
    ? 'fixed inset-0 z-50 bg-white flex flex-col'
    : 'flex h-full flex-col';

  return (
    <div className={containerClass}>
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-gray-900">Workflow Designer</h1>
          <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
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
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowSimulation((v) => !v)}>
            <Play className="h-3.5 w-3.5 mr-1.5" />
            {showSimulation ? 'Hide Simulation' : 'Simulate'}
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Save className="h-3.5 w-3.5 mr-1.5" />
            Save
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
          <DesignerCanvas
            key={canvasKey}
            initialNodes={initialNodes}
            initialEdges={initialEdges}
            onNodeClick={handleNodeClick}
            highlightedNodeId={highlightedNodeId}
            onNodesChange={(n) => { nodesRef.current = n; }}
            onEdgesChange={(e) => { edgesRef.current = e; }}
          />

          {showSimulation && (
            <SimulationRunner
              nodes={nodesRef.current.length > 0 ? nodesRef.current : initialNodes}
              edges={edgesRef.current.length > 0 ? edgesRef.current : initialEdges}
              onHighlightNode={setHighlightedNodeId}
              onClose={() => {
                setShowSimulation(false);
                setHighlightedNodeId(null);
              }}
            />
          )}
        </div>

        {selectedNode && (
          <NodeConfigPanel
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
