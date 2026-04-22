import { useMemo } from 'react';
import { CheckCircle } from 'lucide-react';
import { useRequests } from '@/lib/db/hooks/use-requests';
import { ValidationQueueCard } from '../components/validation-queue-card';

export function WidgetValidationQueue() {
  const { data: requests = [] } = useRequests();
  const queue = useMemo(
    () => requests.filter((r) => r.status === 'validation').slice(0, 5),
    [requests],
  );

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
        <CheckCircle className="size-10 mb-2" />
        <p className="text-sm font-medium">Queue is clear</p>
        <p className="text-xs">No requests pending validation.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {queue.map((r) => (
        <ValidationQueueCard key={r.id} request={r} />
      ))}
    </div>
  );
}
