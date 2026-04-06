import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AISuggestionCard } from '@/components/shared/ai-suggestion-card';
import { FileText, FileSpreadsheet, File, Download, Eye } from 'lucide-react';
import type { ProcurementRequest } from '@/data/types';
import { formatDate } from '@/lib/format';

interface MockDocument {
  id: string;
  filename: string;
  type: 'pdf' | 'xlsx' | 'docx' | 'other';
  uploadedBy: string;
  date: string;
  size: string;
}

function getDocumentsForRequest(_requestId: string): MockDocument[] {
  const baseDocuments: MockDocument[] = [
    {
      id: 'DOC-001',
      filename: 'Statement_of_Work_v2.pdf',
      type: 'pdf',
      uploadedBy: 'Elena Petrova',
      date: '2024-11-15',
      size: '2.4 MB',
    },
    {
      id: 'DOC-002',
      filename: 'Budget_Breakdown.xlsx',
      type: 'xlsx',
      uploadedBy: 'Sarah Chen',
      date: '2024-11-20',
      size: '145 KB',
    },
    {
      id: 'DOC-003',
      filename: 'Technical_Requirements.pdf',
      type: 'pdf',
      uploadedBy: 'Elena Petrova',
      date: '2024-11-10',
      size: '1.8 MB',
    },
    {
      id: 'DOC-004',
      filename: 'Supplier_Proposal.pdf',
      type: 'pdf',
      uploadedBy: 'Marcus Johnson',
      date: '2024-12-01',
      size: '3.1 MB',
    },
    {
      id: 'DOC-005',
      filename: 'Risk_Assessment.docx',
      type: 'docx',
      uploadedBy: 'Anna Muller',
      date: '2024-12-05',
      size: '520 KB',
    },
  ];
  return baseDocuments;
}

const fileIcons: Record<string, typeof FileText> = {
  pdf: FileText,
  xlsx: FileSpreadsheet,
  docx: FileText,
  other: File,
};

interface TabDocumentsProps {
  request: ProcurementRequest;
}

export function TabDocuments({ request }: TabDocumentsProps) {
  const documents = getDocumentsForRequest(request.id);

  return (
    <div className="space-y-6">
      <AISuggestionCard title="Document Analysis" confidence={0.88}>
        <p>
          This SOW specifies a {request.value > 500000 ? '24' : '12'}-month engagement at{' '}
          {new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(request.value)}.
          Key deliverables include initial assessment, implementation plan, and ongoing support.
          The payment schedule is milestone-based with 30-day payment terms.
        </p>
      </AISuggestionCard>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documents ({documents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {documents.map((doc) => {
              const Icon = fileIcons[doc.type] ?? File;
              return (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="size-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {doc.filename}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {doc.uploadedBy} &middot; {formatDate(doc.date)} &middot; {doc.size}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon-xs" variant="ghost">
                      <Eye className="size-3.5" />
                    </Button>
                    <Button size="icon-xs" variant="ghost">
                      <Download className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
