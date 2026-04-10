import type { Role } from '@/config/roles';

const allRoles: Role[] = ['service-owner', 'procurement-manager', 'vendor-manager', 'operations-lead', 'supplier', 'admin'];
const allInternal: Role[] = ['service-owner', 'procurement-manager', 'vendor-manager', 'operations-lead', 'admin'];
const coreInternal: Role[] = ['procurement-manager', 'operations-lead', 'admin'];

export interface WidgetConfig {
  id: string;
  title: string;
  description: string;
  icon: string;
  size: 'small' | 'medium' | 'large' | 'full';
  availableTo: Role[];
}

export const widgetRegistry: WidgetConfig[] = [
  { id: 'my-requests', title: 'My Active Requests', description: 'Your open procurement requests with status tracking', icon: 'FileText', size: 'large', availableTo: allInternal },
  { id: 'kpi-open-demand', title: 'Open Demand', description: 'Count and value of open demand items', icon: 'TrendingUp', size: 'small', availableTo: coreInternal },
  { id: 'kpi-sourcing', title: 'Active Sourcing', description: 'Number of active sourcing events', icon: 'Search', size: 'small', availableTo: coreInternal },
  { id: 'kpi-cycle-time', title: 'Avg Cycle Time', description: 'Average request processing duration', icon: 'Clock', size: 'small', availableTo: coreInternal },
  { id: 'kpi-compliance', title: 'Compliance Rate', description: 'Policy compliance percentage', icon: 'ShieldCheck', size: 'small', availableTo: coreInternal },
  { id: 'demand-pipeline', title: 'Demand Pipeline', description: 'Requests by workflow stage', icon: 'BarChart3', size: 'medium', availableTo: coreInternal },
  { id: 'team-workload', title: 'Team Workload', description: 'Request distribution per team member', icon: 'Users', size: 'medium', availableTo: ['procurement-manager', 'operations-lead'] },
  { id: 'attention-required', title: 'Attention Required', description: 'Overdue and referred-back items needing action', icon: 'AlertTriangle', size: 'medium', availableTo: allInternal },
  { id: 'ai-insights', title: 'AI Insights', description: 'AI-generated strategic procurement insights', icon: 'Sparkles', size: 'small', availableTo: allInternal },
  { id: 'validation-queue', title: 'Validation Queue', description: 'Requests awaiting validation review', icon: 'ClipboardCheck', size: 'large', availableTo: ['vendor-manager', 'procurement-manager'] },
  { id: 'workflow-health', title: 'Workflow Health', description: 'Active workflows, stuck count, avg processing days', icon: 'Activity', size: 'full', availableTo: ['operations-lead', 'procurement-manager', 'admin'] },
  { id: 'recent-activity', title: 'Recent Activity', description: 'Latest platform events and updates', icon: 'Bell', size: 'small', availableTo: allInternal },
  { id: 'sla-tracker', title: 'SLA Tracker', description: 'Requests approaching or past SLA deadlines', icon: 'Timer', size: 'small', availableTo: ['operations-lead', 'procurement-manager'] },
  { id: 'system-health', title: 'System Health', description: 'Platform health and integration status', icon: 'Monitor', size: 'medium', availableTo: ['admin'] },
  { id: 'expiring-contracts', title: 'Expiring Contracts', description: 'Contracts expiring within 90 days', icon: 'FileWarning', size: 'small', availableTo: allInternal },
  { id: 'supplier-risk', title: 'Supplier Risk Alerts', description: 'Suppliers with elevated risk ratings', icon: 'ShieldAlert', size: 'small', availableTo: ['vendor-manager', 'procurement-manager', 'admin'] },
  { id: 'quick-stats', title: 'Monthly Summary', description: 'Requests submitted, approved and completed this month', icon: 'BarChart', size: 'small', availableTo: allRoles },
  { id: 'ai-assistant', title: 'AI Assistant', description: 'Quick access to the procurement AI assistant', icon: 'MessageSquare', size: 'small', availableTo: allRoles },
];

export interface QuickActionConfig {
  id: string;
  label: string;
  icon: string;
  to?: string;
  action?: string;
  availableTo: Role[];
}

export const allQuickActions: QuickActionConfig[] = [
  { id: 'new-request', label: 'New Request', icon: 'Plus', to: '/requests/new', availableTo: allInternal },
  { id: 'track-request', label: 'Track a Request', icon: 'Search', to: '/requests', availableTo: allInternal },
  { id: 'my-approvals', label: 'My Approvals', icon: 'CheckCircle', to: '/approvals', availableTo: allInternal },
  { id: 'ai-assistant-action', label: 'Ask AI Assistant', icon: 'Sparkles', action: 'open-ai-chat', availableTo: allRoles },
  { id: 'all-requests', label: 'All Requests', icon: 'FileText', to: '/requests', availableTo: coreInternal },
  { id: 'active-workflows', label: 'Active Workflows', icon: 'Workflow', to: '/workflows', availableTo: coreInternal },
  { id: 'supplier-directory', label: 'Supplier Directory', icon: 'Building2', to: '/suppliers', availableTo: ['procurement-manager', 'vendor-manager', 'operations-lead', 'admin'] },
  { id: 'spend-overview', label: 'Spend Overview', icon: 'BarChart3', to: '/analytics/spend', availableTo: coreInternal },
  { id: 'bottlenecks', label: 'Bottlenecks', icon: 'AlertTriangle', to: '/workflows/bottlenecks', availableTo: coreInternal },
  { id: 'risk-compliance', label: 'Risk & Compliance', icon: 'Shield', to: '/suppliers/risk', availableTo: ['procurement-manager', 'vendor-manager', 'operations-lead', 'admin'] },
  { id: 'messages', label: 'Messages', icon: 'MessageSquare', to: '/suppliers/messages', availableTo: ['procurement-manager', 'vendor-manager', 'operations-lead', 'admin'] },
  { id: 'catalogue', label: 'Browse Catalogue', icon: 'ShoppingBag', to: '/requests/new', availableTo: allInternal },
  { id: 'my-tasks', label: 'My Tasks', icon: 'ListTodo', to: '/tasks', availableTo: allInternal },
  { id: 'contracts', label: 'Contracts', icon: 'FileSignature', to: '/contracts', availableTo: coreInternal },
  { id: 'invoices', label: 'Invoices', icon: 'Receipt', to: '/purchasing/invoices', availableTo: coreInternal },
  { id: 'routing-rules', label: 'Routing Rules', icon: 'Route', to: '/admin/rules', availableTo: ['admin'] },
  { id: 'workflow-designer', label: 'Workflow Designer', icon: 'PenTool', to: '/admin/workflows', availableTo: ['admin'] },
  { id: 'user-management', label: 'User Management', icon: 'UserCog', to: '/admin/users', availableTo: ['admin'] },
];

export function getDefaultLayout(role: Role): string[] {
  switch (role) {
    case 'service-owner': return ['quick-stats', 'my-requests', 'recent-activity', 'ai-assistant', 'ai-insights', 'expiring-contracts'];
    case 'procurement-manager': return ['kpi-open-demand', 'kpi-sourcing', 'kpi-cycle-time', 'kpi-compliance', 'demand-pipeline', 'team-workload', 'attention-required', 'ai-insights'];
    case 'vendor-manager': return ['validation-queue', 'quick-stats', 'supplier-risk', 'recent-activity', 'ai-insights'];
    case 'operations-lead': return ['workflow-health', 'sla-tracker', 'attention-required', 'ai-insights', 'recent-activity'];
    case 'admin': return ['system-health', 'quick-stats', 'workflow-health', 'supplier-risk', 'ai-insights'];
    case 'supplier': return ['quick-stats', 'ai-assistant'];
    default: return ['quick-stats', 'my-requests', 'ai-assistant'];
  }
}

export function getDefaultQuickActions(role: Role): string[] {
  switch (role) {
    case 'service-owner': return ['new-request', 'track-request', 'my-approvals', 'ai-assistant-action', 'catalogue'];
    case 'procurement-manager': return ['new-request', 'all-requests', 'active-workflows', 'supplier-directory', 'spend-overview', 'bottlenecks'];
    case 'vendor-manager': return ['all-requests', 'risk-compliance', 'supplier-directory', 'messages', 'my-approvals'];
    case 'operations-lead': return ['active-workflows', 'bottlenecks', 'all-requests', 'my-tasks'];
    case 'admin': return ['routing-rules', 'workflow-designer', 'user-management', 'spend-overview'];
    case 'supplier': return ['ai-assistant-action'];
    default: return ['new-request', 'track-request', 'ai-assistant-action'];
  }
}
