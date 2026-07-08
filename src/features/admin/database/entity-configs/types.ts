// Contract every entity config in this directory implements. The database admin
// browser is fully driven by these configs: `columns` render the table,
// `fields` generate the edit form, `filters` the toolbar, and `defaultNew`
// seeds a fresh record. `renderComplexFields` is the escape hatch for nested
// structures the generic form can't express.

import type { ReactNode } from 'react';
import type { Column } from '@/components/shared/data-table';
import type { EntityKey, EntityRecordMap } from '@/stores/database-admin-store';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'boolean'
  | 'select'
  | 'multi-select';

export interface FieldConfig {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  readOnly?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  helpText?: string;
  min?: number;
  max?: number;
}

export interface EntityConfig<K extends EntityKey> {
  key: K;
  columns: Column<EntityRecordMap[K] & Record<string, unknown>>[];
  fields: FieldConfig[];
  getId: (record: EntityRecordMap[K]) => string;
  getDisplayLabel: (record: EntityRecordMap[K]) => string;
  defaultNew: () => Partial<EntityRecordMap[K]>;
  filters?: {
    key: string;
    label: string;
    options: { value: string; label: string }[];
    predicate: (record: EntityRecordMap[K], value: string) => boolean;
  }[];
  renderComplexFields?: (args: {
    record: EntityRecordMap[K];
    draft: Partial<EntityRecordMap[K]>;
    setDraft: (patch: Partial<EntityRecordMap[K]>) => void;
  }) => ReactNode;
  readOnlyReason?: string;
}
