import { Link } from 'react-router-dom';
import {
  Plus,
  Search,
  Sparkles,
  UserCog,
  ArrowUpCircle,
  Send,
  CheckCircle,
  BarChart3,
  Building2,
  FileText,
  Settings,
  Shield,
  Workflow,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Role } from '@/config/roles';

interface QuickAction {
  label: string;
  icon: React.ElementType;
  to?: string;
  onClick?: () => void;
  variant?: 'default' | 'outline' | 'ghost';
}

interface QuickActionsProps {
  actions: QuickAction[];
}

export function QuickActions({ actions }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => {
        const Icon = action.icon;
        if (action.to) {
          return (
            <Button key={action.label} variant={action.variant ?? 'outline'} size="sm" asChild>
              <Link to={action.to}>
                <Icon className="size-4" />
                {action.label}
              </Link>
            </Button>
          );
        }
        return (
          <Button
            key={action.label}
            variant={action.variant ?? 'outline'}
            size="sm"
            onClick={action.onClick}
          >
            <Icon className="size-4" />
            {action.label}
          </Button>
        );
      })}
    </div>
  );
}

export const serviceOwnerActions: QuickAction[] = [
  { label: 'New Request', icon: Plus, to: '/requests/new', variant: 'default' },
  { label: 'Track a Request', icon: Search, to: '/requests' },
  { label: 'My Approvals', icon: CheckCircle, to: '/approvals' },
  { label: 'Ask AI Assistant', icon: Sparkles },
];

export const procurementManagerActions: QuickAction[] = [
  { label: 'New Request', icon: Plus, to: '/requests/new', variant: 'default' },
  { label: 'All Requests', icon: FileText, to: '/requests' },
  { label: 'Active Workflows', icon: Workflow, to: '/workflows' },
  { label: 'Supplier Directory', icon: Building2, to: '/suppliers' },
  { label: 'Spend Overview', icon: BarChart3, to: '/analytics/spend' },
  { label: 'Bottlenecks', icon: AlertTriangle, to: '/workflows/bottlenecks' },
];

export const vendorManagerActions: QuickAction[] = [
  { label: 'All Requests', icon: FileText, to: '/requests' },
  { label: 'Risk & Compliance', icon: Shield, to: '/suppliers/risk' },
  { label: 'Supplier Directory', icon: Building2, to: '/suppliers' },
  { label: 'Messages', icon: MessageSquare, to: '/suppliers/messages' },
  { label: 'My Approvals', icon: CheckCircle, to: '/approvals' },
];

export const opsLeadActions: QuickAction[] = [
  { label: 'Active Workflows', icon: Workflow, to: '/workflows' },
  { label: 'Bottlenecks', icon: AlertTriangle, to: '/workflows/bottlenecks' },
  { label: 'Reassign', icon: UserCog },
  { label: 'Escalate', icon: ArrowUpCircle },
  { label: 'Send Reminder', icon: Send },
  { label: 'All Requests', icon: FileText, to: '/requests' },
];

export const adminActions: QuickAction[] = [
  { label: 'Routing Rules', icon: Settings, to: '/admin/rules' },
  { label: 'Workflow Designer', icon: Workflow, to: '/admin/workflows' },
  { label: 'User Management', icon: UserCog, to: '/admin/users' },
  { label: 'System Health', icon: Shield, to: '/admin/health' },
  { label: 'Audit Log', icon: Search, to: '/admin/audit' },
];

export function getActionsForRole(role: Role): QuickAction[] {
  switch (role) {
    case 'service-owner':
      return serviceOwnerActions;
    case 'procurement-manager':
      return procurementManagerActions;
    case 'vendor-manager':
      return vendorManagerActions;
    case 'operations-lead':
      return opsLeadActions;
    case 'admin':
      return adminActions;
    default:
      return serviceOwnerActions;
  }
}
