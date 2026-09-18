// Foreign-key chip for the database admin browser: renders a linked record id
// as a button that jumps to that record inside the admin view (no route change).

import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EntityKey } from '@/stores/database-admin-store';

interface FkLinkProps {
  entity: EntityKey;
  id: string | undefined;
  label?: string;
  onNavigate: (entity: EntityKey, id: string) => void;
  className?: string;
}

export function FkLink({ entity, id, label, onNavigate, className }: FkLinkProps) {
  if (!id) {
    return <span className="text-xs text-muted-foreground italic">—</span>;
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        // Chips sit inside clickable table rows — don't also open the row.
        e.stopPropagation();
        onNavigate(entity, id);
      }}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-accent-line bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-solid transition-colors hover:bg-accent-soft',
        className,
      )}
      title={`Open ${entity} ${id}`}
    >
      {label ?? id}
      <ExternalLink className="size-3 shrink-0" />
    </button>
  );
}
