// Database admin config for catalogue items: what the catalogue page lists and
// what intake matches a demand against. Maintained here because nothing else
// could — the save and delete hooks existed and no screen used them.

import type { Column } from '@/components/shared/data-table';
import type { CatalogueItem } from '@/data/catalogue-items';
import type { EntityConfig } from './types';

type CatalogueRow = CatalogueItem & Record<string, unknown>;

const columns: Column<CatalogueRow>[] = [
  { key: 'id', label: 'ID', sortable: true, className: 'font-mono text-xs' },
  { key: 'name', label: 'Item', sortable: true },
  { key: 'catalogueName', label: 'Catalogue', sortable: true },
  { key: 'supplierName', label: 'Supplier', sortable: true },
  {
    key: 'unitPrice',
    label: 'Unit price',
    sortable: true,
    className: 'tabular-nums',
    render: (i) => `€${i.unitPrice.toLocaleString('en-IE')} / ${i.unit}`,
  },
  { key: 'leadTime', label: 'Lead time' },
  // Unavailable items stay listed here — hidden, they could not be put back.
  { key: 'available', label: 'Orderable', render: (i) => (i.available === false ? 'No' : 'Yes') },
];

export const catalogueItemsConfig: EntityConfig<'catalogueItem'> = {
  key: 'catalogueItem',
  columns,
  getId: (i) => i.id,
  getDisplayLabel: (i) => `${i.id} — ${i.name}`,
  defaultNew: () => ({
    id: `CAT-${Math.floor(Math.random() * 90000 + 10000)}`,
    name: '',
    description: '',
    unitPrice: 0,
    unit: 'each',
    catalogueId: '',
    catalogueName: '',
    supplierName: '',
    supplierId: '',
    leadTime: '',
    available: true,
  }),
  fields: [
    { key: 'id', label: 'ID', type: 'text', required: true, readOnly: true },
    { key: 'name', label: 'Item name', type: 'text', required: true },
    // Intake matches a demand against the name and description, so both are
    // what makes an item findable.
    { key: 'description', label: 'Description', type: 'textarea', required: true },
    { key: 'unitPrice', label: 'Unit price (EUR)', type: 'number', required: true, min: 0 },
    { key: 'unit', label: 'Unit', type: 'text', required: true },
    { key: 'catalogueId', label: 'Catalogue ID', type: 'text', required: true },
    { key: 'catalogueName', label: 'Catalogue name', type: 'text', required: true },
    { key: 'supplierId', label: 'Supplier ID', type: 'text', required: true },
    { key: 'supplierName', label: 'Supplier name', type: 'text', required: true },
    { key: 'leadTime', label: 'Lead time', type: 'text' },
    // Checkout refuses an item without an active contract and a risk
    // assessment, so these links are what make an item actually orderable.
    { key: 'contractId', label: 'Contract ID', type: 'text' },
    { key: 'riskAssessmentId', label: 'Risk assessment ID', type: 'text' },
    { key: 'commodityCode', label: 'Commodity code', type: 'text' },
    { key: 'available', label: 'Orderable', type: 'boolean' },
  ],
  filters: [],
};
