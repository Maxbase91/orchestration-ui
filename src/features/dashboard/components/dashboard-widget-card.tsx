// Sortable shell around every dashboard widget: drag handle, remove button and
// the size → grid-column mapping. Widget content is passed in as children so
// the drag/layout mechanics live in one place.
//
// The handle and the remove button appear only while the dashboard is in
// customise mode. They used to be permanent — a grip on every card at all
// times, competing with the widget's own title for the top-left of each tile,
// on a screen whose job is to be read rather than rearranged.
import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardWidgetCardProps {
  id: string;
  title: string;
  size: string;
  onRemove: () => void;
  /** Customise mode: the handle and the remove button are shown, and drag is armed. */
  editing: boolean;
  children: ReactNode;
}

/**
 * Spans are widened as columns appear, never narrowed.
 *
 * A fixed `col-span-3` in a one-column grid does not clamp — CSS grid creates
 * two implicit columns for it, so on a phone the dashboard scrolled sideways
 * and two thirds of every wide tile sat off-screen.
 */
const sizeClasses: Record<string, string> = {
  small: 'col-span-1',
  medium: 'sm:col-span-2',
  large: 'sm:col-span-2',
  full: 'sm:col-span-2 lg:col-span-3',
};

export function DashboardWidgetCard({ id, title, size, onRemove, editing, children }: DashboardWidgetCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !editing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group rounded-md border border-line bg-card p-4',
        // Outside customise mode the card is a surface to read. Inside it, the
        // dashed edge says the tile itself is the thing being manipulated.
        editing && 'border-dashed border-accent-line',
        sizeClasses[size] ?? 'col-span-1',
        isDragging && 'opacity-50 ring-2 ring-accent-line',
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* Drag listeners sit on the grip only, so buttons/links inside the widget stay clickable. */}
          {editing && (
            <button
              type="button"
              aria-label={`Drag ${title} widget`}
              className="cursor-grab touch-none text-ink-3 hover:text-ink active:cursor-grabbing"
              // dnd-kit's attributes (role, tabIndex, the sortable description)
              // go on the handle, not the card. On the card they made every
              // tile a keyboard stop announced as a button — at rest, when it
              // could not be moved — and wrapped the widget's own links and
              // buttons in an element claiming to be one.
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-4" />
            </button>
          )}
          {/* Sentence case, not an uppercase eyebrow: these are names like
              "Suppliers Blocking Work", and capitalising them costs legibility
              on the longest ones for a uniformity nobody asked for. */}
          <h3 className="text-body font-semibold text-ink">{title}</h3>
        </div>
        {editing && (
          <button
            type="button"
            aria-label={`Remove ${title} widget`}
            onClick={onRemove}
            className="text-ink-3 transition-colors hover:text-stop"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
