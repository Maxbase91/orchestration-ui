// Contract detail page: single-contract view with summary, financials,
// obligations, renewal, documents and related-object tabs. Reads the contract
// from the own store; obligations/documents are illustrative sample data.
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, FileText, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { BarChartWidget } from '@/components/charts/bar-chart-widget';
import { useContract } from '@/lib/db/hooks/use-contracts';
import { usePurchaseOrders } from '@/lib/db/hooks/use-purchase-orders';
import { useInvoices } from '@/lib/db/hooks/use-invoices';
import { formatCurrency, formatDate } from '@/lib/format';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loadContractScope, saveContractScope } from '@/lib/procurement/contract-scope-api';
import { requestContractMatch } from '@/lib/procurement/contract-match-api';
import type { ContractMatchResponse } from '@/data/types';
import type { ContractScopeDeliverable, ContractScopeExclusion } from '@/data/types';

interface Obligation {
  id: string;
  title: string;
  dueDate: string;
  completed: boolean;
}

const mockObligations: Obligation[] = [
  { id: 'ob-1', title: 'Quarterly performance review', dueDate: '2025-03-31', completed: false },
  { id: 'ob-2', title: 'Annual security audit submission', dueDate: '2025-06-30', completed: false },
  { id: 'ob-3', title: 'Insurance certificate renewal', dueDate: '2025-01-31', completed: true },
  { id: 'ob-4', title: 'Data processing agreement review', dueDate: '2025-04-30', completed: false },
  { id: 'ob-5', title: 'SLA compliance report', dueDate: '2025-02-28', completed: true },
];

const mockDocuments = [
  { name: 'Master Services Agreement.pdf', size: '2.4 MB', uploaded: '2024-01-15' },
  { name: 'Statement of Work - Phase 1.pdf', size: '1.1 MB', uploaded: '2024-01-20' },
  { name: 'NDA - Executed.pdf', size: '450 KB', uploaded: '2023-12-10' },
  { name: 'Insurance Certificate.pdf', size: '320 KB', uploaded: '2024-06-15' },
  { name: 'Amendment 1 - Rate Card Update.pdf', size: '280 KB', uploaded: '2024-09-01' },
];

export function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: contract } = useContract(id);
  const { data: purchaseOrders = [] } = usePurchaseOrders();
  const { data: invoices = [] } = useInvoices();
  const [obligations, setObligations] = useState(mockObligations);
  const queryClient = useQueryClient();
  const scopeQuery = useQuery({ queryKey: ['contract-scope', id], queryFn: () => loadContractScope(id!), enabled: Boolean(id) });
  const scopeMutation = useMutation({
    mutationFn: (payload: { scope: Record<string, unknown>; deliverables: ContractScopeDeliverable[]; exclusions: ContractScopeExclusion[] }) => saveContractScope(id!, payload.scope, payload.deliverables, payload.exclusions),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['contract-scope', id] }); },
  });
  const [scopeNarrative, setScopeNarrative] = useState('');
  const [serviceFamily, setServiceFamily] = useState('');
  const [deliverablesText, setDeliverablesText] = useState('');
  const [exclusionsText, setExclusionsText] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [matchPreview, setMatchPreview] = useState<ContractMatchResponse | null>(null);
  const [previewPending, setPreviewPending] = useState(false);
  const existingScope = scopeQuery.data?.scope;
  const effectiveNarrative = scopeNarrative || existingScope?.scopeNarrative || '';
  const effectiveServiceFamily = serviceFamily || existingScope?.serviceFamily || '';
  const effectiveDeliverablesText = deliverablesText || (scopeQuery.data?.deliverables ?? []).map((item) => item.name).join('\n');
  const effectiveExclusionsText = exclusionsText || (scopeQuery.data?.exclusions ?? []).map((item) => item.term).join('\n');

  if (!contract) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-sm text-muted-foreground">Contract not found.</p>
        <Button variant="outline" onClick={() => navigate('/contracts')}>
          <ArrowLeft className="size-4" />
          Back to Contracts
        </Button>
      </div>
    );
  }

  // Actual spend is derived from utilisation (no transaction feed in R1);
  // committed uses an illustrative 85% of contract value for the comparison.
  const actualSpend = Math.round(contract.value * contract.utilisationPercentage / 100);
  const committedSpend = Math.round(contract.value * 0.85);

  // Invoices link to contracts indirectly via their PO, so resolve POs first.
  const linkedPOs = purchaseOrders.filter((po) => po.contractId === contract.id);
  const linkedInvoices = invoices.filter((inv) => linkedPOs.some((po) => po.id === inv.poId));

  const financialData = [
    { name: 'Contracted', value: contract.value },
    { name: 'Actual Spend', value: actualSpend },
    { name: 'Committed', value: committedSpend },
  ];

  const toggleObligation = (obId: string) => {
    setObligations((prev) =>
      prev.map((o) => (o.id === obId ? { ...o, completed: !o.completed } : o))
    );
  };

  return (
    <div className="space-y-5">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => navigate('/contracts')}
      >
        <ArrowLeft className="size-3.5" />
        Back to Contracts
      </Button>

      <PageHeader
        title={contract.title}
        subtitle={`${contract.supplierName} | ${contract.department}`}
        badge={
          <div className="flex items-center gap-2">
            <StatusBadge status={contract.status} />
            <span className="text-sm text-muted-foreground">
              {formatCurrency(contract.value)}
            </span>
          </div>
        }
      />

      <div className="text-sm text-muted-foreground">
        {formatDate(contract.startDate)} - {formatDate(contract.endDate)}
        {contract.renewalDate && (
          <span className="ml-2">| Renewal: {formatDate(contract.renewalDate)}</span>
        )}
      </div>

      <Tabs defaultValue="summary">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="coverage">Coverage & Matching</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="obligations">Obligations</TabsTrigger>
          <TabsTrigger value="renewal">Renewal</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="related">Related</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Key Terms</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Contract Value</span><span className="font-medium">{formatCurrency(contract.value)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span>{contract.category}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Department</span><span>{contract.department}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Owner</span><span>{contract.ownerName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Utilisation</span><span>{contract.utilisationPercentage}%</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Dates & Parties</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Start Date</span><span>{formatDate(contract.startDate)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">End Date</span><span>{formatDate(contract.endDate)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Renewal Date</span><span>{contract.renewalDate ? formatDate(contract.renewalDate) : 'N/A'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Supplier</span><span>{contract.supplierName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Linked Requests</span><span>{contract.linkedRequestIds.length}</span></div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="coverage" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Coverage & matching</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {scopeQuery.isLoading && <p className="text-sm text-muted-foreground">Loading scope metadata…</p>}
              {!scopeQuery.isLoading && !scopeQuery.data?.scope && <p className="text-sm text-amber-700">This contract has no complete scope version yet, so requests will continue to full intake.</p>}
              <label className="block text-sm font-medium">Service family<input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={effectiveServiceFamily} onChange={(event) => setServiceFamily(event.target.value)} placeholder="e.g. payroll implementation" /></label>
              <label className="block text-sm font-medium">Scope description<textarea className="mt-1 min-h-24 w-full rounded-md border px-3 py-2 text-sm" value={effectiveNarrative} onChange={(event) => setScopeNarrative(event.target.value)} placeholder="Describe the services and outcomes this contract covers" /></label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-medium">Deliverables (one per line)<textarea className="mt-1 min-h-24 w-full rounded-md border px-3 py-2 text-sm" value={effectiveDeliverablesText} onChange={(event) => setDeliverablesText(event.target.value)} /></label>
                <label className="block text-sm font-medium">Exclusions (one per line)<textarea className="mt-1 min-h-24 w-full rounded-md border px-3 py-2 text-sm" value={effectiveExclusionsText} onChange={(event) => setExclusionsText(event.target.value)} /></label>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">Current version: {scopeQuery.data?.scope?.id ?? 'not configured'}</p>
                <Button disabled={scopeMutation.isPending || !effectiveNarrative.trim() || !effectiveServiceFamily.trim()} onClick={() => {
                  const existing = scopeQuery.data?.scope;
                  const scope = { ...(existing ?? {}), contractId: contract.id, effectiveFrom: existing?.effectiveFrom ?? contract.startDate, effectiveTo: existing?.effectiveTo ?? contract.endDate, status: 'active', completeness: 'complete', provenance: 'owner-entered', scopeNarrative: effectiveNarrative, serviceFamily: effectiveServiceFamily, eligibleCategories: [contract.category], geographies: existing?.geographies ?? [], businessUnits: existing?.businessUnits ?? [], callOffRequirements: existing?.callOffRequirements ?? [] };
                  const deliverables = effectiveDeliverablesText.split('\n').map((name, index) => ({ id: `${existing?.id ?? contract.id}-D${index + 1}`, scopeVersionId: existing?.id ?? '', name: name.trim(), aliases: [], required: true })).filter((item) => item.name);
                  const exclusions = effectiveExclusionsText.split('\n').map((term, index) => ({ id: `${existing?.id ?? contract.id}-X${index + 1}`, scopeVersionId: existing?.id ?? '', term: term.trim() })).filter((item) => item.term);
                  scopeMutation.mutate({ scope, deliverables, exclusions });
                }}>{scopeMutation.isPending ? 'Saving…' : 'Save coverage'}</Button>
              </div>
              {scopeMutation.isError && <p className="text-sm text-red-700">{scopeMutation.error.message}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Preview a match</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <textarea className="min-h-20 w-full rounded-md border px-3 py-2 text-sm" value={previewText} onChange={(event) => setPreviewText(event.target.value)} placeholder="Example demand text" />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">The requester-facing pre-check uses the same server matcher. Save coverage before testing a preview.</p>
                <Button variant="outline" size="sm" disabled={previewPending || !previewText.trim()} onClick={() => {
                  setPreviewPending(true);
                  void requestContractMatch({ text: previewText, category: contract.category, supplierId: contract.supplierId, estimatedValue: 1 }).then(setMatchPreview).catch(() => setMatchPreview(null)).finally(() => setPreviewPending(false));
                }}>{previewPending ? 'Checking…' : 'Preview match'}</Button>
              </div>
              {matchPreview && <div className="rounded-md border bg-muted/30 p-3 text-sm"><p className="font-medium">{matchPreview.route === 'contract' ? 'Matched contract' : matchPreview.route === 'clarify' ? 'More information needed' : 'No confident match'}</p>{matchPreview.questions[0] && <p className="mt-1 text-xs text-muted-foreground">{matchPreview.questions[0]}</p>}{matchPreview.candidates.length > 0 && <ul className="mt-2 space-y-1 text-xs">{matchPreview.candidates.slice(0, 3).map((candidate) => <li key={candidate.scopeVersionId}>{candidate.contractId}: {(candidate.score * 100).toFixed(0)}% — {candidate.reasons.join('; ')}</li>)}</ul>}</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Contracted Value</p>
                <p className="mt-1 text-xl font-semibold">{formatCurrency(contract.value)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Actual Spend</p>
                <p className="mt-1 text-xl font-semibold">{formatCurrency(actualSpend)}</p>
                <p className="text-xs text-muted-foreground">{contract.utilisationPercentage}% utilised</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Committed</p>
                <p className="mt-1 text-xl font-semibold">{formatCurrency(committedSpend)}</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Value Comparison</CardTitle></CardHeader>
            <CardContent>
              <BarChartWidget
                data={financialData.map((d) => ({ name: d.name, value: d.value }))}
                dataKeys={[{ key: 'value', color: '#2D5F8A', label: 'Amount' }]}
                height={250}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="obligations" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Contract Obligations</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {obligations.map((ob) => (
                <div key={ob.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <Checkbox
                    checked={ob.completed}
                    onCheckedChange={() => toggleObligation(ob.id)}
                  />
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${ob.completed ? 'line-through text-muted-foreground' : ''}`}>
                      {ob.title}
                    </p>
                    <p className="text-xs text-muted-foreground">Due: {formatDate(ob.dueDate)}</p>
                  </div>
                  {/* Overdue is derived at render time from the due date, not stored. */}
                  <StatusBadge
                    status={ob.completed ? 'completed' : new Date(ob.dueDate) < new Date() ? 'overdue' : 'pending'}
                    size="sm"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="renewal" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Renewal Management</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Contract End Date</span><span className="font-medium">{formatDate(contract.endDate)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Renewal Date</span><span className="font-medium">{contract.renewalDate ? formatDate(contract.renewalDate) : 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Current Status</span><span><StatusBadge status={contract.status} size="sm" /></span></div>
                </div>
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">Renewal Timeline</p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="size-2 rounded-full bg-green-500" />
                      <span>90 days before - Start renewal assessment</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="size-2 rounded-full bg-amber-500" />
                      <span>60 days before - Negotiate terms</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="size-2 rounded-full bg-red-500" />
                      <span>30 days before - Final approval</span>
                    </div>
                  </div>
                </div>
              </div>
              <Button>
                <RefreshCw className="size-3.5" />
                Initiate Renewal
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Contract Documents</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {mockDocuments.map((doc) => (
                  <div key={doc.name} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <FileText className="size-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{doc.size} | Uploaded {formatDate(doc.uploaded)}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">View</Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="related" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="size-4" />
                Linked Purchase Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              {linkedPOs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No linked purchase orders.</p>
              ) : (
                <div className="space-y-2">
                  {linkedPOs.map((po) => (
                    <div
                      key={po.id}
                      className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-gray-50"
                      onClick={() => navigate(`/purchasing/orders/${po.id}`)}
                    >
                      <div>
                        <p className="text-sm font-medium">{po.id}</p>
                        <p className="text-xs text-muted-foreground">{po.supplierName}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm">{formatCurrency(po.value)}</span>
                        <StatusBadge status={po.status} size="sm" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="size-4" />
                Linked Invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              {linkedInvoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No linked invoices.</p>
              ) : (
                <div className="space-y-2">
                  {linkedInvoices.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">{inv.id}</p>
                        <p className="text-xs text-muted-foreground">{inv.supplierName}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm">{formatCurrency(inv.amount)}</span>
                        <StatusBadge status={inv.status} size="sm" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
