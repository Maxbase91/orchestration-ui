import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Plus, RotateCcw, Pencil,
  Search, CheckCircle, Sparkles, FileText, AlertTriangle, Building2,
  BarChart3, Shield, MessageSquare, ShoppingBag, ListTodo, FileSignature,
  Receipt, Route, PenTool, UserCog,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { format } from 'date-fns';

import { useAuthStore } from '@/stores/auth-store';
import { useDashboardStore } from '@/stores/dashboard-store';
import { Button } from '@/components/ui/button';
import { roles } from '@/config/roles';
import { widgetRegistry, allQuickActions } from './widget-registry';
import { widgetComponents } from './widgets';
import { DashboardWidgetCard } from './components/dashboard-widget-card';
import { QuickActionsEditor } from './components/quick-actions-editor';
import { AddWidgetDialog } from './components/add-widget-dialog';
import { openAIChat } from '@/features/ai-assistant/ai-chat-overlay';

const qaIconMap: Record<string, LucideIcon> = {
  Plus, Search, CheckCircle, Sparkles, FileText, AlertTriangle, Building2,
  BarChart3, Shield, MessageSquare, ShoppingBag, ListTodo, FileSignature,
  Receipt, Route, PenTool, UserCog,
  Workflow: BarChart3,
};

export function DashboardPage() {
  const { currentRole, currentUser } = useAuthStore();
  const dashboardStore = useDashboardStore();

  const [qaOpen, setQaOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Supplier redirect
  if (currentRole === 'supplier') {
    return <Navigate to="/portal" replace />;
  }

  const layout = dashboardStore.getLayout(currentRole);
  const selectedQuickActionIds = dashboardStore.getQuickActions(currentRole);
  const selectedQuickActions = selectedQuickActionIds
    .map((id) => allQuickActions.find((a) => a.id === id))
    .filter(Boolean);

  const roleConfig = roles.find((r) => r.id === currentRole);
  const roleLabel = roleConfig?.label ?? currentRole;
  const today = format(new Date(), 'EEEE, d MMMM yyyy');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const fromIndex = layout.indexOf(active.id as string);
    const toIndex = layout.indexOf(over.id as string);
    if (fromIndex !== -1 && toIndex !== -1) {
      dashboardStore.reorderWidgets(currentRole, fromIndex, toIndex);
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Welcome back, {currentUser.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {roleLabel} &middot; {today}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setQaOpen(true)}>
            <Pencil className="size-3.5 mr-1.5" />
            Customise
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        {selectedQuickActions.map((action) => {
          if (!action) return null;
          const Icon = qaIconMap[action.icon] ?? Plus;

          if (action.action === 'open-ai-chat') {
            return (
              <Button key={action.id} variant="outline" size="sm" onClick={() => openAIChat()}>
                <Icon className="size-3.5 mr-1.5" />
                {action.label}
              </Button>
            );
          }

          return (
            <Button key={action.id} variant="outline" size="sm" asChild>
              <Link to={action.to ?? '/'}>
                <Icon className="size-3.5 mr-1.5" />
                {action.label}
              </Link>
            </Button>
          );
        })}
      </div>

      {/* Widget Grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={layout} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 gap-4">
            {layout.map((widgetId) => {
              const config = widgetRegistry.find((w) => w.id === widgetId);
              const Component = widgetComponents[widgetId];
              if (!config || !Component) return null;
              return (
                <DashboardWidgetCard
                  key={widgetId}
                  id={widgetId}
                  title={config.title}
                  size={config.size}
                  onRemove={() => dashboardStore.removeWidget(currentRole, widgetId)}
                >
                  <Component />
                </DashboardWidgetCard>
              );
            })}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeId ? (
            <div className="bg-card rounded-md shadow-lg p-4 opacity-80">
              Dragging widget...
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Bottom actions */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={() => setAddOpen(true)}>
          <Plus className="size-4 mr-1.5" />
          Add Widget
        </Button>
        <Button variant="ghost" onClick={() => dashboardStore.resetToDefault(currentRole)}>
          <RotateCcw className="size-4 mr-1.5" />
          Reset to Default
        </Button>
      </div>

      {/* Dialogs */}
      <QuickActionsEditor open={qaOpen} onOpenChange={setQaOpen} />
      <AddWidgetDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
