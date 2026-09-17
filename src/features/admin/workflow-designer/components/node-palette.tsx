// Workflow designer — draggable node palette. The `type` values here must match
// the nodeTypes registered on the canvas; the drop handler reads them back from
// the 'application/reactflow' dataTransfer key.

import {
  Play,
  Square,
  User,
  Cog,
  Sparkles,
  GitBranch,
  Bell,
} from 'lucide-react';
import type { DragEvent } from 'react';

// Ten types were offered and four round-tripped. `reverseType` mapped
// start/end/userTask/decision and nothing else, so an Approval, Timer, AI
// Agent, Notification, System Action or Sub-workflow node saved as a plain
// stage — the label survived, everything that made it that kind of node did
// not, and nothing said so.
//
// Six now, and every one of them persists:
//   - Approval is gone: approval chains decide who approves, by value band or
//     by a routing rule naming one. A second place to configure approvers is
//     the drift this tranche exists to remove.
//   - Timer/Wait is gone: waiting is `slaDays` on the stage.
//   - Sub-workflow is gone: the engine has no runtime for it.
//   - System Action, AI Agent and Notification all persist as the template's
//     `integration` type, which the engine already handles, distinguished by
//     the `integrationKind` the config panel sets.
const NODE_TYPES = [
  { type: 'start', label: 'Start', icon: Play, color: 'bg-green-100 text-green-600 border-green-200' },
  { type: 'userTask', label: 'Stage', icon: User, color: 'bg-blue-100 text-blue-600 border-blue-200' },
  { type: 'decision', label: 'Decision', icon: GitBranch, color: 'bg-amber-100 text-amber-600 border-amber-200' },
  { type: 'systemAction', label: 'System Action', icon: Cog, color: 'bg-gray-100 text-gray-600 border-gray-200' },
  { type: 'aiAgent', label: 'AI Agent', icon: Sparkles, color: 'bg-purple-100 text-purple-600 border-purple-200' },
  { type: 'notification', label: 'Notification', icon: Bell, color: 'bg-sky-100 text-sky-600 border-sky-200' },
  { type: 'end', label: 'End', icon: Square, color: 'bg-red-100 text-red-600 border-red-200' },
] as const;

export function NodePalette() {
  function onDragStart(event: DragEvent, nodeType: string) {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  }

  return (
    <div className="w-56 shrink-0 border-r border-gray-200 bg-white p-4 overflow-y-auto">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Node Palette</h3>
      <div className="space-y-1.5">
        {NODE_TYPES.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.type}
              draggable
              onDragStart={(e) => onDragStart(e, item.type)}
              className={`flex cursor-grab items-center gap-2.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:shadow-sm active:cursor-grabbing ${item.color}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
