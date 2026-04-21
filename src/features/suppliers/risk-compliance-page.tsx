import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/page-header';
import { KPICard } from '@/components/shared/kpi-card';
import { DataTable, type Column } from '@/components/shared/data-table';
import { useSuppliers } from '@/lib/db/hooks/use-suppliers';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { RiskRating } from '@/data/types';

interface SupplierRow extends Record<string, unknown> {
  id: string;
  name: string;
  riskRating: RiskRating;
  sraStatus: string;
  sraExpiry: string;
  screeningStatus: string;
  certCount: number;
  expiringCerts: number;
  tier: number;
}

const riskColors: Record<RiskRating, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const sraColors: Record<string, string> = {
  valid: 'bg-green-100 text-green-700',
  expiring: 'bg-amber-100 text-amber-700',
  expired: 'bg-red-100 text-red-700',
  'not-assessed': 'bg-gray-100 text-gray-600',
};

const screeningColors: Record<string, string> = {
  clear: 'bg-green-100 text-green-700',
  flagged: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
};

export function RiskCompliancePage() {
  const navigate = useNavigate();
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [sraFilter, setTpraFilter] = useState<string>('all');

  const { data: suppliers = [] } = useSuppliers();

  const rows = useMemo<SupplierRow[]>(() => {
    return suppliers.map((s) => {
      const expiringCerts = s.certifications.filter((c) => c.status === 'expiring' || c.status === 'expired').length;
      return {
        id: s.id,
        name: s.name,
        riskRating: s.riskRating,
        sraStatus: s.sraStatus,
        sraExpiry: s.sraExpiryDate ?? '',
        screeningStatus: s.screeningStatus,
        certCount: s.certifications.length,
        expiringCerts,
        tier: s.tier,
      };
    });
  }, [suppliers]);

  const filtered = useMemo(() => {
    let result = rows;
    if (riskFilter !== 'all') {
      result = result.filter((r) => r.riskRating === riskFilter);
    }
    if (sraFilter !== 'all') {
      result = result.filter((r) => r.sraStatus === sraFilter);
    }
    return result;
  }, [rows, riskFilter, sraFilter]);

  const suppliersAtRisk = rows.filter((r) => r.riskRating === 'high' || r.riskRating === 'critical').length;
  const expiringSRAs = rows.filter((r) => r.sraStatus === 'expiring' || r.sraStatus === 'expired').length;
  const pendingScreenings = rows.filter((r) => r.screeningStatus === 'pending').length;

  const columns: Column<SupplierRow>[] = [
    {
      key: 'name',
      label: 'Supplier Name',
      sortable: true,
      render: (row) => <span className="text-sm font-medium">{row.name as string}</span>,
    },
    {
      key: 'riskRating',
      label: 'Risk Rating',
      sortable: true,
      render: (row) => (
        <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize', riskColors[row.riskRating as RiskRating])}>
          {row.riskRating as string}
        </span>
      ),
    },
    {
      key: 'sraStatus',
      label: 'SRA Status',
      render: (row) => (
        <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize', sraColors[row.sraStatus as string] ?? '')}>
          {(row.sraStatus as string).replace('-', ' ')}
        </span>
      ),
    },
    {
      key: 'sraExpiry',
      label: 'SRA Expiry',
      sortable: true,
      render: (row) => {
        const val = row.sraExpiry as string;
        if (!val) return <span className="text-xs text-muted-foreground">N/A</span>;
        return <span className="text-sm">{formatDate(val)}</span>;
      },
    },
    {
      key: 'screeningStatus',
      label: 'Screening',
      render: (row) => (
        <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize', screeningColors[row.screeningStatus as string] ?? '')}>
          {row.screeningStatus as string}
        </span>
      ),
    },
    {
      key: 'certCount',
      label: 'Certifications',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{row.certCount as number}</span>
          {(row.expiringCerts as number) > 0 && (
            <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
              {row.expiringCerts} expiring
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'tier',
      label: 'Tier',
      sortable: true,
      render: (row) => <span className="text-sm">Tier {row.tier as number}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk & Compliance"
        subtitle="Monitor supplier risk ratings, SRA status, and compliance certifications"
        actions={
          <div className="flex items-center gap-2">
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Risk rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risks</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sraFilter} onValueChange={setTpraFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="SRA status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All SRA</SelectItem>
                <SelectItem value="valid">Valid</SelectItem>
                <SelectItem value="expiring">Expiring</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="not-assessed">Not Assessed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KPICard label="Suppliers at Risk" value={suppliersAtRisk} trend={{ direction: 'up', percentage: 8 }} />
        <KPICard label="Expiring/Expired SRAs" value={expiringSRAs} trend={{ direction: 'up', percentage: 12 }} />
        <KPICard label="Pending Screenings" value={pendingScreenings} />
      </div>

      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={(row) => navigate(`/suppliers/${row.id}`)}
          searchable
          searchPlaceholder="Search suppliers..."
          emptyMessage="No suppliers match the current filters."
        />
      </div>
    </div>
  );
}
