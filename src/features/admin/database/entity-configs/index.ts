import type { EntityKey, EntityRecordMap } from '@/stores/database-admin-store';
import type { EntityConfig } from './types';
import { suppliersConfig } from './suppliers.config';
import { contractsConfig } from './contracts.config';
import { riskAssessmentsConfig } from './risk-assessments.config';
import { purchaseOrdersConfig } from './purchase-orders.config';
import { invoicesConfig } from './invoices.config';
import { requestsConfig } from './requests.config';
import { approvalsConfig } from './approvals.config';
import { workflowsConfig } from './workflows.config';

export const entityConfigs = {
  supplier: suppliersConfig,
  contract: contractsConfig,
  riskAssessment: riskAssessmentsConfig,
  purchaseOrder: purchaseOrdersConfig,
  invoice: invoicesConfig,
  request: requestsConfig,
  approval: approvalsConfig,
  workflow: workflowsConfig,
} satisfies { [K in EntityKey]: EntityConfig<K> };

export function getDisplayLabel<K extends EntityKey>(
  key: K,
  record: EntityRecordMap[K],
): string {
  const cfg = entityConfigs[key] as unknown as EntityConfig<K>;
  return cfg.getDisplayLabel(record);
}

export type { EntityConfig } from './types';
