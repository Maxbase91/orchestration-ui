import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, FileEdit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatDate, formatCurrency } from '@/lib/format';
import { QABoard } from './components/qa-board';

interface SourcingEventDetail {
  id: string;
  title: string;
  category: string;
  type: string;
  status: string;
  deadline: string;
  publishDate: string;
  evaluationDate: string;
  awardDate: string;
  budget: number;
  owner: string;
  description: string;
  supplierResponses: {
    name: string;
    status: 'viewed' | 'responded' | 'not-viewed';
    responseDate?: string;
  }[];
}

const mockEvents: Record<string, SourcingEventDetail> = {
  'SRC-001': {
    id: 'SRC-001',
    title: 'IT Consulting Framework 2025-2027',
    category: 'IT Consulting',
    type: 'RFP',
    status: 'in-evaluation',
    deadline: '2025-03-15',
    publishDate: '2025-02-01',
    evaluationDate: '2025-03-20',
    awardDate: '2025-04-01',
    budget: 2500000,
    owner: 'Marcus Johnson',
    description: 'Multi-year framework agreement for IT consulting services across strategy, implementation, and managed services.',
    supplierResponses: [
      { name: 'Accenture', status: 'responded', responseDate: '2025-03-10' },
      { name: 'Deloitte', status: 'responded', responseDate: '2025-03-12' },
      { name: 'Capgemini', status: 'responded', responseDate: '2025-03-14' },
      { name: 'KPMG', status: 'viewed' },
      { name: 'McKinsey & Company', status: 'viewed' },
      { name: 'TechBridge Solutions', status: 'not-viewed' },
    ],
  },
  'SRC-002': {
    id: 'SRC-002',
    title: 'Cloud Infrastructure Services',
    category: 'Cloud Services',
    type: 'RFQ',
    status: 'published',
    deadline: '2025-04-01',
    publishDate: '2025-03-01',
    evaluationDate: '2025-04-10',
    awardDate: '2025-04-20',
    budget: 800000,
    owner: 'Sarah Chen',
    description: 'Cloud infrastructure hosting and managed services for production workloads.',
    supplierResponses: [
      { name: 'Amazon Web Services (AWS)', status: 'viewed' },
      { name: 'Microsoft', status: 'viewed' },
      { name: 'Salesforce', status: 'not-viewed' },
      { name: 'Databricks', status: 'not-viewed' },
    ],
  },
  'SRC-003': {
    id: 'SRC-003',
    title: 'Office Furniture Renewal',
    category: 'Facilities',
    type: 'RFQ',
    status: 'award-pending',
    deadline: '2025-02-28',
    publishDate: '2025-01-15',
    evaluationDate: '2025-03-05',
    awardDate: '2025-03-15',
    budget: 200000,
    owner: 'Anna Muller',
    description: 'Replacement of office furniture across 3 locations.',
    supplierResponses: [
      { name: 'Iron Mountain', status: 'responded', responseDate: '2025-02-20' },
      { name: 'Cushman & Wakefield', status: 'responded', responseDate: '2025-02-25' },
      { name: 'Sodexo', status: 'responded', responseDate: '2025-02-27' },
    ],
  },
};

const supplierStatusColors: Record<string, string> = {
  responded: 'bg-green-100 text-green-700',
  viewed: 'bg-amber-100 text-amber-700',
  'not-viewed': 'bg-gray-100 text-gray-700',
};

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const event = id ? mockEvents[id] : undefined;

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-sm text-muted-foreground">Sourcing event not found.</p>
        <Button variant="outline" onClick={() => navigate('/sourcing')}>
          <ArrowLeft className="size-4" />
          Back to Events
        </Button>
      </div>
    );
  }

  const responseRate = event.supplierResponses.filter((s) => s.status === 'responded').length;

  return (
    <div className="space-y-5">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => navigate('/sourcing')}
      >
        <ArrowLeft className="size-3.5" />
        Back to Events
      </Button>

      <PageHeader
        title={event.title}
        subtitle={event.description}
        badge={
          <div className="flex items-center gap-2">
            <StatusBadge status={event.status} />
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
              {event.type}
            </span>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <FileEdit className="size-3.5" />
              Publish Amendment
            </Button>
            <Button size="sm">
              <Send className="size-3.5" />
              Send Reminder
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="suppliers">Supplier Tracking</TabsTrigger>
          <TabsTrigger value="qa">Q&A Board</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Key Dates</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Published</span><span>{formatDate(event.publishDate)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Deadline</span><span className="font-medium">{formatDate(event.deadline)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Evaluation</span><span>{formatDate(event.evaluationDate)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Award</span><span>{formatDate(event.awardDate)}</span></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Supplier Responses</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Invited</span><span className="font-medium">{event.supplierResponses.length}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Responded</span><span className="font-medium text-green-700">{responseRate}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Response Rate</span><span className="font-medium">{Math.round((responseRate / event.supplierResponses.length) * 100)}%</span></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Budget & Details</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Budget</span><span className="font-medium">{formatCurrency(event.budget)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span>{event.category}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Owner</span><span>{event.owner}</span></div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="suppliers" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Supplier Tracking</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left font-medium text-muted-foreground">Supplier</th>
                    <th className="py-2 text-left font-medium text-muted-foreground">Status</th>
                    <th className="py-2 text-left font-medium text-muted-foreground">Response Date</th>
                  </tr>
                </thead>
                <tbody>
                  {event.supplierResponses.map((s) => (
                    <tr key={s.name} className="border-b last:border-0">
                      <td className="py-2 font-medium">{s.name}</td>
                      <td className="py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${supplierStatusColors[s.status]}`}>
                          {s.status === 'not-viewed' ? 'Not Viewed' : s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                        </span>
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {s.responseDate ? formatDate(s.responseDate) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qa" className="mt-4">
          <QABoard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
