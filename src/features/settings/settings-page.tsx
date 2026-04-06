import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth-store';
import { NotificationPreferences } from '@/features/notifications/components/notification-preferences';

const savedViews = [
  { id: '1', name: 'My Overdue Items', filter: 'status=overdue, owner=me', createdAt: '2024-12-15' },
  { id: '2', name: 'High Value Requests', filter: 'value>500000', createdAt: '2024-11-20' },
  { id: '3', name: 'IT Consulting Pipeline', filter: 'category=consulting, dept=IT', createdAt: '2024-10-05' },
  { id: '4', name: 'Expiring Contracts', filter: 'status=expiring', createdAt: '2024-12-28' },
];

export function SettingsPage() {
  const { currentUser } = useAuthStore();
  const [dateFormat, setDateFormat] = useState('dd/MM/yyyy');
  const [currency, setCurrency] = useState('EUR');
  const [darkMode] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" />

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="display">Display</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="saved-views">Saved Views</TabsTrigger>
        </TabsList>

        {/* Profile */}
        <TabsContent value="profile">
          <Card className="max-w-lg p-6">
            <h3 className="mb-4 text-sm font-medium">User Profile</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex size-14 items-center justify-center rounded-full bg-gray-100 text-lg font-semibold text-gray-600">
                  {currentUser.initials}
                </div>
                <div>
                  <p className="font-medium">{currentUser.name}</p>
                  <p className="text-sm text-muted-foreground">{currentUser.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Department</Label>
                  <p className="text-sm">{currentUser.department}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Role</Label>
                  <p className="text-sm">{currentUser.role}</p>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Display */}
        <TabsContent value="display">
          <Card className="max-w-lg p-6">
            <h3 className="mb-4 text-sm font-medium">Display Preferences</h3>
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Dark Mode</Label>
                  <p className="text-xs text-muted-foreground">Switch to dark theme</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={darkMode} disabled />
                  <Badge variant="secondary" className="text-[10px]">
                    Coming soon
                  </Badge>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm">Language</Label>
                <Select defaultValue="en" disabled>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm">Date Format</Label>
                <Select value={dateFormat} onValueChange={setDateFormat}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dd/MM/yyyy">DD/MM/YYYY</SelectItem>
                    <SelectItem value="MM/dd/yyyy">MM/DD/YYYY</SelectItem>
                    <SelectItem value="yyyy-MM-dd">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <div className="max-w-2xl">
            <NotificationPreferences />
          </div>
        </TabsContent>

        {/* Saved Views */}
        <TabsContent value="saved-views">
          <Card className="max-w-lg p-6">
            <h3 className="mb-4 text-sm font-medium">Saved Views</h3>
            <div className="space-y-3">
              {savedViews.map((view) => (
                <div
                  key={view.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{view.name}</p>
                    <p className="text-xs text-muted-foreground">{view.filter}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-600">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
