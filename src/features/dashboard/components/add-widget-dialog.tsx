import { useState } from 'react';
import {
  FileText, TrendingUp, Search, Clock, ShieldCheck, BarChart3, Users,
  AlertTriangle, Sparkles, ClipboardCheck, Activity, Bell, Timer, Monitor,
  FileWarning, ShieldAlert, BarChart, MessageSquare, Plus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth-store';
import { useDashboardStore } from '@/stores/dashboard-store';
import { widgetRegistry } from '../widget-registry';

const iconMap: Record<string, LucideIcon> = {
  FileText, TrendingUp, Search, Clock, ShieldCheck, BarChart3, Users,
  AlertTriangle, Sparkles, ClipboardCheck, Activity, Bell, Timer, Monitor,
  FileWarning, ShieldAlert, BarChart, MessageSquare,
};

const sizeLabels: Record<string, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  full: 'Full width',
};

interface AddWidgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddWidgetDialog({ open, onOpenChange }: AddWidgetDialogProps) {
  const [search, setSearch] = useState('');
  const currentRole = useAuthStore((s) => s.currentRole);
  const { getLayout, addWidget } = useDashboardStore();

  const layout = getLayout(currentRole);
  const available = widgetRegistry.filter((w) => w.availableTo.includes(currentRole));
  const filtered = search
    ? available.filter((w) => w.title.toLowerCase().includes(search.toLowerCase()) || w.description.toLowerCase().includes(search.toLowerCase()))
    : available;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Widget</DialogTitle>
        </DialogHeader>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search widgets..."
          className="mb-4"
        />
        <div className="grid grid-cols-3 gap-3">
          {filtered.map((widget) => {
            const Icon = iconMap[widget.icon] ?? FileText;
            const isAdded = layout.includes(widget.id);
            return (
              <div
                key={widget.id}
                className={`border rounded-md p-3 flex flex-col gap-2 ${isAdded ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">{widget.title}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{widget.description}</p>
                <div className="flex items-center justify-between mt-auto">
                  <Badge variant="secondary" className="text-[10px]">{sizeLabels[widget.size]}</Badge>
                  {isAdded ? (
                    <Badge variant="outline" className="text-[10px]">Added</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs"
                      onClick={() => addWidget(currentRole, widget.id)}
                    >
                      <Plus className="size-3 mr-1" />
                      Add
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
