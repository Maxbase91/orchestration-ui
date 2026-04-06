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
import { getContractById } from '@/data/contracts';
import { purchaseOrders } from '@/data/purchase-orders';
import { invoices } from '@/data/invoices';
import { formatCurrency, formatDate } from '@/lib/format';

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
  const contract = id ? getContractById(id) : undefined;
  const [obligations, setObligations] = useState(mockObligations);

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

  const actualSpend = Math.round(contract.value * contract.utilisationPercentage / 100);
  const committedSpend = Math.round(contract.value * 0.85);

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
