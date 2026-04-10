import { useMemo } from 'react';
import { FileText, CheckCircle, PackageCheck } from 'lucide-react';
import { requests } from '@/data/requests';

export function WidgetQuickStats() {
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const submitted = requests.filter((r) => r.createdAt.startsWith(thisMonth)).length;
    const approved = requests.filter(
      (r) => r.updatedAt.startsWith(thisMonth) && ['sourcing', 'contracting', 'po', 'receipt', 'invoice', 'payment', 'completed'].includes(r.status),
    ).length;
    const completed = requests.filter(
      (r) => r.updatedAt.startsWith(thisMonth) && (r.status === 'completed' || r.status === 'payment'),
    ).length;

    return { submitted, approved, completed };
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="size-8 rounded-md bg-blue-50 flex items-center justify-center">
          <FileText className="size-4 text-blue-600" />
        </div>
        <div>
          <p className="text-lg font-semibold leading-none">{stats.submitted}</p>
          <p className="text-xs text-muted-foreground">Submitted this month</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="size-8 rounded-md bg-green-50 flex items-center justify-center">
          <CheckCircle className="size-4 text-green-600" />
        </div>
        <div>
          <p className="text-lg font-semibold leading-none">{stats.approved}</p>
          <p className="text-xs text-muted-foreground">Approved this month</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="size-8 rounded-md bg-purple-50 flex items-center justify-center">
          <PackageCheck className="size-4 text-purple-600" />
        </div>
        <div>
          <p className="text-lg font-semibold leading-none">{stats.completed}</p>
          <p className="text-xs text-muted-foreground">Completed this month</p>
        </div>
      </div>
    </div>
  );
}
