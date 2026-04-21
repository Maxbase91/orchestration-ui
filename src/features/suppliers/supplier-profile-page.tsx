import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/page-header';
import { useSupplier } from '@/lib/db/hooks/use-suppliers';
import { riskColors, countryFlags } from './components/supplier-card';
import { ProfileOverviewTab } from './components/profile-overview-tab';
import { ProfileContractsTab } from './components/profile-contracts-tab';
import { ProfileRiskTab } from './components/profile-risk-tab';
import { ProfileSpendTab } from './components/profile-spend-tab';
import { ProfilePerformanceTab } from './components/profile-performance-tab';
import { ProfileDocumentsTab } from './components/profile-documents-tab';
import { ProfileActivityTab } from './components/profile-activity-tab';

export function SupplierProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: fetched } = useSupplier(id);
  const supplier = fetched ?? undefined;

  if (!supplier) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-sm text-muted-foreground">Supplier not found.</p>
        <Button variant="outline" onClick={() => navigate('/suppliers')}>
          <ArrowLeft className="size-4" />
          Back to Directory
        </Button>
      </div>
    );
  }

  const flag = countryFlags[supplier.countryCode] ?? '';

  return (
    <div className="space-y-5">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => navigate('/suppliers')}
      >
        <ArrowLeft className="size-3.5" />
        Back to Directory
      </Button>

      <PageHeader
        title={`${flag} ${supplier.name}`}
        subtitle={supplier.address}
        badge={
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${riskColors[supplier.riskRating]}`}>
              {supplier.riskRating.charAt(0).toUpperCase() + supplier.riskRating.slice(1)} Risk
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
              Tier {supplier.tier}
            </span>
          </div>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="risk">Risk & Compliance</TabsTrigger>
          <TabsTrigger value="spend">Spend</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <ProfileOverviewTab supplier={supplier} />
        </TabsContent>
        <TabsContent value="contracts" className="mt-4">
          <ProfileContractsTab supplierId={supplier.id} />
        </TabsContent>
        <TabsContent value="risk" className="mt-4">
          <ProfileRiskTab supplier={supplier} />
        </TabsContent>
        <TabsContent value="spend" className="mt-4">
          <ProfileSpendTab supplier={supplier} />
        </TabsContent>
        <TabsContent value="performance" className="mt-4">
          <ProfilePerformanceTab supplier={supplier} />
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <ProfileDocumentsTab supplier={supplier} />
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          <ProfileActivityTab supplier={supplier} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
