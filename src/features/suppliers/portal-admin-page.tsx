import { useState } from 'react';
import { KeyRound, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { BarChartWidget } from '@/components/charts/bar-chart-widget';

interface PortalAccount {
  name: string;
  email: string;
  lastLogin: string;
  status: string;
  [key: string]: unknown;
}

const portalAccounts: PortalAccount[] = [
  { name: 'Patrick Sullivan', email: 'p.sullivan@accenture.com', lastLogin: '2026-04-05', status: 'Active' },
  { name: 'Markus Hofmann', email: 'm.hofmann@sap.com', lastLogin: '2026-04-04', status: 'Active' },
  { name: 'Emma Richardson', email: 'e.richardson@deloitte.co.uk', lastLogin: '2026-04-03', status: 'Active' },
  { name: 'Jan van der Berg', email: 'j.vanderberg@kpmg.nl', lastLogin: '2026-03-28', status: 'Active' },
  { name: 'Marie Leblanc', email: 'm.leblanc@capgemini.com', lastLogin: '2026-04-01', status: 'Active' },
  { name: 'Jennifer Walsh', email: 'j.walsh@amazon.com', lastLogin: '2026-04-05', status: 'Active' },
  { name: 'David Martinez', email: 'd.martinez@microsoft.com', lastLogin: '2026-04-04', status: 'Active' },
  { name: 'Stefan Krause', email: 's.krause@siemens.com', lastLogin: '2026-03-20', status: 'Inactive' },
  { name: 'Sophie de Vries', email: 's.devries@randstad.com', lastLogin: '2026-04-02', status: 'Active' },
  { name: 'Sarah Kim', email: 's.kim@databricks.com', lastLogin: '2026-04-05', status: 'Active' },
];

const onboardingQueue = [
  { name: 'Databricks', contact: 'Sarah Kim', progress: 65 },
  { name: 'TechBridge Solutions', contact: 'Priya Sharma', progress: 30 },
  { name: 'GreenEnergy GmbH', contact: 'Dr. Anke Zimmermann', progress: 10 },
  { name: 'Cushman & Wakefield (Portal)', contact: 'Andrew Thompson', progress: 85 },
  { name: 'WPP plc (Portal)', contact: 'Charlotte Evans', progress: 50 },
];

const loginsByDay = [
  { name: 'Mon', value: 24 },
  { name: 'Tue', value: 31 },
  { name: 'Wed', value: 18 },
  { name: 'Thu', value: 27 },
  { name: 'Fri', value: 22 },
  { name: 'Sat', value: 8 },
  { name: 'Sun', value: 12 },
];

const accountColumns: Column<PortalAccount>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email' },
  { key: 'lastLogin', label: 'Last Login', sortable: true },
  {
    key: 'status',
    label: 'Status',
    render: (item) => (
      <span
        className={
          item.status === 'Active'
            ? 'inline-flex items-center gap-1.5 text-xs font-medium text-green-700'
            : 'inline-flex items-center gap-1.5 text-xs font-medium text-gray-500'
        }
      >
        <span
          className={`size-1.5 rounded-full ${item.status === 'Active' ? 'bg-green-500' : 'bg-gray-400'}`}
        />
        {item.status as string}
      </span>
    ),
  },
  {
    key: 'actions',
    label: 'Actions',
    render: () => (
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            toast.success('Password reset email sent');
          }}
        >
          <KeyRound className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            toast.success('Account deactivated');
          }}
        >
          <UserX className="size-3.5 text-red-500" />
        </Button>
      </div>
    ),
  },
];

export function PortalAdminPage() {
  const [companyName, setCompanyName] = useState('Procurement Platform');
  const [primaryColor, setPrimaryColor] = useState('#3B82F6');
  const [welcomeMessage, setWelcomeMessage] = useState(
    'Welcome to the Procurement Platform Supplier Portal. Please complete your profile and upload required documents.'
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Portal Admin"
        subtitle="Manage supplier portal access and settings"
      />

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding Queue</TabsTrigger>
          <TabsTrigger value="usage">Usage Stats</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-4">
          <Card className="p-4">
            <DataTable
              columns={accountColumns}
              data={portalAccounts}
              searchable
              searchPlaceholder="Search accounts..."
            />
          </Card>
        </TabsContent>

        <TabsContent value="onboarding" className="mt-4 space-y-3">
          {onboardingQueue.map((item) => (
            <Card key={item.name} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Contact: {item.contact}
                  </p>
                </div>
                <span className="text-sm font-medium">{item.progress}%</span>
              </div>
              <Progress value={item.progress} className="h-2" />
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="usage" className="mt-4 space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Active Users', value: '18' },
              { label: 'Logins This Month', value: '142' },
              { label: 'Documents Uploaded', value: '34' },
              { label: 'Messages Sent', value: '67' },
            ].map((kpi) => (
              <Card key={kpi.label} className="p-4 text-center">
                <p className="text-2xl font-semibold">{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </Card>
            ))}
          </div>
          <Card className="p-4">
            <h3 className="mb-4 text-sm font-medium">Logins by Day</h3>
            <BarChartWidget
              data={loginsByDay}
              dataKeys={[{ key: 'value', color: '#3B82F6', label: 'Logins' }]}
              height={250}
            />
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card className="max-w-lg p-6 space-y-4">
            <h3 className="font-medium">Portal Branding</h3>
            <div className="space-y-1.5">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Logo</Label>
              <div className="flex h-24 items-center justify-center rounded-lg border-2 border-dashed text-sm text-muted-foreground">
                Drag and drop logo here or click to upload
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="primaryColor">Primary Color</Label>
              <Input
                id="primaryColor"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#3B82F6"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="welcomeMsg">Welcome Message</Label>
              <Textarea
                id="welcomeMsg"
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                rows={3}
              />
            </div>
            <Button onClick={() => toast.success('Settings saved')}>
              Save Settings
            </Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
