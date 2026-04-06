import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AISuggestionCard } from '@/components/shared/ai-suggestion-card';
import type { Supplier } from '@/data/types';
import { getAISummary } from '@/lib/mock-ai';

interface ProfileOverviewTabProps {
  supplier: Supplier;
}

export function ProfileOverviewTab({ supplier }: ProfileOverviewTabProps) {
  const aiSummary = getAISummary('supplier', supplier.id);

  return (
    <div className="space-y-6">
      <AISuggestionCard title="AI Summary" confidence={0.92}>
        <p>{aiSummary}</p>
      </AISuggestionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="py-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Company Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium text-gray-900">{supplier.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Address</dt>
                <dd className="font-medium text-gray-900 text-right max-w-[60%]">{supplier.address}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">D&B Number</dt>
                <dd className="font-medium text-gray-900">{supplier.duns}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Primary Contact</dt>
                <dd className="font-medium text-gray-900">{supplier.primaryContact}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Contact Email</dt>
                <dd className="font-medium text-gray-900">{supplier.primaryContactEmail}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tier</dt>
                <dd className="font-medium text-gray-900">Tier {supplier.tier}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="py-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {supplier.categories.map((cat) => (
                <Badge key={cat} variant="secondary" className="text-xs">
                  {cat}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
