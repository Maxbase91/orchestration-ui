import { CheckCircle, AlertTriangle } from 'lucide-react';

interface ComplianceCheckResultProps {
  label: string;
  passed: boolean;
  detail: string;
}

export function ComplianceCheckResult({ label, passed, detail }: ComplianceCheckResultProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4">
      {passed ? (
        <CheckCircle className="mt-0.5 size-5 shrink-0 text-green-500" />
      ) : (
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" />
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="mt-0.5 text-sm text-gray-600">{detail}</p>
      </div>
    </div>
  );
}
