import {
  Plus, Search, CheckCircle, Sparkles, FileText, AlertTriangle, Building2,
  BarChart3, Shield, MessageSquare, ShoppingBag, ListTodo, FileSignature,
  Receipt, Route, PenTool, UserCog,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuthStore } from '@/stores/auth-store';
import { useDashboardStore } from '@/stores/dashboard-store';
import { allQuickActions } from '../widget-registry';

const iconMap: Record<string, LucideIcon> = {
  Plus, Search, CheckCircle, Sparkles, FileText, AlertTriangle, Building2,
  BarChart3, Shield, MessageSquare, ShoppingBag, ListTodo, FileSignature,
  Receipt, Route, PenTool, UserCog,
  Workflow: BarChart3,
};

interface QuickActionsEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickActionsEditor({ open, onOpenChange }: QuickActionsEditorProps) {
  const currentRole = useAuthStore((s) => s.currentRole);
  const { getQuickActions, setQuickActions } = useDashboardStore();

  const selected = getQuickActions(currentRole);
  const available = allQuickActions.filter((a) => a.availableTo.includes(currentRole));

  const toggleAction = (id: string) => {
    if (selected.includes(id)) {
      setQuickActions(currentRole, selected.filter((a) => a !== id));
    } else {
      setQuickActions(currentRole, [...selected, id]);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Customise Quick Actions</SheetTitle>
        </SheetHeader>
        <div className="space-y-1 mt-4">
          {available.map((action) => {
            const Icon = iconMap[action.icon] ?? Plus;
            const checked = selected.includes(action.id);
            return (
              <label
                key={action.id}
                className="flex items-center gap-3 px-2 py-2 rounded hover:bg-muted/50 cursor-pointer"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleAction(action.id)}
                />
                <Icon className="size-4 text-muted-foreground shrink-0" />
                <span className="text-sm">{action.label}</span>
              </label>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
