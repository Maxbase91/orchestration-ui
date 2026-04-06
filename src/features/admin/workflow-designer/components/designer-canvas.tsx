import { useCallback, useRef, type DragEvent } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  StartNode,
  EndNode,
  UserTaskNode,
  ApprovalNode,
  SystemActionNode,
  AIAgentNode,
  DecisionNode,
  NotificationNode,
  TimerNode,
  SubWorkflowNode,
} from './custom-nodes';

const nodeTypes: NodeTypes = {
  start: StartNode,
  end: EndNode,
  userTask: UserTaskNode,
  approval: ApprovalNode,
  systemAction: SystemActionNode,
  aiAgent: AIAgentNode,
  decision: DecisionNode,
  notification: NotificationNode,
  timer: TimerNode,
  subWorkflow: SubWorkflowNode,
};

const DEFAULT_LABELS: Record<string, string> = {
  start: 'Start',
  end: 'End',
  userTask: 'User Task',
  approval: 'Approval',
  systemAction: 'System Action',
  aiAgent: 'AI Agent',
  decision: 'Decision',
  notification: 'Notification',
  timer: 'Timer',
  subWorkflow: 'Sub-workflow',
};

interface DesignerCanvasProps {
  initialNodes: Node[];
  initialEdges: Edge[];
  onNodeClick: (node: Node) => void;
  highlightedNodeId: string | null;
  onNodesChange: (nodes: Node[]) => void;
  onEdgesChange: (edges: Edge[]) => void;
}

let nodeIdCounter = 100;

export function DesignerCanvas({
  initialNodes,
  initialEdges,
  onNodeClick,
  highlightedNodeId,
  onNodesChange,
  onEdgesChange,
}: DesignerCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reactFlowInstance = useRef<any>(null);
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(initialEdges);

  // Sync nodes/edges up to parent
  const handleNodesChangeWrapped = useCallback(
    (changes: Parameters<typeof onNodesChangeInternal>[0]) => {
      onNodesChangeInternal(changes);
    },
    [onNodesChangeInternal],
  );

  const handleEdgesChangeWrapped = useCallback(
    (changes: Parameters<typeof onEdgesChangeInternal>[0]) => {
      onEdgesChangeInternal(changes);
    },
    [onEdgesChangeInternal],
  );

  // Keep parent in sync when nodes/edges actually change
  // We use onNodesChange/onEdgesChange through callbacks after state settles
  const syncToParent = useCallback(() => {
    onNodesChange(nodes);
    onEdgesChange(edges);
  }, [nodes, edges, onNodesChange, onEdgesChange]);

  // Sync after each render cycle
  // Using a simpler approach: pass current state up on meaningful interactions
  const handleConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => {
        const updated = addEdge({ ...params, animated: true, style: { stroke: '#94a3b8' } }, eds);
        setTimeout(() => onEdgesChange(updated), 0);
        return updated;
      });
    },
    [setEdges, onEdgesChange],
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !reactFlowInstance.current || !reactFlowWrapper.current) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.current.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      const newNode: Node = {
        id: `node-${++nodeIdCounter}`,
        type,
        position,
        data: { label: DEFAULT_LABELS[type] ?? type },
      };

      setNodes((nds) => {
        const updated = [...nds, newNode];
        setTimeout(() => onNodesChange(updated), 0);
        return updated;
      });
    },
    [setNodes, onNodesChange],
  );

  const handleNodeClickInternal = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeClick(node);
    },
    [onNodeClick],
  );

  // Apply highlight class
  const styledNodes = nodes.map((n) => ({
    ...n,
    style: {
      ...n.style,
      ...(highlightedNodeId === n.id
        ? { filter: 'drop-shadow(0 0 8px rgba(34,197,94,0.6))' }
        : {}),
    },
  }));

  // Update nodes externally (e.g. from config panel)
  const updateNodeData = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      setNodes((nds) => {
        const updated = nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n));
        setTimeout(() => onNodesChange(updated), 0);
        return updated;
      });
    },
    [setNodes, onNodesChange],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => {
        const updated = nds.filter((n) => n.id !== nodeId);
        setTimeout(() => onNodesChange(updated), 0);
        return updated;
      });
      setEdges((eds) => {
        const updated = eds.filter((e) => e.source !== nodeId && e.target !== nodeId);
        setTimeout(() => onEdgesChange(updated), 0);
        return updated;
      });
    },
    [setNodes, setNodes, onNodesChange, setEdges, onEdgesChange],
  );

  // Expose update/delete via ref-like pattern through parent
  // Store on the wrapper element for parent access
  if (reactFlowWrapper.current) {
    (reactFlowWrapper.current as HTMLDivElement & { __canvasApi?: { updateNodeData: typeof updateNodeData; deleteNode: typeof deleteNode; syncToParent: typeof syncToParent } }).__canvasApi = {
      updateNodeData,
      deleteNode,
      syncToParent,
    };
  }

  return (
    <div ref={reactFlowWrapper} className="flex-1 h-full">
      <ReactFlow
        nodes={styledNodes}
        edges={edges}
        onNodesChange={handleNodesChangeWrapped}
        onEdgesChange={handleEdgesChangeWrapped}
        onConnect={handleConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeClick={handleNodeClickInternal}
        onInit={(instance) => {
          reactFlowInstance.current = instance;
        }}
        nodeTypes={nodeTypes}
        snapToGrid
        snapGrid={[15, 15]}
        deleteKeyCode={['Backspace', 'Delete']}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          pannable
          zoomable
          className="!bg-gray-50 !border-gray-200"
        />
        <Background variant={BackgroundVariant.Dots} gap={15} size={1} color="#e2e8f0" />
      </ReactFlow>
    </div>
  );
}
