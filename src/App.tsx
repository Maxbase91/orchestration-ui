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

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
        <p className="text-text-muted mt-2">Coming soon</p>
      </div>
    </div>
  )
}

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
            <Route path="/tasks" element={<PlaceholderPage title="My Tasks" />} />
            <Route path="/tasks/team" element={<PlaceholderPage title="Team Tasks" />} />

            {/* Workflows */}
            <Route path="/workflows" element={<ActiveWorkflowsPage />} />
            <Route path="/workflows/monitor" element={<WorkflowMonitorPage />} />
            <Route path="/workflows/bottlenecks" element={<PlaceholderPage title="Bottlenecks & Alerts" />} />

            {/* Pipeline */}
            <Route path="/pipeline/demand" element={<PlaceholderPage title="Demand Pipeline" />} />
            <Route path="/pipeline/sourcing" element={<PlaceholderPage title="Sourcing Pipeline" />} />

            {/* Sourcing */}
            <Route path="/sourcing" element={<EventListPage />} />
            <Route path="/sourcing/new" element={<PlaceholderPage title="New Event" />} />
            <Route path="/sourcing/templates" element={<PlaceholderPage title="Templates" />} />
            <Route path="/sourcing/evaluation" element={<EvaluationCentrePage />} />
            <Route path="/sourcing/:id" element={<EventDetailPage />} />

            {/* Suppliers */}
            <Route path="/suppliers" element={<SupplierDirectoryPage />} />
            <Route path="/suppliers/onboarding" element={<PlaceholderPage title="Onboarding Pipeline" />} />
            <Route path="/suppliers/risk" element={<PlaceholderPage title="Risk & Compliance" />} />
            <Route path="/suppliers/portal-admin" element={<PlaceholderPage title="Supplier Portal Admin" />} />
            <Route path="/suppliers/messages" element={<SupplierMessagesPage />} />
            <Route path="/suppliers/:id" element={<SupplierProfilePage />} />

            {/* Contracts */}
            <Route path="/contracts" element={<ContractRegisterPage />} />
            <Route path="/contracts/renewals" element={<PlaceholderPage title="Renewals & Expiries" />} />
            <Route path="/contracts/templates" element={<PlaceholderPage title="Contract Templates" />} />
            <Route path="/contracts/:id" element={<ContractDetailPage />} />

            {/* Purchasing */}
            <Route path="/purchasing/orders" element={<POListPage />} />
            <Route path="/purchasing/orders/:id" element={<PODetailPage />} />
            <Route path="/purchasing/receipt" element={<PlaceholderPage title="Goods Receipt" />} />
            <Route path="/purchasing/invoices" element={<InvoiceQueuePage />} />
            <Route path="/purchasing/match" element={<ThreeWayMatchPage />} />
            <Route path="/purchasing/payments" element={<PlaceholderPage title="Payment Tracker" />} />

            {/* Analytics */}
            <Route path="/analytics/spend" element={<SpendDashboardPage />} />
            <Route path="/analytics/compliance" element={<ComplianceKPIPage />} />
            <Route path="/analytics/pipeline" element={<PipelineDashboardPage />} />
            <Route path="/analytics/suppliers" element={<SupplierPerformancePage />} />
            <Route path="/analytics/reports" element={<ReportBuilderPage />} />
            <Route path="/analytics/reports/scheduled" element={<PlaceholderPage title="Scheduled Reports" />} />
            <Route path="/analytics/exports" element={<PlaceholderPage title="Exports" />} />

            {/* Admin */}
            <Route path="/admin/rules" element={<RoutingRulesPage />} />
            <Route path="/admin/approvals" element={<PlaceholderPage title="Approval Chains" />} />
            <Route path="/admin/workflows" element={<WorkflowDesignerPage />} />
            <Route path="/admin/agents" element={<AIAgentsPage />} />
            <Route path="/admin/policies" element={<PlaceholderPage title="Policy Management" />} />
            <Route path="/admin/users" element={<PlaceholderPage title="User Management" />} />
            <Route path="/admin/health" element={<PlaceholderPage title="System Health" />} />
            <Route path="/admin/audit" element={<AuditLogPage />} />

            {/* Notifications & Settings */}
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />

            {/* Help */}
            <Route path="/help/assistant" element={<PlaceholderPage title="AI Assistant" />} />
            <Route path="/help/kb" element={<PlaceholderPage title="Knowledge Base" />} />
            <Route path="/help/support" element={<PlaceholderPage title="Contact Support" />} />
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
