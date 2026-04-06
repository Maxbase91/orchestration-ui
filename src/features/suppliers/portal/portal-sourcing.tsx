import { Calendar, Clock, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/status-badge';

interface SourcingEvent {
  id: string;
  title: string;
  category: string;
  deadline: string;
  status: 'open' | 'closed' | 'awarded';
  description: string;
}

const activeEvents: SourcingEvent[] = [
  {
    id: 'EVT-001',
    title: 'IT Strategy Advisory Services 2025',
    category: 'IT Consulting',
    deadline: '2025-03-15',
    status: 'open',
    description: 'Request for proposal for strategic IT consulting services covering cloud migration, digital transformation, and technology roadmap development.',
  },
  {
    id: 'EVT-002',
    title: 'Cybersecurity Assessment Framework',
    category: 'Security Services',
    deadline: '2025-02-28',
    status: 'open',
    description: 'Invitation to participate in sourcing for annual penetration testing and security assessment services.',
  },
  {
    id: 'EVT-003',
    title: 'Application Modernisation Programme',
    category: 'Software Development',
    deadline: '2025-04-01',
    status: 'open',
    description: 'Multi-year programme for legacy application modernisation and cloud-native re-architecture.',
  },
];

const pastEvents: SourcingEvent[] = [
  {
    id: 'EVT-P01',
    title: 'ERP Support Services 2024',
    category: 'Enterprise Software',
    deadline: '2024-09-15',
    status: 'awarded',
    description: 'ERP managed support and enhancement services.',
  },
  {
    id: 'EVT-P02',
    title: 'Data Centre Migration RFP',
    category: 'Infrastructure',
    deadline: '2024-06-30',
    status: 'closed',
    description: 'Physical to cloud data centre migration project.',
  },
];

function EventCard({ event, isPast }: { event: SourcingEvent; isPast?: boolean }) {
  return (
    <Card className="py-4">
      <CardContent>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-gray-900">{event.title}</h3>
              <Badge variant="secondary" className="text-xs">{event.category}</Badge>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{event.description}</p>
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="size-3" />
                Deadline: {event.deadline}
              </span>
              <StatusBadge status={event.status} size="sm" />
            </div>
          </div>
          {!isPast && (
            <Button size="sm" className="shrink-0">
              <Clock className="size-3.5" />
              Respond
            </Button>
          )}
          {isPast && event.status === 'awarded' && (
            <div className="flex items-center gap-1 text-xs text-green-700">
              <CheckCircle2 className="size-3.5" />
              Awarded
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function PortalSourcing() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Sourcing Events</h1>

      <div>
        <h2 className="text-sm font-medium text-gray-900 mb-3">Active Invitations</h2>
        <div className="space-y-3">
          {activeEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium text-gray-900 mb-3">Past Events</h2>
        <div className="space-y-3">
          {pastEvents.map((event) => (
            <EventCard key={event.id} event={event} isPast />
          ))}
        </div>
      </div>
    </div>
  );
}
