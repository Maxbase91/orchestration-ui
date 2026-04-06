import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

interface ChannelSetting {
  label: string;
  inApp: boolean;
  email: boolean;
  push: boolean;
}

export function NotificationPreferences() {
  const [channels, setChannels] = useState<ChannelSetting[]>([
    { label: 'Approval Requests', inApp: true, email: true, push: true },
    { label: 'Status Updates', inApp: true, email: true, push: false },
    { label: 'SLA Warnings', inApp: true, email: true, push: true },
    { label: 'Escalations', inApp: true, email: true, push: true },
    { label: 'Comments', inApp: true, email: false, push: false },
    { label: 'System Alerts', inApp: true, email: true, push: false },
    { label: 'AI Insights', inApp: true, email: false, push: false },
  ]);

  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('07:00');
  const [dailyDigest, setDailyDigest] = useState(true);

  function toggleChannel(index: number, channel: 'inApp' | 'email' | 'push') {
    setChannels((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [channel]: !item[channel] } : item))
    );
  }

  return (
    <div className="space-y-6">
      {/* Per-event-type settings */}
      <Card className="p-4">
        <h3 className="mb-4 text-sm font-medium">Notification Channels</h3>
        <div className="space-y-0">
          {/* Header */}
          <div className="grid grid-cols-4 gap-4 border-b pb-2 text-xs font-medium text-muted-foreground">
            <div>Event Type</div>
            <div className="text-center">In-app</div>
            <div className="text-center">Email</div>
            <div className="text-center">Mobile Push</div>
          </div>

          {channels.map((setting, index) => (
            <div
              key={setting.label}
              className="grid grid-cols-4 items-center gap-4 border-b py-3 last:border-0"
            >
              <Label className="text-sm">{setting.label}</Label>
              <div className="flex justify-center">
                <Switch
                  checked={setting.inApp}
                  onCheckedChange={() => toggleChannel(index, 'inApp')}
                  size="sm"
                />
              </div>
              <div className="flex justify-center">
                <Switch
                  checked={setting.email}
                  onCheckedChange={() => toggleChannel(index, 'email')}
                  size="sm"
                />
              </div>
              <div className="flex justify-center">
                <Switch
                  checked={setting.push}
                  onCheckedChange={() => toggleChannel(index, 'push')}
                  size="sm"
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Quiet hours */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Quiet Hours</h3>
            <p className="text-xs text-muted-foreground">
              Suppress push notifications during these hours
            </p>
          </div>
          <Switch checked={quietHoursEnabled} onCheckedChange={setQuietHoursEnabled} />
        </div>

        {quietHoursEnabled && (
          <div className="mt-4 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs">From</Label>
              <Input
                type="time"
                value={quietStart}
                onChange={(e) => setQuietStart(e.target.value)}
                className="h-8 w-28 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">To</Label>
              <Input
                type="time"
                value={quietEnd}
                onChange={(e) => setQuietEnd(e.target.value)}
                className="h-8 w-28 text-sm"
              />
            </div>
          </div>
        )}
      </Card>

      {/* Daily digest */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Daily Digest</h3>
            <p className="text-xs text-muted-foreground">
              Receive a daily email summary of all notifications at 08:00
            </p>
          </div>
          <Switch checked={dailyDigest} onCheckedChange={setDailyDigest} />
        </div>
      </Card>
    </div>
  );
}
