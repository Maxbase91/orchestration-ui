import type { Role } from './roles';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  path?: string;
  children?: NavItem[];
  visibleTo: Role[];
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
  visibleTo: Role[];
}

const allRoles: Role[] = ['service-owner', 'procurement-manager', 'vendor-manager', 'operations-lead', 'supplier', 'admin'];
const allInternal: Role[] = ['service-owner', 'procurement-manager', 'vendor-manager', 'operations-lead', 'admin'];
const coreInternal: Role[] = ['procurement-manager', 'operations-lead', 'admin'];
const sourcingRoles: Role[] = ['procurement-manager', 'vendor-manager', 'admin'];
const supplierMgmtRoles: Role[] = ['procurement-manager', 'vendor-manager', 'operations-lead', 'admin'];

export const navigation: NavGroup[] = [
  {
    id: 'home',
    label: '',
    visibleTo: allRoles,
    items: [
      { id: 'home', label: 'Home', icon: 'Home', path: '/', visibleTo: allRoles },
    ],
  },
  {
    id: 'work',
    label: 'Work',
    visibleTo: allInternal,
    items: [
      {
        id: 'requests',
        label: 'Requests',
        icon: 'FileText',
        visibleTo: allInternal,
        children: [
          { id: 'my-requests', label: 'My Requests', icon: 'FileText', path: '/requests/my', visibleTo: ['service-owner', 'procurement-manager', 'operations-lead', 'vendor-manager'] },
          { id: 'all-requests', label: 'All Requests', icon: 'Files', path: '/requests', visibleTo: ['procurement-manager', 'operations-lead', 'vendor-manager', 'admin'] },
          { id: 'new-request', label: 'New Request', icon: 'FilePlus', path: '/requests/new', visibleTo: ['service-owner', 'procurement-manager'] },
        ],
      },
      {
        id: 'approvals',
        label: 'Approvals',
        icon: 'CheckCircle',
        visibleTo: allInternal,
        children: [
          { id: 'my-approvals', label: 'My Approvals', icon: 'CheckCircle', path: '/approvals/my', visibleTo: allInternal },
          { id: 'delegation', label: 'Delegation', icon: 'UserCheck', path: '/approvals/delegation', visibleTo: allInternal },
        ],
      },
      {
        id: 'tasks',
        label: 'Tasks',
        icon: 'ListTodo',
        visibleTo: allInternal,
        children: [
          { id: 'my-tasks', label: 'My Tasks', icon: 'ListTodo', path: '/tasks/my', visibleTo: allInternal },
          { id: 'team-tasks', label: 'Team Tasks', icon: 'Users', path: '/tasks/team', visibleTo: ['procurement-manager', 'operations-lead'] },
        ],
      },
    ],
  },
  {
    id: 'orchestration',
    label: 'Orchestration',
    visibleTo: coreInternal,
    items: [
      {
        id: 'workflows',
        label: 'Workflows',
        icon: 'Workflow',
        visibleTo: coreInternal,
        children: [
          { id: 'active-workflows', label: 'Active Workflows', icon: 'Workflow', path: '/workflows/active', visibleTo: coreInternal },
          { id: 'workflow-monitor', label: 'Workflow Monitor', icon: 'Monitor', path: '/workflows/monitor', visibleTo: coreInternal },
          { id: 'bottlenecks', label: 'Bottlenecks & Alerts', icon: 'AlertTriangle', path: '/workflows/bottlenecks', visibleTo: coreInternal },
        ],
      },
      {
        id: 'pipeline',
        label: 'Pipeline',
        icon: 'GitBranch',
        visibleTo: coreInternal,
        children: [
          { id: 'demand-pipeline', label: 'Demand Pipeline', icon: 'TrendingUp', path: '/pipeline/demand', visibleTo: coreInternal },
          { id: 'sourcing-pipeline', label: 'Sourcing Pipeline', icon: 'Search', path: '/pipeline/sourcing', visibleTo: coreInternal },
        ],
      },
    ],
  },
  {
    id: 'sourcing',
    label: 'Sourcing',
    visibleTo: sourcingRoles,
    items: [
      {
        id: 'events',
        label: 'Events',
        icon: 'Calendar',
        visibleTo: sourcingRoles,
        children: [
          { id: 'active-events', label: 'Active Events', icon: 'Calendar', path: '/sourcing/events', visibleTo: sourcingRoles },
          { id: 'new-event', label: 'New Event', icon: 'CalendarPlus', path: '/sourcing/events/new', visibleTo: sourcingRoles },
          { id: 'sourcing-templates', label: 'Templates', icon: 'LayoutTemplate', path: '/sourcing/templates', visibleTo: sourcingRoles },
          { id: 'evaluation-centre', label: 'Evaluation Centre', icon: 'Award', path: '/sourcing/evaluation', visibleTo: sourcingRoles },
        ],
      },
    ],
  },
  {
    id: 'suppliers',
    label: 'Suppliers',
    visibleTo: supplierMgmtRoles,
    items: [
      {
        id: 'directory',
        label: 'Directory',
        icon: 'Building2',
        visibleTo: supplierMgmtRoles,
        children: [
          { id: 'all-suppliers', label: 'All Suppliers', icon: 'Building2', path: '/suppliers', visibleTo: supplierMgmtRoles },
          { id: 'onboarding-pipeline', label: 'Onboarding Pipeline', icon: 'UserPlus', path: '/suppliers/onboarding', visibleTo: supplierMgmtRoles },
          { id: 'risk-compliance', label: 'Risk & Compliance', icon: 'ShieldCheck', path: '/suppliers/risk', visibleTo: supplierMgmtRoles },
          { id: 'supplier-portal-admin', label: 'Supplier Portal Admin', icon: 'Settings', path: '/suppliers/portal-admin', visibleTo: supplierMgmtRoles },
        ],
      },
    ],
  },
  {
    id: 'contracts',
    label: 'Contracts',
    visibleTo: coreInternal,
    items: [
      {
        id: 'contract-register',
        label: 'Contract Register',
        icon: 'FileSignature',
        visibleTo: coreInternal,
        children: [
          { id: 'active-contracts', label: 'Active Contracts', icon: 'FileSignature', path: '/contracts', visibleTo: coreInternal },
          { id: 'renewals-expiries', label: 'Renewals & Expiries', icon: 'Clock', path: '/contracts/renewals', visibleTo: coreInternal },
          { id: 'contract-templates', label: 'Templates', icon: 'LayoutTemplate', path: '/contracts/templates', visibleTo: coreInternal },
        ],
      },
    ],
  },
  {
    id: 'purchasing',
    label: 'Purchasing',
    visibleTo: coreInternal,
    items: [
      {
        id: 'purchase-orders',
        label: 'Purchase Orders',
        icon: 'ShoppingCart',
        visibleTo: coreInternal,
        children: [
          { id: 'open-pos', label: 'Open POs', icon: 'ShoppingCart', path: '/purchasing/orders', visibleTo: coreInternal },
          { id: 'goods-receipt', label: 'Goods Receipt', icon: 'PackageCheck', path: '/purchasing/goods-receipt', visibleTo: coreInternal },
        ],
      },
      {
        id: 'invoices',
        label: 'Invoices',
        icon: 'Receipt',
        visibleTo: coreInternal,
        children: [
          { id: 'invoice-queue', label: 'Invoice Queue', icon: 'Receipt', path: '/purchasing/invoices', visibleTo: coreInternal },
          { id: 'three-way-match', label: 'Three-Way Match', icon: 'GitMerge', path: '/purchasing/three-way-match', visibleTo: coreInternal },
          { id: 'payment-tracker', label: 'Payment Tracker', icon: 'CreditCard', path: '/purchasing/payments', visibleTo: coreInternal },
        ],
      },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    visibleTo: coreInternal,
    items: [
      {
        id: 'dashboards',
        label: 'Dashboards',
        icon: 'BarChart3',
        visibleTo: coreInternal,
        children: [
          { id: 'spend-overview', label: 'Spend Overview', icon: 'PieChart', path: '/analytics/spend', visibleTo: coreInternal },
          { id: 'compliance-kpis', label: 'Compliance KPIs', icon: 'ShieldCheck', path: '/analytics/compliance', visibleTo: coreInternal },
          { id: 'pipeline-cycle-time', label: 'Pipeline & Cycle Time', icon: 'Timer', path: '/analytics/pipeline', visibleTo: coreInternal },
          { id: 'supplier-performance', label: 'Supplier Performance', icon: 'TrendingUp', path: '/analytics/supplier-performance', visibleTo: coreInternal },
        ],
      },
      {
        id: 'reports',
        label: 'Reports',
        icon: 'FileBarChart',
        visibleTo: coreInternal,
        children: [
          { id: 'report-builder', label: 'Report Builder', icon: 'FileBarChart', path: '/analytics/reports/builder', visibleTo: coreInternal },
          { id: 'scheduled-reports', label: 'Scheduled Reports', icon: 'CalendarClock', path: '/analytics/reports/scheduled', visibleTo: coreInternal },
          { id: 'exports', label: 'Exports', icon: 'Download', path: '/analytics/reports/exports', visibleTo: coreInternal },
        ],
      },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    visibleTo: ['admin'],
    items: [
      { id: 'routing-rules', label: 'Routing Rules', icon: 'Route', path: '/admin/routing-rules', visibleTo: ['admin'] },
      { id: 'approval-chains', label: 'Approval Chains', icon: 'Link', path: '/admin/approval-chains', visibleTo: ['admin'] },
      { id: 'workflow-designer', label: 'Workflow Designer', icon: 'PenTool', path: '/admin/workflow-designer', visibleTo: ['admin'] },
      { id: 'ai-agent-config', label: 'AI Agent Configuration', icon: 'Bot', path: '/admin/ai-agents', visibleTo: ['admin'] },
      { id: 'policy-management', label: 'Policy Management', icon: 'ScrollText', path: '/admin/policies', visibleTo: ['admin'] },
      { id: 'user-management', label: 'User Management', icon: 'Users', path: '/admin/users', visibleTo: ['admin'] },
      { id: 'system-health', label: 'System Health', icon: 'Activity', path: '/admin/system-health', visibleTo: ['admin'] },
      { id: 'audit-log', label: 'Audit Log', icon: 'History', path: '/admin/audit-log', visibleTo: ['admin'] },
    ],
  },
  {
    id: 'help',
    label: 'Help',
    visibleTo: allRoles,
    items: [
      { id: 'ai-assistant', label: 'AI Assistant', icon: 'MessageSquare', path: '/help/ai-assistant', visibleTo: allRoles },
      { id: 'knowledge-base', label: 'Knowledge Base', icon: 'BookOpen', path: '/help/knowledge-base', visibleTo: allRoles },
      { id: 'contact-support', label: 'Contact Support', icon: 'HelpCircle', path: '/help/contact', visibleTo: allRoles },
    ],
  },
];
