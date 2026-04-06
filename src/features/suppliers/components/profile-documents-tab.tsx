import { FileText, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import type { Supplier } from '@/data/types';

interface MockDocument {
  id: string;
  name: string;
  type: string;
  expiryDate: string;
  status: 'valid' | 'expiring' | 'expired';
}

function getMockDocuments(supplier: Supplier): MockDocument[] {
  const docs: MockDocument[] = [
    {
      id: 'doc-1',
      name: 'General Liability Insurance',
      type: 'Insurance',
      expiryDate: '2025-12-31',
      status: 'valid',
    },
    {
      id: 'doc-2',
      name: 'Professional Indemnity Insurance',
      type: 'Insurance',
      expiryDate: '2025-06-30',
      status: 'expiring',
    },
    {
      id: 'doc-3',
      name: 'Code of Conduct Acknowledgement',
      type: 'Compliance',
      expiryDate: '2026-01-15',
      status: 'valid',
    },
    {
      id: 'doc-4',
      name: 'Anti-Bribery & Corruption Declaration',
      type: 'Compliance',
      expiryDate: '2025-09-30',
      status: 'valid',
    },
    {
      id: 'doc-5',
      name: 'Data Processing Agreement',
      type: 'Legal',
      expiryDate: '2025-03-31',
      status: 'expired',
    },
  ];

  // Add certification docs from supplier data
  supplier.certifications.forEach((cert, i) => {
    docs.push({
      id: `cert-${i}`,
      name: `${cert.name} Certificate`,
      type: 'Certification',
      expiryDate: cert.expiryDate,
      status: cert.status,
    });
  });

  return docs;
}

interface ProfileDocumentsTabProps {
  supplier: Supplier;
}

export function ProfileDocumentsTab({ supplier }: ProfileDocumentsTabProps) {
  const documents = getMockDocuments(supplier);

  return (
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
                    {doc.type} &middot; Expires: {doc.expiryDate}
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
  );
}
