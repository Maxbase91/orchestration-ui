import { useNavigate } from 'react-router-dom';
import {
  FileText,
  FileCheck,
  Users,
  TrendingDown,
  Search as SearchIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';

interface Template {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  timeline: string;
  usedCount: number;
}

const templates: Template[] = [
  {
    id: 'simple-rfq',
    name: 'Simple RFQ',
    description: 'Quick quotation request for straightforward purchases',
    icon: <FileText className="size-6 text-blue-600" />,
    timeline: '1-2 weeks',
    usedCount: 34,
  },
  {
    id: 'full-rfp',
    name: 'Full RFP',
    description:
      'Comprehensive request for proposal with detailed requirements',
    icon: <FileCheck className="size-6 text-purple-600" />,
    timeline: '4-8 weeks',
    usedCount: 18,
  },
  {
    id: 'framework-mini',
    name: 'Framework Mini-Competition',
    description: 'Competition among framework suppliers',
    icon: <Users className="size-6 text-green-600" />,
    timeline: '2-3 weeks',
    usedCount: 12,
  },
  {
    id: 'reverse-auction',
    name: 'Reverse Auction',
    description: 'Price-driven competitive bidding event',
    icon: <TrendingDown className="size-6 text-amber-600" />,
    timeline: '1-3 days',
    usedCount: 7,
  },
  {
    id: 'eoi',
    name: 'Expression of Interest',
    description: 'Market sounding to identify potential suppliers',
    icon: <SearchIcon className="size-6 text-teal-600" />,
    timeline: '2-4 weeks',
    usedCount: 9,
  },
];

export function SourcingTemplatesPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sourcing Templates"
        subtitle="Choose a template to get started quickly"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <Card
            key={template.id}
            className="flex flex-col justify-between p-6 space-y-4"
          >
            <div className="space-y-3">
              <div className="flex size-12 items-center justify-center rounded-lg bg-gray-50">
                {template.icon}
              </div>
              <div>
                <h3 className="font-medium text-gray-900">{template.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {template.description}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Typical: {template.timeline}</span>
                <span>Used {template.usedCount} times</span>
              </div>
            </div>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => navigate('/sourcing/new')}
            >
              Use Template
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
