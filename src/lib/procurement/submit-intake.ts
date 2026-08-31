// Client seam for full adaptive intake. All related records are committed by
// the server in one transaction; this module only transports the confirmed
// structured payload and surfaces field-level validation errors.
import type { ProcurementRequest } from '@/data/types';
import type { IntakeComplianceRecord } from '@/data/request-compliance';
import type { ServiceDescriptionRecord } from '@/lib/db/mappers';

export interface SubmitIntakeInput {
  request: Partial<ProcurementRequest> & { id: string };
  serviceDescription?: Omit<ServiceDescriptionRecord, 'requestId'>;
  compliance?: Omit<IntakeComplianceRecord, 'requestId'>;
  workflowTemplateId?: string;
  buyingChannel?: string;
  idempotencyKey?: string;
}

export interface SubmitIntakeResult { requestId: string; status: string; stage: string; replay?: boolean }

export class IntakeSubmitError extends Error {
  readonly code: string;
  readonly fields?: Record<string, string>;
  constructor(message: string, code: string, fields?: Record<string, string>) { super(message); this.code = code; this.fields = fields; }
}

export async function submitIntake(input: SubmitIntakeInput): Promise<SubmitIntakeResult> {
  const response = await fetch('/api/intake-submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.json() as Partial<SubmitIntakeResult> & { error?: string; code?: string; fields?: Record<string, string> };
  if (!response.ok) throw new IntakeSubmitError(body.error ?? 'Could not submit request. Please check the highlighted fields.', body.code ?? 'intake_submit_failed', body.fields);
  if (!body.requestId || !body.status || !body.stage) throw new IntakeSubmitError('The server did not confirm the submitted request.', 'invalid_response');
  return body as SubmitIntakeResult;
}
