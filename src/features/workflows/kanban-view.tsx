import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import type { ProcurementRequest, RequestStatus } from '@/data/types';
import { WorkflowCard } from './components/workflow-card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const STAGE_ORDER: RequestStatus[] = [
  'intake',
  'validation',
  'approval',
  'sourcing',
  'contracting',
  'po',
  'receipt',
  'invoice',
  'payment',
];

const STAGE_LABELS: Record<string, string> = {
  intake: 'Intake',
  validation: 'Validation',
  approval: 'Approval',
  sourcing: 'Sourcing',
  contracting: 'Contracting',
  po: 'PO',
  receipt: 'Receipt',
  invoice: 'Invoice',
  payment: 'Payment',
};

interface KanbanColumnProps {
  stage: RequestStatus;
  requests: ProcurementRequest[];
  onCardClick?: (id: string) => void;
}

function KanbanColumn({ stage, requests, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const totalValue = requests.reduce((sum, r) => sum + r.value, 0);
  const ids = requests.map((r) => r.id);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-[260px] shrink-0 flex-col rounded-md border bg-gray-50/80',
        isOver && 'ring-2 ring-blue-400/50',
      )}
    >
      <div className="border-b bg-white px-3 py-2 rounded-t-md">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-700">
            {STAGE_LABELS[stage] ?? stage}
          </h3>
          <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
            {requests.length}
          </span>
        </div>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {formatCurrency(totalValue)}
        </p>
      </div>

      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 p-2 min-h-[80px] overflow-y-auto max-h-[calc(100vh-280px)]">
          {requests.map((req) => (
            <WorkflowCard
              key={req.id}
              request={req}
              onClick={() => onCardClick?.(req.id)}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

interface KanbanViewProps {
  requests: ProcurementRequest[];
  onCardClick?: (id: string) => void;
}

export function KanbanView({ requests, onCardClick }: KanbanViewProps) {
  const [items, setItems] = useState(requests);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const activeRequest = activeId
    ? items.find((r) => r.id === activeId)
    : undefined;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);

    const { active, over } = event;
    if (!over) return;

    const overId = String(over.id);
    const activeItem = items.find((r) => r.id === active.id);
    if (!activeItem) return;

    // Determine the target stage: either the column id directly or the stage of the item being dropped on
    let targetStage: RequestStatus | undefined;
    if (STAGE_ORDER.includes(overId as RequestStatus)) {
      targetStage = overId as RequestStatus;
    } else {
      const overItem = items.find((r) => r.id === overId);
      targetStage = overItem?.status;
    }

    if (!targetStage || activeItem.status === targetStage) return;

    setItems((prev) =>
      prev.map((r) =>
        r.id === activeItem.id
          ? { ...r, status: targetStage, daysInStage: 0 }
          : r,
      ),
    );
  }

  const grouped = STAGE_ORDER.reduce<Record<string, ProcurementRequest[]>>(
    (acc, stage) => {
      acc[stage] = items.filter((r) => r.status === stage);
      return acc;
    },
    {},
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-4">
          {STAGE_ORDER.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              requests={grouped[stage] ?? []}
              onCardClick={onCardClick}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <DragOverlay>
        {activeRequest ? (
          <div className="w-[244px]">
            <WorkflowCard request={activeRequest} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
