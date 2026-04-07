import { useNavigate } from 'react-router-dom';
import { Eye, Plus, Check, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import type { Supplier } from '@/data/types';

const countryFlags: Record<string, string> = {
  DE: '\u{1F1E9}\u{1F1EA}',
  GB: '\u{1F1EC}\u{1F1E7}',
  US: '\u{1F1FA}\u{1F1F8}',
  IN: '\u{1F1EE}\u{1F1F3}',
  NL: '\u{1F1F3}\u{1F1F1}',
  FR: '\u{1F1EB}\u{1F1F7}',
  IE: '\u{1F1EE}\u{1F1EA}',
  JP: '\u{1F1EF}\u{1F1F5}',
  CH: '\u{1F1E8}\u{1F1ED}',
};

const riskColors: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
  critical: 'bg-red-200 text-red-900',
};

function ComplianceCheck({ label, pass }: { label: string; pass: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      {pass ? (
        <Check className="size-3 text-green-600" />
      ) : (
        <X className="size-3 text-red-500" />
      )}
      <span className={pass ? 'text-green-700' : 'text-red-600'}>{label}</span>
    </span>
  );
}

interface SupplierCardProps {
  supplier: Supplier;
}

export function SupplierCard({ supplier }: SupplierCardProps) {
  const navigate = useNavigate();
  const flag = countryFlags[supplier.countryCode] ?? '';

  const hasSra = supplier.sraStatus === 'valid' || supplier.sraStatus === 'expiring';
  const hasScreening = supplier.screeningStatus === 'clear';
  const hasCerts = supplier.certifications.length > 0 && supplier.certifications.every((c) => c.status !== 'expired');

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md py-4"
      onClick={() => navigate(`/suppliers/${supplier.id}`)}
    >
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{supplier.name}</h3>
            <p className="text-xs text-muted-foreground">
              {flag} {supplier.country}
            </p>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${riskColors[supplier.riskRating]}`}>
            {supplier.riskRating.charAt(0).toUpperCase() + supplier.riskRating.slice(1)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Active Contracts</span>
            <p className="font-medium text-gray-900">{supplier.activeContracts}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Spend (12M)</span>
            <p className="font-medium text-gray-900">{formatCurrency(supplier.totalSpend12m)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <ComplianceCheck label="SRA" pass={hasSra} />
          <ComplianceCheck label="Screening" pass={hasScreening} />
          <ComplianceCheck label="Certificates" pass={hasCerts} />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/suppliers/${supplier.id}`);
            }}
          >
            <Eye className="size-3" />
            View Profile
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/requests/new?supplierId=${supplier.id}`);
            }}
          >
            <Plus className="size-3" />
            New Request
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export { countryFlags, riskColors };
