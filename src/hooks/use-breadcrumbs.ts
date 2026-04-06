import { useLocation } from 'react-router-dom';

export interface Breadcrumb {
  label: string;
  path: string;
}

const segmentLabels: Record<string, string> = {
  requests: 'Requests',
  my: 'My Requests',
  new: 'New Request',
  approvals: 'Approvals',
  delegation: 'Delegation',
  tasks: 'Tasks',
  team: 'Team Tasks',
  workflows: 'Workflows',
  active: 'Active',
  monitor: 'Workflow Monitor',
  bottlenecks: 'Bottlenecks & Alerts',
  pipeline: 'Pipeline',
  demand: 'Demand Pipeline',
  sourcing: 'Sourcing',
  events: 'Events',
  templates: 'Templates',
  evaluation: 'Evaluation Centre',
  suppliers: 'Suppliers',
  onboarding: 'Onboarding Pipeline',
  risk: 'Risk & Compliance',
  'portal-admin': 'Supplier Portal Admin',
  contracts: 'Contracts',
  renewals: 'Renewals & Expiries',
  purchasing: 'Purchasing',
  orders: 'Open POs',
  'goods-receipt': 'Goods Receipt',
  invoices: 'Invoices',
  'three-way-match': 'Three-Way Match',
  payments: 'Payment Tracker',
  analytics: 'Analytics',
  spend: 'Spend Overview',
  compliance: 'Compliance KPIs',
  'supplier-performance': 'Supplier Performance',
  reports: 'Reports',
  builder: 'Report Builder',
  scheduled: 'Scheduled Reports',
  exports: 'Exports',
  admin: 'Admin',
  'routing-rules': 'Routing Rules',
  'approval-chains': 'Approval Chains',
  'workflow-designer': 'Workflow Designer',
  'ai-agents': 'AI Agent Configuration',
  policies: 'Policy Management',
  users: 'User Management',
  'system-health': 'System Health',
  'audit-log': 'Audit Log',
  help: 'Help',
  'ai-assistant': 'AI Assistant',
  'knowledge-base': 'Knowledge Base',
  contact: 'Contact Support',
};

function humanize(segment: string): string {
  return segmentLabels[segment] ?? segment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function useBreadcrumbs(): Breadcrumb[] {
  const location = useLocation();
  const { pathname } = location;

  if (pathname === '/') {
    return [{ label: 'Home', path: '/' }];
  }

  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: Breadcrumb[] = [{ label: 'Home', path: '/' }];

  segments.forEach((segment, index) => {
    const path = '/' + segments.slice(0, index + 1).join('/');
    breadcrumbs.push({ label: humanize(segment), path });
  });

  return breadcrumbs;
}
