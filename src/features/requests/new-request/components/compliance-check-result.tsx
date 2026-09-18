import { CheckCircle, AlertTriangle } from 'lucide-react';

interface ComplianceCheckResultProps {
  label: string;
  passed: boolean;
  detail: string;
}

export function ComplianceCheckResult({ label, passed, detail }: ComplianceCheckResultProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-line bg-card p-4">
      {passed ? (
        <CheckCircle className="mt-0.5 size-5 shrink-0 text-ok" />
      ) : (
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warn" />
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="mt-0.5 text-sm text-ink-2">{detail}</p>
      </div>
    </div>
  );
}
