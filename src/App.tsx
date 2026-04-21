import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppLayout } from '@/components/layout/app-layout'
import { SupplierPortalLayout } from '@/components/layout/supplier-portal-layout'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { NewRequestPage } from '@/features/requests/new-request/new-request-page'
import { RequestDetailPage } from '@/features/requests/request-detail/request-detail-page'
import { RequestListPage } from '@/features/requests/request-list-page'
import { ActiveWorkflowsPage } from '@/features/workflows/active-workflows-page'
import { WorkflowMonitorPage } from '@/features/workflows/workflow-monitor-page'
import { SupplierDirectoryPage } from '@/features/suppliers/supplier-directory-page'
import { SupplierProfilePage } from '@/features/suppliers/supplier-profile-page'
import { PortalDashboard } from '@/features/suppliers/portal/portal-dashboard'
import { PortalProfile } from '@/features/suppliers/portal/portal-profile'
import { PortalOnboarding } from '@/features/suppliers/portal/portal-onboarding'
import { PortalInvoices } from '@/features/suppliers/portal/portal-invoices'
import { PortalSourcing } from '@/features/suppliers/portal/portal-sourcing'
import { PortalDocuments } from '@/features/suppliers/portal/portal-documents'
import { PortalMessages } from '@/features/suppliers/portal/portal-messages'
import { SupplierMessagesPage } from '@/features/suppliers/supplier-messages-page'
import { ApprovalsPage } from '@/features/approvals/approvals-page'
import { DelegationPage } from '@/features/approvals/delegation-page'
import { RoutingRulesPage } from '@/features/admin/routing-rules/routing-rules-page'
import { FormBuilderPage } from '@/features/admin/forms/form-builder-page'
import { AIAgentsPage } from '@/features/admin/ai-agents/ai-agents-page'
import { WorkflowDesignerPage } from '@/features/admin/workflow-designer/workflow-designer-page'
import { EventListPage } from '@/features/sourcing/event-list-page'
import { EventDetailPage } from '@/features/sourcing/event-detail-page'
import { EvaluationCentrePage } from '@/features/sourcing/evaluation-centre-page'
import { ContractRegisterPage } from '@/features/contracts/contract-register-page'
import { ContractDetailPage } from '@/features/contracts/contract-detail-page'
import { POListPage } from '@/features/purchasing/po-list-page'
import { PODetailPage } from '@/features/purchasing/po-detail-page'
import { InvoiceQueuePage } from '@/features/purchasing/invoice-queue-page'
import { ThreeWayMatchPage } from '@/features/purchasing/three-way-match-page'
import { SpendDashboardPage } from '@/features/analytics/spend-dashboard-page'
import { ComplianceKPIPage } from '@/features/analytics/compliance-kpi-page'
import { PipelineDashboardPage } from '@/features/analytics/pipeline-dashboard-page'
import { SupplierPerformancePage } from '@/features/analytics/supplier-performance-page'
import { ReportBuilderPage } from '@/features/analytics/report-builder-page'
import { NotificationsPage } from '@/features/notifications/notifications-page'
import { SettingsPage } from '@/features/settings/settings-page'
import { AuditLogPage } from '@/features/settings/audit-log-page'
import { AIChatOverlay } from '@/features/ai-assistant/ai-chat-overlay'
import { NewEventPage } from '@/features/sourcing/new-event-page'
import { SourcingTemplatesPage } from '@/features/sourcing/sourcing-templates-page'
import { PortalAdminPage } from '@/features/suppliers/portal-admin-page'
import { ApprovalChainsPage } from '@/features/admin/approval-chains-page'
import { PolicyManagementPage } from '@/features/admin/policy-management-page'
import { UserManagementPage } from '@/features/admin/user-management-page'
import { SystemHealthPage } from '@/features/admin/system-health-page'
import { DatabaseAdminPage } from '@/features/admin/database/database-admin-page'
import { AIAssistantPage } from '@/features/help/ai-assistant-page'
import { KnowledgeBasePage } from '@/features/help/knowledge-base-page'
import { ContactSupportPage } from '@/features/help/contact-support-page'
import { MyTasksPage } from '@/features/tasks/my-tasks-page'
import { TeamTasksPage } from '@/features/tasks/team-tasks-page'
import { BottlenecksPage } from '@/features/workflows/bottlenecks-page'
import { DemandPipelinePage } from '@/features/pipeline/demand-pipeline-page'
import { SourcingPipelinePage } from '@/features/pipeline/sourcing-pipeline-page'
import { OnboardingPipelinePage } from '@/features/suppliers/onboarding-pipeline-page'
import { RiskCompliancePage } from '@/features/suppliers/risk-compliance-page'
import { RenewalsPage } from '@/features/contracts/renewals-page'
import { TemplatesPage } from '@/features/contracts/templates-page'
import { GoodsReceiptPage } from '@/features/purchasing/goods-receipt-page'
import { PaymentTrackerPage } from '@/features/purchasing/payment-tracker-page'
import { ScheduledReportsPage } from '@/features/analytics/scheduled-reports-page'
import { ExportsPage } from '@/features/analytics/exports-page'

export function App() {
  return (
    <BrowserRouter>
      <TooltipProvider>
        <Routes>
          {/* Internal app routes */}
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />

            {/* Requests */}
            <Route path="/requests" element={<RequestListPage title="All Requests" />} />
            <Route path="/requests/my" element={<RequestListPage title="My Requests" filterMine />} />
            <Route path="/requests/new" element={<NewRequestPage />} />
            <Route path="/requests/:id" element={<RequestDetailPage />} />

            {/* Approvals */}
            <Route path="/approvals" element={<ApprovalsPage />} />
            <Route path="/approvals/delegation" element={<DelegationPage />} />

            {/* Tasks */}
            <Route path="/tasks" element={<MyTasksPage />} />
            <Route path="/tasks/team" element={<TeamTasksPage />} />

            {/* Workflows */}
            <Route path="/workflows" element={<ActiveWorkflowsPage />} />
            <Route path="/workflows/monitor" element={<WorkflowMonitorPage />} />
            <Route path="/workflows/bottlenecks" element={<BottlenecksPage />} />

            {/* Pipeline */}
            <Route path="/pipeline/demand" element={<DemandPipelinePage />} />
            <Route path="/pipeline/sourcing" element={<SourcingPipelinePage />} />

            {/* Sourcing */}
            <Route path="/sourcing" element={<EventListPage />} />
            <Route path="/sourcing/new" element={<NewEventPage />} />
            <Route path="/sourcing/templates" element={<SourcingTemplatesPage />} />
            <Route path="/sourcing/evaluation" element={<EvaluationCentrePage />} />
            <Route path="/sourcing/:id" element={<EventDetailPage />} />

            {/* Suppliers */}
            <Route path="/suppliers" element={<SupplierDirectoryPage />} />
            <Route path="/suppliers/onboarding" element={<OnboardingPipelinePage />} />
            <Route path="/suppliers/risk" element={<RiskCompliancePage />} />
            <Route path="/suppliers/portal-admin" element={<PortalAdminPage />} />
            <Route path="/suppliers/messages" element={<SupplierMessagesPage />} />
            <Route path="/suppliers/:id" element={<SupplierProfilePage />} />

            {/* Contracts */}
            <Route path="/contracts" element={<ContractRegisterPage />} />
            <Route path="/contracts/renewals" element={<RenewalsPage />} />
            <Route path="/contracts/templates" element={<TemplatesPage />} />
            <Route path="/contracts/:id" element={<ContractDetailPage />} />

            {/* Purchasing */}
            <Route path="/purchasing/orders" element={<POListPage />} />
            <Route path="/purchasing/orders/:id" element={<PODetailPage />} />
            <Route path="/purchasing/receipt" element={<GoodsReceiptPage />} />
            <Route path="/purchasing/invoices" element={<InvoiceQueuePage />} />
            <Route path="/purchasing/match" element={<ThreeWayMatchPage />} />
            <Route path="/purchasing/payments" element={<PaymentTrackerPage />} />

            {/* Analytics */}
            <Route path="/analytics/spend" element={<SpendDashboardPage />} />
            <Route path="/analytics/compliance" element={<ComplianceKPIPage />} />
            <Route path="/analytics/pipeline" element={<PipelineDashboardPage />} />
            <Route path="/analytics/suppliers" element={<SupplierPerformancePage />} />
            <Route path="/analytics/reports" element={<ReportBuilderPage />} />
            <Route path="/analytics/reports/scheduled" element={<ScheduledReportsPage />} />
            <Route path="/analytics/exports" element={<ExportsPage />} />

            {/* Admin */}
            <Route path="/admin/database" element={<DatabaseAdminPage />} />
            <Route path="/admin/rules" element={<RoutingRulesPage />} />
            <Route path="/admin/forms" element={<FormBuilderPage />} />
            <Route path="/admin/approvals" element={<ApprovalChainsPage />} />
            <Route path="/admin/workflows" element={<WorkflowDesignerPage />} />
            <Route path="/admin/agents" element={<AIAgentsPage />} />
            <Route path="/admin/policies" element={<PolicyManagementPage />} />
            <Route path="/admin/users" element={<UserManagementPage />} />
            <Route path="/admin/health" element={<SystemHealthPage />} />
            <Route path="/admin/audit" element={<AuditLogPage />} />

            {/* Notifications & Settings */}
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />

            {/* Help */}
            <Route path="/help/assistant" element={<AIAssistantPage />} />
            <Route path="/help/kb" element={<KnowledgeBasePage />} />
            <Route path="/help/support" element={<ContactSupportPage />} />
          </Route>

          {/* Supplier Portal routes */}
          <Route element={<SupplierPortalLayout />}>
            <Route path="/portal" element={<PortalDashboard />} />
            <Route path="/portal/profile" element={<PortalProfile />} />
            <Route path="/portal/onboarding" element={<PortalOnboarding />} />
            <Route path="/portal/sourcing" element={<PortalSourcing />} />
            <Route path="/portal/invoices" element={<PortalInvoices />} />
            <Route path="/portal/documents" element={<PortalDocuments />} />
            <Route path="/portal/messages" element={<PortalMessages />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <AIChatOverlay />
        <Toaster position="top-right" richColors />
      </TooltipProvider>
    </BrowserRouter>
  )
}
