// The context a form's trigger conditions are evaluated against.
//
// Lives here rather than inline in the renderer because the blocking gate has
// to build the identical shape. It was inline, the blocking gate built nothing,
// and the two gates disagreed about which forms a stage was asking for.
//
// `riskRating`, `material` and `region` are in the routing vocabulary and are
// deliberately absent: the request record carries no equivalent, so supplying
// a guess here would make a condition on them quietly true rather than
// quietly false. `diagnoseFormTemplate` reports a condition on a field nothing
// supplies, which is the honest answer.
import { useMemo } from 'react';
import type { ProcurementRequest } from '@/data/types';
import type { FormTriggerContext } from './form-triggers';

export function useFormTriggerContext(
  request: ProcurementRequest | undefined,
  fallbackCategory?: string,
): FormTriggerContext {
  return useMemo(() => ({
    category: request?.category ?? fallbackCategory,
    value: request?.value,
    supplierId: request?.supplierId,
    commodityCode: request?.commodityCode,
    priority: request?.priority,
    isUrgent: request?.isUrgent,
    contractId: request?.contractId,
  }), [request, fallbackCategory]);
}
