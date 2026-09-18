// Workflow designer — template picker dialog. Lists the stored workflow
// templates (the graphs that drive request routing); selecting one loads its
// graph onto the canvas via the parent's onSelect.

import { useWorkflowTemplates } from '@/lib/db/hooks/use-workflow-templates';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BookOpen } from 'lucide-react';

interface TemplateLibraryProps {
  onSelect: (templateId: string) => void;
}

export function TemplateLibrary({ onSelect }: TemplateLibraryProps) {
  const { data: workflowTemplates = [] } = useWorkflowTemplates();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <BookOpen className="h-4 w-4 mr-1.5" />
          Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Workflow Templates</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          {workflowTemplates.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className="w-full text-left rounded-lg border border-line p-3 hover:border-accent-line hover:bg-accent-soft/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink">{t.name}</span>
                <span className="rounded bg-idle-soft px-2 py-0.5 text-xs font-medium text-ink-2 capitalize">{t.type}</span>
              </div>
              <p className="text-xs text-ink-3 mt-1 line-clamp-2">{t.description}</p>
              <p className="text-xs text-ink-3 mt-1">{t.nodes.length} nodes &middot; {t.edges.length} edges</p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
