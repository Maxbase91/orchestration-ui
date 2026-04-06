import { cn } from '@/lib/utils';

interface WorkflowStep {
  label: string;
  owner: string;
  parallel?: boolean;
}

interface WorkflowPreviewProps {
  steps: WorkflowStep[];
}

export function WorkflowPreview({ steps }: WorkflowPreviewProps) {
  return (
    <div className="flex items-start w-full overflow-x-auto py-2">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;

        return (
          <div
            key={step.label}
            className={cn('flex items-start flex-1 min-w-0', !isLast && 'flex-shrink-0')}
          >
            <div className="flex flex-col items-center">
              <div className="flex size-8 items-center justify-center rounded-full border-2 border-blue-200 bg-blue-50 text-xs font-medium text-blue-600">
                {index + 1}
              </div>
              <p className="mt-1.5 text-xs text-center max-w-[90px] leading-tight font-medium text-gray-700">
                {step.label}
              </p>
              <p className="mt-0.5 text-[10px] text-center max-w-[90px] text-gray-500">
                {step.owner}
              </p>
              {step.parallel && (
                <span className="mt-0.5 inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-medium text-blue-600">
                  parallel
                </span>
              )}
            </div>
            {!isLast && (
              <div className="mt-4 h-0.5 flex-1 mx-1 bg-blue-200" />
            )}
          </div>
        );
      })}
    </div>
  );
}
