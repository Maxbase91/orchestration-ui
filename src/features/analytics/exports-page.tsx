import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Download, FileSpreadsheet, FileText, File } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ExportFormat = 'csv' | 'excel' | 'pdf';

interface RecentExport extends Record<string, unknown> {
  id: string;
  name: string;
  date: string;
  format: ExportFormat;
  size: string;
}

const DATA_TYPES = [
  'Requests',
  'Suppliers',
  'Contracts',
  'Purchase Orders',
  'Invoices',
  'Spend Data',
];

const recentExports: RecentExport[] = [
  { id: 'exp-1', name: 'Requests_Q1_2026.xlsx', date: '2026-04-01', format: 'excel', size: '2.4 MB' },
  { id: 'exp-2', name: 'Supplier_Directory.csv', date: '2026-03-28', format: 'csv', size: '480 KB' },
  { id: 'exp-3', name: 'Active_Contracts.pdf', date: '2026-03-25', format: 'pdf', size: '1.1 MB' },
  { id: 'exp-4', name: 'PO_Summary_March.xlsx', date: '2026-03-20', format: 'excel', size: '890 KB' },
  { id: 'exp-5', name: 'Spend_Analysis_2025.csv', date: '2026-03-15', format: 'csv', size: '3.2 MB' },
];

const formatIcons: Record<ExportFormat, typeof FileText> = {
  csv: FileText,
  excel: FileSpreadsheet,
  pdf: File,
};

const formatLabels: Record<ExportFormat, string> = {
  csv: 'CSV',
  excel: 'Excel',
  pdf: 'PDF',
};

function formatExportDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function ExportsPage() {
  const [dataType, setDataType] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [format, setFormat] = useState<ExportFormat>('csv');

  const handleExport = () => {
    if (!dataType) {
      toast.error('Please select a data type');
      return;
    }
    toast.success("Export started. You'll be notified when ready.");
  };

  const columns: Column<RecentExport>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (row) => {
        const fmt = row.format as ExportFormat;
        const Icon = formatIcons[fmt];
        return (
          <div className="flex items-center gap-2">
            <Icon className="size-4 text-gray-500" />
            <span className="text-sm font-medium">{row.name as string}</span>
          </div>
        );
      },
    },
    {
      key: 'date',
      label: 'Date',
      render: (row) => <span className="text-sm">{formatExportDate(row.date as string)}</span>,
    },
    {
      key: 'format',
      label: 'Format',
      render: (row) => (
        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 uppercase">
          {row.format as string}
        </span>
      ),
    },
    {
      key: 'size',
      label: 'Size',
      render: (row) => <span className="text-sm text-muted-foreground">{row.size as string}</span>,
    },
    {
      key: 'download',
      label: '',
      render: () => (
        <Button variant="ghost" size="sm" disabled title="Export download ships with the reporting phase.">
          <Download className="size-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Exports" subtitle="Export data in various formats" />

      <div className="rounded-md border bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">New Export</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="data-type">Data Type</Label>
            <Select value={dataType} onValueChange={setDataType}>
              <SelectTrigger id="data-type">
                <SelectValue placeholder="Select data type" />
              </SelectTrigger>
              <SelectContent>
                {DATA_TYPES.map((dt) => (
                  <SelectItem key={dt} value={dt}>{dt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="from-date">From Date</Label>
            <Input
              id="from-date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="to-date">To Date</Label>
            <Input
              id="to-date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Format</Label>
            <div className="flex gap-2 pt-1">
              {(['csv', 'excel', 'pdf'] as ExportFormat[]).map((fmt) => {
                const Icon = formatIcons[fmt];
                return (
                  <button
                    key={fmt}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                      format === fmt
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
                    )}
                    onClick={() => setFormat(fmt)}
                  >
                    <Icon className="size-3.5" />
                    {formatLabels[fmt]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleExport}>
            <Download className="size-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-white shadow-sm">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Recent Exports</h3>
        </div>
        <DataTable
          columns={columns}
          data={recentExports}
          emptyMessage="No recent exports."
        />
      </div>
    </div>
  );
}
