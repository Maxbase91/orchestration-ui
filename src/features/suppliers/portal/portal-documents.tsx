import { FileText, Upload, AlertTriangle, Download, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { useAiAgent } from '@/lib/db/hooks/use-ai-agents';

interface PortalDocument {
  id: string;
  name: string;
  type: string;
  expiryDate: string;
  status: 'valid' | 'expiring' | 'expired';
  uploadedDate: string;
}

const documents: PortalDocument[] = [
  {
    id: 'pdoc-1',
    name: 'ISO 27001 Certificate',
    type: 'Certification',
    expiryDate: '2025-11-30',
    status: 'valid',
    uploadedDate: '2024-12-01',
  },
  {
    id: 'pdoc-2',
    name: 'ISO 9001 Certificate',
    type: 'Certification',
    expiryDate: '2025-08-15',
    status: 'valid',
    uploadedDate: '2024-09-10',
  },
  {
    id: 'pdoc-3',
    name: 'SOC 2 Type II Report',
    type: 'Certification',
    expiryDate: '2025-06-30',
    status: 'valid',
    uploadedDate: '2024-07-15',
  },
  {
    id: 'pdoc-4',
    name: 'General Liability Insurance',
    type: 'Insurance',
    expiryDate: '2025-03-31',
    status: 'expiring',
    uploadedDate: '2024-04-01',
  },
  {
    id: 'pdoc-5',
    name: 'Professional Indemnity Insurance',
    type: 'Insurance',
    expiryDate: '2025-01-15',
    status: 'expired',
    uploadedDate: '2024-01-20',
  },
  {
    id: 'pdoc-6',
    name: 'Code of Conduct Acknowledgement',
    type: 'Compliance',
    expiryDate: '2026-01-01',
    status: 'valid',
    uploadedDate: '2025-01-05',
  },
  {
    id: 'pdoc-7',
    name: 'Anti-Bribery Declaration',
    type: 'Compliance',
    expiryDate: '2025-12-31',
    status: 'valid',
    uploadedDate: '2025-01-05',
  },
];

export function PortalDocuments() {
  const expiringDocs = documents.filter((d) => d.status === 'expiring' || d.status === 'expired');
  const { data: extractorAgent } = useAiAgent('AI-003');
  const extractorActive = extractorAgent?.status === 'active';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Documents & Compliance</h1>
        <Button>
          {extractorActive ? <Sparkles className="size-4" /> : <Upload className="size-4" />}
          {extractorActive ? 'Upload & Auto-Extract' : 'Upload Document'}
        </Button>
      </div>

      {expiringDocs.length > 0 && (
        <div className="rounded-md border-l-2 border-amber-400 bg-amber-50 p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">
              {expiringDocs.length} document(s) require attention
            </span>
          </div>
          <ul className="mt-1 pl-6 text-xs text-amber-700">
            {expiringDocs.map((d) => (
              <li key={d.id}>
                {d.name} -- {d.status === 'expired' ? 'Expired' : 'Expiring'} {d.expiryDate}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Card className="py-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Document Library</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.type} &middot; Uploaded: {doc.uploadedDate} &middot; Expires: {doc.expiryDate}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={doc.status} size="sm" />
                  <Button variant="ghost" size="sm" className="h-7">
                    <Download className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upload area */}
      <Card className="py-4">
        <CardContent>
          <div className="flex flex-col items-center justify-center rounded-md border-2 border-dashed border-gray-300 py-10">
            <Upload className="size-8 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium text-gray-900">Drop files here or click to upload</p>
            <p className="mt-1 text-xs text-muted-foreground">
              PDF, DOC, DOCX, JPG, PNG up to 10MB
            </p>
            {extractorAgent && (
              <p className="mt-2 text-[11px] text-gray-400">
                {extractorActive
                  ? `Auto-extraction on via ${extractorAgent.name} (AI-003) · accuracy ${extractorAgent.accuracy}%`
                  : `Auto-extraction off — ${extractorAgent.name} is ${extractorAgent.status}`}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
