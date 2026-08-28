import { useState, useRef } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';
import { useUserPreferences, useUpdateUserPreferences } from '@/lib/db/hooks/use-user-preferences';

interface ChannelSetting {
  label: string;
  inApp: boolean;
  email: boolean;
  push: boolean;
}

interface NotifPrefs {
  channels: ChannelSetting[];
  quietHoursEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  dailyDigest: boolean;
}

const DEFAULT_PREFS: NotifPrefs = {
  channels: [
    { label: 'Approval Requests', inApp: true, email: true, push: true },
    { label: 'Status Updates', inApp: true, email: true, push: false },
    { label: 'SLA Warnings', inApp: true, email: true, push: true },
    { label: 'Escalations', inApp: true, email: true, push: true },
    { label: 'Comments', inApp: true, email: false, push: false },
    { label: 'System Alerts', inApp: true, email: true, push: false },
    { label: 'AI Insights', inApp: true, email: false, push: false },
  ],
  quietHoursEnabled: false,
  quietStart: '22:00',
  quietEnd: '07:00',
  dailyDigest: true,
};

export function NotificationPreferences() {
  const { currentUser } = useAuthStore();
  const { data: remotePrefs } = useUserPreferences(currentUser.id);
  const updatePrefs = useUpdateUserPreferences(currentUser.id);

  // Local edits, `null` until the user changes something. What is displayed is
  // the remote preferences over the defaults; from the first edit onwards the
  // local copy owns it.
  //
  // This replaces a hydrate-once effect guarded by a `hydrated` ref. The guard
  // existed to stop the debounced save firing on hydration — with edits the
  // only thing that writes local state, every save is now a deliberate user
  // action and there is nothing to guard against.
  const [editedPrefs, setEditedPrefs] = useState<NotifPrefs | null>(null);
  const prefs: NotifPrefs = editedPrefs ?? {
    ...DEFAULT_PREFS,
    ...((remotePrefs?.notifications as Partial<NotifPrefs> | undefined) ?? {}),
  };

  // Persist whenever prefs change
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleRemoteSave(updated: NotifPrefs) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updatePrefs.mutate({ notifications: updated as unknown as Record<string, unknown> });
    }, 600);
  }

  function update(patch: Partial<NotifPrefs>) {
    // `prefs` is what is on screen — the remote values until the first edit,
    // the local copy after it — so an edit always builds on what was shown.
    const next = { ...prefs, ...patch };
    setEditedPrefs(next);
    scheduleRemoteSave(next);
  }

  function toggleChannel(index: number, channel: 'inApp' | 'email' | 'push') {
    const updatedChannels = prefs.channels.map((item, i) =>
      i === index ? { ...item, [channel]: !item[channel] } : item,
    );
    update({ channels: updatedChannels });
  }

  return (
    <div className="space-y-6">
      {/* Per-event-type settings */}
      <Card className="p-4">
        <h3 className="mb-4 text-sm font-medium">Notification Channels</h3>
        <div className="space-y-0">
          <div className="grid grid-cols-4 gap-4 border-b pb-2 text-xs font-medium text-muted-foreground">
            <div>Event Type</div>
            <div className="text-center">In-app</div>
            <div className="text-center">Email</div>
            <div className="text-center">Mobile Push</div>
          </div>

          {prefs.channels.map((setting, index) => (
            <div
              key={setting.label}
              className="grid grid-cols-4 items-center gap-4 border-b py-3 last:border-0"
            >
              <Label className="text-sm">{setting.label}</Label>
              <div className="flex justify-center">
                <Switch checked={setting.inApp} onCheckedChange={() => toggleChannel(index, 'inApp')} size="sm" />
              </div>
              <div className="flex justify-center">
                <Switch checked={setting.email} onCheckedChange={() => toggleChannel(index, 'email')} size="sm" />
              </div>
              <div className="flex justify-center">
                <Switch checked={setting.push} onCheckedChange={() => toggleChannel(index, 'push')} size="sm" />
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
            <p className="text-xs text-muted-foreground">Suppress push notifications during these hours</p>
          </div>
          <Switch
            checked={prefs.quietHoursEnabled}
            onCheckedChange={(v) => update({ quietHoursEnabled: v })}
          />
        </div>

        {prefs.quietHoursEnabled && (
          <div className="mt-4 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs">From</Label>
              <Input
                type="time"
                value={prefs.quietStart}
                onChange={(e) => update({ quietStart: e.target.value })}
                className="h-8 w-28 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">To</Label>
              <Input
                type="time"
                value={prefs.quietEnd}
                onChange={(e) => update({ quietEnd: e.target.value })}
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
          <Switch
            checked={prefs.dailyDigest}
            onCheckedChange={(v) => update({ dailyDigest: v })}
          />
        </div>
      </Card>
    </div>
  );
}
