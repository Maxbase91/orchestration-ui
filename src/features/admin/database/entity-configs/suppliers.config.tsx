import type { Column } from '@/components/shared/data-table';
import type { Supplier } from '@/data/types';
import type { EntityConfig } from './types';

type SupplierRow = Supplier & Record<string, unknown>;

const columns: Column<SupplierRow>[] = [
  { key: 'id', label: 'ID', sortable: true, className: 'font-mono text-xs' },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'country', label: 'Country', sortable: true },
  {
    key: 'riskRating',
    label: 'Risk',
    sortable: true,
    render: (s) => (
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
          s.riskRating === 'low'
            ? 'bg-green-100 text-green-700'
            : s.riskRating === 'medium'
              ? 'bg-amber-100 text-amber-700'
              : s.riskRating === 'high'
                ? 'bg-orange-100 text-orange-700'
                : 'bg-red-100 text-red-700'
        }`}
      >
        {s.riskRating}
      </span>
    ),
  },
  { key: 'tier', label: 'Tier', sortable: true },
  {
    key: 'sraStatus',
    label: 'SRA',
    sortable: true,
    render: (s) => (
      <span className="text-xs text-gray-700">
        {s.sraStatus}
        {s.sraExpiryDate ? ` (${s.sraExpiryDate})` : ''}
      </span>
    ),
  },
  { key: 'activeContracts', label: 'Contracts', sortable: true },
  {
    key: 'totalSpend12m',
    label: 'Spend 12m',
    sortable: true,
    render: (s) => `€${s.totalSpend12m.toLocaleString()}`,
  },
];

export const suppliersConfig: EntityConfig<'supplier'> = {
  key: 'supplier',
  columns,
  getId: (s) => s.id,
  getDisplayLabel: (s) => `${s.id} — ${s.name}`,
  defaultNew: () => ({
    id: `SUP-${Math.floor(Math.random() * 9000 + 1000)}`,
    name: '',
    country: '',
    countryCode: '',
    riskRating: 'low',
    activeContracts: 0,
    totalSpend12m: 0,
    onboardingStatus: 'not-started',
    sraStatus: 'not-assessed',
    screeningStatus: 'pending',
    categories: [],
    tier: 3,
    duns: '',
    address: '',
    primaryContact: '',
    primaryContactEmail: '',
    certifications: [],
    spendHistory: [],
    performanceScore: 0,
  }),
  fields: [
    { key: 'id', label: 'ID', type: 'text', required: true, readOnly: true },
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'country', label: 'Country', type: 'text' },
    { key: 'countryCode', label: 'Country Code (ISO)', type: 'text' },
    {
      key: 'riskRating',
      label: 'Risk Rating',
      type: 'select',
      required: true,
      options: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
        { value: 'critical', label: 'Critical' },
      ],
    },
    {
      key: 'tier',
      label: 'Tier',
      type: 'select',
      required: true,
      options: [
        { value: '1', label: 'Tier 1' },
        { value: '2', label: 'Tier 2' },
        { value: '3', label: 'Tier 3' },
      ],
    },
    {
      key: 'onboardingStatus',
      label: 'Onboarding Status',
      type: 'select',
      options: [
        { value: 'completed', label: 'Completed' },
        { value: 'in-progress', label: 'In progress' },
        { value: 'not-started', label: 'Not started' },
      ],
    },
    {
      key: 'sraStatus',
      label: 'SRA Status',
      type: 'select',
      options: [
        { value: 'valid', label: 'Valid' },
        { value: 'expiring', label: 'Expiring' },
        { value: 'expired', label: 'Expired' },
        { value: 'not-assessed', label: 'Not assessed' },
      ],
    },
    { key: 'sraExpiryDate', label: 'SRA Expiry Date', type: 'date' },
    {
      key: 'screeningStatus',
      label: 'Screening Status',
      type: 'select',
      options: [
        { value: 'clear', label: 'Clear' },
        { value: 'flagged', label: 'Flagged' },
        { value: 'pending', label: 'Pending' },
      ],
    },
    { key: 'activeContracts', label: 'Active contracts (count)', type: 'number', min: 0 },
    { key: 'totalSpend12m', label: 'Spend 12m (EUR)', type: 'number', min: 0 },
    { key: 'duns', label: 'D-U-N-S', type: 'text' },
    { key: 'address', label: 'Address', type: 'textarea' },
    { key: 'primaryContact', label: 'Primary Contact', type: 'text' },
    { key: 'primaryContactEmail', label: 'Contact Email', type: 'text' },
    { key: 'performanceScore', label: 'Performance Score (0-100)', type: 'number', min: 0, max: 100 },
  ],
  filters: [
    {
      key: 'riskRating',
      label: 'Risk',
      options: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
        { value: 'critical', label: 'Critical' },
      ],
      predicate: (s, v) => s.riskRating === v,
    },
    {
      key: 'onboardingStatus',
      label: 'Onboarding',
      options: [
        { value: 'completed', label: 'Completed' },
        { value: 'in-progress', label: 'In progress' },
        { value: 'not-started', label: 'Not started' },
      ],
      predicate: (s, v) => s.onboardingStatus === v,
    },
  ],
};
