import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useRequest } from '@/lib/db/hooks/use-requests';
import { RequestHeader } from './components/request-header';
import { LifecycleStepper } from './components/lifecycle-stepper';
import { TabOverview } from './tab-overview';
import { TabCompliance } from './tab-compliance';
import { TabWorkflow } from './tab-workflow';
import { TabComments } from './tab-comments';
import { TabApprovals } from './tab-approvals';
import { TabDocuments } from './tab-documents';
import { TabRelated } from './tab-related';
import { TabAudit } from './tab-audit';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { FileQuestion } from 'lucide-react';

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: request } = useRequest(id);
  const [activeTab, setActiveTab] = useState('overview');
  const [focusStageId, setFocusStageId] = useState<string | null>(null);

  // Top stepper → switch to Workflow tab and surface the chosen stage.
  // The Workflow tab picks `focusStageId` up from a prop (see tab-workflow.tsx).
  const handleStepClick = useCallback((stepId: string) => {
    setActiveTab('workflow');
    setFocusStageId(stepId);
  }, []);

  if (!request) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <FileQuestion className="size-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold text-gray-900">Request not found</h2>
        <p className="text-sm text-muted-foreground">
          The request {id ? `"${id}"` : ''} does not exist or has been removed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <RequestHeader request={request} />

      <Card>
        <CardContent className="py-4">
          <LifecycleStepper request={request} onStepClick={handleStepClick} />
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList variant="line" className="w-full justify-start border-b">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="related">Related</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
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
        <TabsContent value="comments" className="pt-4">
          <TabComments request={request} />
        </TabsContent>
        <TabsContent value="approvals" className="pt-4">
          <TabApprovals request={request} />
        </TabsContent>
        <TabsContent value="documents" className="pt-4">
          <TabDocuments request={request} />
        </TabsContent>
        <TabsContent value="related" className="pt-4">
          <TabRelated request={request} />
        </TabsContent>
        <TabsContent value="audit" className="pt-4">
          <TabAudit request={request} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
