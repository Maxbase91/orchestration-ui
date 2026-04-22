import { AlertCircle, Bell, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatCurrency, formatDate } from '@/lib/format';
import { useInvoiceLookup, useInvoices } from '@/lib/db/hooks/use-invoices';
import { useSupplier } from '@/lib/db/hooks/use-suppliers';

// Mock: portal user is supplier SUP-001 (Accenture)
const PORTAL_SUPPLIER_ID = 'SUP-001';

export function PortalDashboard() {
  const { data: supplier } = useSupplier(PORTAL_SUPPLIER_ID);
  useInvoices();
  const { bySupplier: invoicesBySupplier } = useInvoiceLookup();
  const invoices = invoicesBySupplier(PORTAL_SUPPLIER_ID).slice(0, 5);
  const supplierName = supplier?.name ?? 'Supplier';
  const isOnboarding = supplier?.onboardingStatus === 'in-progress';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Welcome back, {supplierName}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Here is an overview of your account activity.
        </p>
      </div>

      {/* Action Items */}
      <Card className="border-l-2 border-l-amber-500 py-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertCircle className="size-4 text-amber-600" />
            Action Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-amber-500" />
              <span>2 documents due for renewal</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-amber-500" />
              <span>1 compliance questionnaire to complete</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-blue-500" />
              <span>New sourcing event invitation</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {isOnboarding && (
        <Card className="py-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Onboarding Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={60} className="h-2" />
            <p className="mt-2 text-xs text-muted-foreground">
              3 of 5 steps completed. Continue onboarding to unlock full portal access.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Payments */}
        <Card className="py-4">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CreditCard className="size-4 text-muted-foreground" />
              Recent Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payment history available.</p>
            ) : (
              <div className="space-y-3">
                {invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between rounded-md border p-2.5">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{inv.id}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(inv.invoiceDate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{formatCurrency(inv.amount)}</p>
                      <p className="text-xs text-muted-foreground capitalize">{inv.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Announcements */}
        <Card className="py-4">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Bell className="size-4 text-muted-foreground" />
              Announcements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="rounded-md bg-blue-50 p-3">
                <p className="text-sm font-medium text-blue-900">New Supplier Portal Features</p>
                <p className="mt-1 text-xs text-blue-700">
                  You can now submit invoices and track payment status directly through the portal. Check the Invoices tab for details.
                </p>
              </div>
              <div className="rounded-md bg-gray-50 p-3">
                <p className="text-sm font-medium text-gray-900">Annual Compliance Review</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  The annual supplier compliance review cycle begins next month. Please ensure all certifications are up to date.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
