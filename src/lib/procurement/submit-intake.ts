// Client seam for full adaptive intake. All related records are committed by
// the server in one transaction; this module only transports the confirmed
// structured payload and surfaces field-level validation errors — and, when the
// server's own decision differs from the one the requester reviewed
// (`determination_changed`), what changed.
import type { ProcurementRequest } from '@/data/types';
import type { IntakeComplianceRecord } from '@/data/request-compliance';
import type { ServiceDescriptionRecord } from '@/lib/db/mappers';

export interface SubmitIntakeInput {
  request: Partial<ProcurementRequest> & { id: string };
  serviceDescription?: Omit<ServiceDescriptionRecord, 'requestId'>;
  compliance?: Omit<IntakeComplianceRecord, 'requestId'>;
  workflowTemplateId?: string;
  buyingChannel?: string;
  /**
   * The answers to the two risk questions, as the determination read them.
   * The server decides the demand again and needs them as inputs; they are
   * not in the request record.
   */
  riskAnswers?: { privilegedAccess?: boolean; criticalService?: boolean };
  idempotencyKey?: string;
}

export interface SubmitIntakeResult { requestId: string; status: string; stage: string; replay?: boolean }

export class IntakeSubmitError extends Error {
  readonly code: string;
  readonly fields?: Record<string, string>;
  /** For `determination_changed`: each difference, as a sentence. */
  readonly changes: string[];
  constructor(message: string, code: string, fields?: Record<string, string>, changes: string[] = []) {
    super(message); this.code = code; this.fields = fields; this.changes = changes;
  }
}

export async function submitIntake(input: SubmitIntakeInput): Promise<SubmitIntakeResult> {
  const response = await fetch('/api/intake-submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.json() as Partial<SubmitIntakeResult> & { error?: string; code?: string; fields?: Record<string, string>; changes?: unknown };
  const changes = Array.isArray(body.changes) ? body.changes.filter((change): change is string => typeof change === 'string') : [];
  if (!response.ok) throw new IntakeSubmitError(body.error ?? 'Could not submit request. Please check the highlighted fields.', body.code ?? 'intake_submit_failed', body.fields, changes);
  if (!body.requestId || !body.status || !body.stage) throw new IntakeSubmitError('The server did not confirm the submitted request.', 'invalid_response');
  return body as SubmitIntakeResult;
}
