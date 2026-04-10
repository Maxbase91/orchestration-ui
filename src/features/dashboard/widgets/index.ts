import type React from 'react';
import { WidgetMyRequests } from './widget-my-requests';
import { WidgetKPIOpenDemand } from './widget-kpi-open-demand';
import { WidgetKPISourcing } from './widget-kpi-sourcing';
import { WidgetKPICycleTime } from './widget-kpi-cycle-time';
import { WidgetKPICompliance } from './widget-kpi-compliance';
import { WidgetDemandPipeline } from './widget-demand-pipeline';
import { WidgetTeamWorkload } from './widget-team-workload';
import { WidgetAttentionRequired } from './widget-attention-required';
import { WidgetAIInsights } from './widget-ai-insights';
import { WidgetValidationQueue } from './widget-validation-queue';
import { WidgetWorkflowHealth } from './widget-workflow-health';
import { WidgetRecentActivity } from './widget-recent-activity';
import { WidgetSLATracker } from './widget-sla-tracker';
import { WidgetSystemHealth } from './widget-system-health';
import { WidgetExpiringContracts } from './widget-expiring-contracts';
import { WidgetSupplierRisk } from './widget-supplier-risk';
import { WidgetQuickStats } from './widget-quick-stats';
import { WidgetAIAssistant } from './widget-ai-assistant';

export {
  WidgetMyRequests,
  WidgetKPIOpenDemand,
  WidgetKPISourcing,
  WidgetKPICycleTime,
  WidgetKPICompliance,
  WidgetDemandPipeline,
  WidgetTeamWorkload,
  WidgetAttentionRequired,
  WidgetAIInsights,
  WidgetValidationQueue,
  WidgetWorkflowHealth,
  WidgetRecentActivity,
  WidgetSLATracker,
  WidgetSystemHealth,
  WidgetExpiringContracts,
  WidgetSupplierRisk,
  WidgetQuickStats,
  WidgetAIAssistant,
};

export const widgetComponents: Record<string, React.ComponentType> = {
  'my-requests': WidgetMyRequests,
  'kpi-open-demand': WidgetKPIOpenDemand,
  'kpi-sourcing': WidgetKPISourcing,
  'kpi-cycle-time': WidgetKPICycleTime,
  'kpi-compliance': WidgetKPICompliance,
  'demand-pipeline': WidgetDemandPipeline,
  'team-workload': WidgetTeamWorkload,
  'attention-required': WidgetAttentionRequired,
  'ai-insights': WidgetAIInsights,
  'validation-queue': WidgetValidationQueue,
  'workflow-health': WidgetWorkflowHealth,
  'recent-activity': WidgetRecentActivity,
  'sla-tracker': WidgetSLATracker,
  'system-health': WidgetSystemHealth,
  'expiring-contracts': WidgetExpiringContracts,
  'supplier-risk': WidgetSupplierRisk,
  'quick-stats': WidgetQuickStats,
  'ai-assistant': WidgetAIAssistant,
};
