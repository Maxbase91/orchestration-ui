import { useMemo } from 'react';
import { FileText, Download } from 'lucide-react';
import type { ProcurementRequest } from '@/data/types';
import { useWorkflowStepDetailsForRequest } from '@/lib/db/hooks/use-workflow-step-details';
import { formatDate } from '@/lib/format';
import { getStatusLabel } from '@/lib/status';

interface DocumentRow {
  name: string;
  type: string;
  stage: string;
  addedBy: string;
  addedAt: string;
}

interface TabDocumentsProps {
  request: ProcurementRequest;
}

export function TabDocuments({ request }: TabDocumentsProps) {
  const { data: stepDetails = [] } = useWorkflowStepDetailsForRequest(request.id);

  const documents = useMemo<DocumentRow[]>(() => {
    return stepDetails
      .flatMap((step) =>
        (step.documentsAdded ?? []).map((doc) => ({
          ...doc,
          stage: step.stage,
        })),
      )
      .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  }, [stepDetails]);

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
        <FileText className="size-10 opacity-30" />
        <p className="text-sm">No documents have been added to this request yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
        <span>Name</span>
        <span>Type</span>
        <span>Stage</span>
        <span>Added By</span>
        <span>Date</span>
      </div>
      {documents.map((doc, i) => (
        <div
          key={i}
          className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 items-center px-3 py-2.5 rounded-md hover:bg-muted/50 text-sm"
        >
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="size-4 shrink-0 text-blue-500" />
            <span className="truncate font-medium text-gray-900">{doc.name}</span>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">{doc.type}</span>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {getStatusLabel(doc.stage)}
          </span>
          <span className="text-xs text-muted-foreground whitespace-nowrap">{doc.addedBy}</span>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-xs text-muted-foreground">{formatDate(doc.addedAt)}</span>
            <button
              disabled
              title="Document download ships with the document-storage phase"
              className="p-1 rounded text-gray-300 cursor-not-allowed"
            >
              <Download className="size-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
