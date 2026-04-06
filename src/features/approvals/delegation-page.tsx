import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { DelegationManager } from './components/delegation-manager';

export function DelegationPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Delegation Settings"
        subtitle="Manage approval delegations when you are out of office"
        actions={
          <Button variant="outline" asChild>
            <Link to="/approvals">
              <ArrowLeft className="size-4" />
              Back to Approvals
            </Link>
          </Button>
        }
      />

      <div className="rounded-lg border bg-white p-6">
        <DelegationManager />
      </div>
    </div>
  );
}
