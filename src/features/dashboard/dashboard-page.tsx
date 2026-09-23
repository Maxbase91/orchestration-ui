// Home. A one-line greeting, the front-door command bar, a platform-owned
// attention band, the user's quick actions, and their widget grid. The top of
// the page is kept short on purpose: it used to spend ~330px on a two-line
// greeting and a centred, titled panel around one text field before anything
// the reader could act on.
//
// Customising is a mode rather than a permanent set of controls: it used to be
// three separate affordances in three places, one of them ("Customise" in the
// header) editing only the quick actions despite its name.
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Plus, RotateCcw, Pencil, Check,
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
import { widgetRegistry, allQuickActions } from './widget-registry';
import { widgetComponents } from './widgets';
import { DashboardWidgetCard } from './components/dashboard-widget-card';
import { QuickActionsEditor } from './components/quick-actions-editor';
import { AddWidgetDialog } from './components/add-widget-dialog';
import { openAIChat } from '@/features/ai-assistant/ai-chat-controls';
import { SmartCommandBar } from './components/smart-command-bar';
import { AttentionBand } from './components/attention-band';

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
  const [editing, setEditing] = useState(false);

  const layout = dashboardStore.getLayout(currentRole);
  const selectedQuickActionIds = dashboardStore.getQuickActions(currentRole);
  const selectedQuickActions = selectedQuickActionIds
    .map((id) => allQuickActions.find((a) => a.id === id))
    .filter(Boolean);

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

  // Suppliers have their own portal — redirect (after all hooks, per rules-of-hooks).
  if (currentRole === 'supplier') {
    return <Navigate to="/portal" replace />;
  }

  return (
    <div className="space-y-4">
      {/* One line. The role was repeated here beneath the name, and the header's
          user menu already shows it; the date stays because it is the one thing
          on this line the reader does not already know. */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="truncate text-heading font-semibold text-ink">
            Welcome back, {currentUser.name}
          </h1>
          <span className="shrink-0 text-caption text-ink-3">{today}</span>
        </div>
        <Button
          variant={editing ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setEditing((on) => !on)}
        >
          {editing
            ? <><Check className="mr-1.5 size-3.5" />Done</>
            : <><Pencil className="mr-1.5 size-3.5" />Customise</>}
        </Button>
      </div>

      {/* The front door first: it is always there, so it never moves. The band
          below it appears only once the queue has loaded and has something in
          it — placed above the command bar, its arrival pushed the field down
          under the reader's cursor. */}
      <SmartCommandBar />

      <AttentionBand />

      {/* Customise mode — every control that changes the dashboard, together.
          Out of the mode none of this is on screen; in it, nothing else is. */}
      {editing && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-accent-line bg-accent-soft px-3 py-2">
          <span className="text-caption text-ink-2">
            Drag a tile to reorder, or remove it with the ✕.
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1.5 size-3.5" />
              Add widget
            </Button>
            <Button variant="outline" size="sm" onClick={() => setQaOpen(true)}>
              <Pencil className="mr-1.5 size-3.5" />
              Quick actions
            </Button>
            <Button variant="ghost" size="sm" onClick={() => dashboardStore.resetToDefault(currentRole)}>
              <RotateCcw className="mr-1.5 size-3.5" />
              Reset to default
            </Button>
          </div>
        </div>
      )}

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
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  editing={editing}
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

      {/* Dialogs */}
      <QuickActionsEditor open={qaOpen} onOpenChange={setQaOpen} />
      <AddWidgetDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
