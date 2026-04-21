import { useSearchParams } from 'react-router-dom';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { useDatabaseAdminStore } from '@/stores/database-admin-store';
import type { EntityKey } from '@/stores/database-admin-store';
import { EntityTableView } from './components/entity-table-view';
import { entityConfigs } from './entity-configs';

const TAB_ORDER: { key: EntityKey; label: string }[] = [
  { key: 'supplier', label: 'Suppliers' },
  { key: 'contract', label: 'Contracts' },
  { key: 'riskAssessment', label: 'Risk Assessments' },
  { key: 'purchaseOrder', label: 'Purchase Orders' },
  { key: 'invoice', label: 'Invoices' },
  { key: 'request', label: 'Requests' },
  { key: 'approval', label: 'Approvals' },
  { key: 'workflow', label: 'Workflows' },
];

const DEFAULT_TAB: EntityKey = 'supplier';

export function DatabaseAdminPage() {
  const [params, setParams] = useSearchParams();
  const reset = useDatabaseAdminStore((s) => s.reset);

  const urlTab = params.get('tab') as EntityKey | null;
  const urlEdit = params.get('edit');
  const activeTab: EntityKey =
    urlTab && TAB_ORDER.some((t) => t.key === urlTab) ? urlTab : DEFAULT_TAB;
  const pendingOpenId = urlEdit ?? undefined;

  function setActiveTab(key: EntityKey) {
    const next = new URLSearchParams(params);
    next.set('tab', key);
    next.delete('edit');
    setParams(next, { replace: true });
  }

  function handleNavigate(entity: EntityKey, id: string) {
    const next = new URLSearchParams();
    next.set('tab', entity);
    next.set('edit', id);
    setParams(next, { replace: false });
  }

  function handleExternalHandled() {
    if (!params.has('edit')) return;
    const next = new URLSearchParams(params);
    next.delete('edit');
    setParams(next, { replace: true });
  }

  function handleReset() {
    if (!confirm('Reset all database tabs to seed data? This discards every session edit.')) return;
    reset();
    setParams({}, { replace: true });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Database"
        subtitle="Browse and edit the underlying data model across every entity. Use this view to inspect how suppliers, contracts, POs, invoices, risk assessments, requests and approvals relate."
        actions={
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="mr-1.5 size-4" />
            Reset session edits
          </Button>
        }
      />

      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="font-medium">Session-only edits</p>
          <p className="text-xs">
            Changes made here are in-memory for this browser session. They appear in the Audit Log,
            but other feature pages (Suppliers, Contracts, etc.) still read the original seed data.
            This view is for platform admins to understand the data model and simulate edits.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as EntityKey)}>
        <TabsList variant="line" className="w-full justify-start flex-wrap">
          {TAB_ORDER.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
              <CountBadge entity={t.key} />
            </TabsTrigger>
          ))}
        </TabsList>

        {TAB_ORDER.map((t) => (
          <TabsContent key={t.key} value={t.key} className="mt-4">
            <EntityTableView
              // Key by entity so component state (filters, sheet) resets per tab
              key={t.key}
              config={entityConfigs[t.key] as never}
              onNavigate={handleNavigate}
              externalOpenId={activeTab === t.key ? pendingOpenId : undefined}
              onExternalHandled={handleExternalHandled}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function CountBadge({ entity }: { entity: EntityKey }) {
  const count = useDatabaseAdminStore((s) => (s[entity] as unknown[]).length);
  return (
    <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
      {count}
    </span>
  );
}
