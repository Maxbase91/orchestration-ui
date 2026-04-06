import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OOOWarningProps {
  approverName: string;
  delegateName: string;
  onAcceptDelegate: () => void;
  onDismiss: () => void;
}

export function OOOWarning({
  approverName,
  delegateName,
  onAcceptDelegate,
  onDismiss,
}: OOOWarningProps) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-amber-800">
            This approval requires <span className="font-medium">{approverName}</span> who is
            currently OOO. Would you like to route to their delegate{' '}
            <span className="font-medium">{delegateName}</span>?
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" variant="default" onClick={onAcceptDelegate}>
              Route to delegate
            </Button>
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
