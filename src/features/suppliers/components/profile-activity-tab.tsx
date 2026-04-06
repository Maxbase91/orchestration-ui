import { FileSignature, ShoppingCart, CreditCard, ShieldCheck, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Supplier } from '@/data/types';

interface ActivityEvent {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  timestamp: string;
  color: string;
}

function getMockActivity(supplier: Supplier): ActivityEvent[] {
  return [
    {
      id: 'act-1',
      icon: FileSignature,
      title: 'Contract Signed',
      description: `New contract with ${supplier.name} executed.`,
      timestamp: '2024-12-15',
      color: 'text-green-600 bg-green-50',
    },
    {
      id: 'act-2',
      icon: ShoppingCart,
      title: 'Request Submitted',
      description: `Procurement request raised for ${supplier.categories[0] ?? 'services'}.`,
      timestamp: '2024-11-20',
      color: 'text-blue-600 bg-blue-50',
    },
    {
      id: 'act-3',
      icon: CreditCard,
      title: 'Payment Processed',
      description: `Invoice payment of EUR 85,000 completed.`,
      timestamp: '2024-11-05',
      color: 'text-amber-600 bg-amber-50',
    },
    {
      id: 'act-4',
      icon: ShieldCheck,
      title: 'Risk Assessment Completed',
      description: `TPRA completed with rating: ${supplier.riskRating}.`,
      timestamp: '2024-10-10',
      color: 'text-purple-600 bg-purple-50',
    },
    {
      id: 'act-5',
      icon: MessageSquare,
      title: 'Communication Sent',
      description: `Compliance questionnaire sent to ${supplier.primaryContact}.`,
      timestamp: '2024-09-25',
      color: 'text-gray-600 bg-gray-50',
    },
    {
      id: 'act-6',
      icon: FileSignature,
      title: 'Contract Renewed',
      description: `Framework agreement renewal processed.`,
      timestamp: '2024-08-12',
      color: 'text-green-600 bg-green-50',
    },
    {
      id: 'act-7',
      icon: CreditCard,
      title: 'Payment Processed',
      description: `Invoice payment of EUR 120,000 completed.`,
      timestamp: '2024-07-28',
      color: 'text-amber-600 bg-amber-50',
    },
  ];
}

interface ProfileActivityTabProps {
  supplier: Supplier;
}

export function ProfileActivityTab({ supplier }: ProfileActivityTabProps) {
  const activities = getMockActivity(supplier);

  return (
    <Card className="py-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Activity Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-0">
          {activities.map((event, index) => {
            const Icon = event.icon;
            const isLast = index === activities.length - 1;
            return (
              <div key={event.id} className="relative flex gap-4 pb-6">
                {/* Vertical line */}
                {!isLast && (
                  <div className="absolute left-[15px] top-8 h-[calc(100%-16px)] w-px bg-border" />
                )}
                {/* Icon */}
                <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${event.color}`}>
                  <Icon className="size-4" />
                </div>
                {/* Content */}
                <div className="pt-0.5">
                  <p className="text-sm font-medium text-gray-900">{event.title}</p>
                  <p className="text-xs text-muted-foreground">{event.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{event.timestamp}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
