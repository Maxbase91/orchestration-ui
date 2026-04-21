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
        e.stopPropagation();
        onNavigate(entity, id);
      }}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100',
        className,
      )}
      title={`Open ${entity} ${id}`}
    >
      {label ?? id}
      <ExternalLink className="size-3 shrink-0" />
    </button>
  );
}
