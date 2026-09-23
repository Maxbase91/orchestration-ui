// One request: header and actions, the lifecycle stepper, and seven tabs.
//
// Loading, a failed read and a request that does not exist are three different
// screens. They were one — anything but data rendered "does not exist or has
// been removed", so a slow network and an unreachable database both told the
// reader their request was gone.
import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useRequest } from '@/lib/db/hooks/use-requests';
import { RequestHeader } from './components/request-header';
import { LifecycleStepper } from './components/lifecycle-stepper';
import { TabOverview } from './tab-overview';
import { TabWorkflow } from './tab-workflow';
import { TabApprovals } from './tab-approvals';
import { TabRelated } from './tab-related';
import { TabActivity } from './tab-activity';
import { TabCompliance } from './tab-compliance';
import { TabDocuments } from './tab-documents';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { FileQuestion } from 'lucide-react';
import { AsyncBoundary } from '@/components/shared/async-boundary';

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useRequest(id);
  const request = query.data;
  const [activeTab, setActiveTab] = useState('overview');
  const [focusStageId, setFocusStageId] = useState<string | null>(null);

  // Top stepper → switch to Workflow tab and surface the chosen stage.
  const handleStepClick = useCallback((stepId: string) => {
    setActiveTab('workflow');
    setFocusStageId(stepId);
  }, []);

  if (query.isLoading || query.isError) {
    return <AsyncBoundary query={query} of="this request" minHeight={240}>{null}</AsyncBoundary>;
  }

  if (!request) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <FileQuestion className="size-10 text-ink-3" />
        <h2 className="text-heading font-semibold text-ink">Request not found</h2>
        <p className="text-body text-ink-3">
          The request {id ? `"${id}"` : ''} does not exist or has been removed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <RequestHeader request={request} />

      <Card>
        <CardContent className="py-3">
          <LifecycleStepper request={request} onStepClick={handleStepClick} />
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList variant="line" className="w-full justify-start border-b">
          <TabsTrigger value="overview" title="Summary and next action">Overview</TabsTrigger>
          <TabsTrigger value="compliance" title="Risk and policy checks">Compliance</TabsTrigger>
          <TabsTrigger value="workflow" title="Operational process">Workflow</TabsTrigger>
          <TabsTrigger value="approvals" title="Who must approve">Approvals</TabsTrigger>
          <TabsTrigger value="documents" title="Supporting records">Documents</TabsTrigger>
          <TabsTrigger value="activity" title="Comments and history">Activity</TabsTrigger>
          <TabsTrigger value="links" title="Linked records">Related</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="pt-4">
          <TabOverview request={request} />
        </TabsContent>
        <TabsContent value="compliance" className="pt-4">
          <TabCompliance request={request} />
        </TabsContent>
        <TabsContent value="workflow" className="pt-4">
          <TabWorkflow request={request} focusStageId={focusStageId} />
        </TabsContent>
        <TabsContent value="approvals" className="pt-4">
          <TabApprovals request={request} />
        </TabsContent>
        <TabsContent value="documents" className="pt-4">
          <TabDocuments request={request} />
        </TabsContent>
        <TabsContent value="activity" className="pt-4">
          <TabActivity request={request} />
        </TabsContent>
        <TabsContent value="links" className="pt-4">
          <TabRelated request={request} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
