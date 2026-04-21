import type { Column } from '@/components/shared/data-table';
import type { RiskAssessment } from '@/data/types';
import type { EntityConfig } from './types';

type RARow = RiskAssessment & Record<string, unknown>;

const columns: Column<RARow>[] = [
  { key: 'id', label: 'ID', sortable: true, className: 'font-mono text-xs' },
  { key: 'title', label: 'Title', sortable: true },
  { key: 'subjectType', label: 'Subject', sortable: true },
  { key: 'category', label: 'Category', sortable: true },
  {
    key: 'riskLevel',
    label: 'Risk Level',
    sortable: true,
    render: (r) => (
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
          r.riskLevel === 'low'
            ? 'bg-green-100 text-green-700'
            : r.riskLevel === 'medium'
              ? 'bg-amber-100 text-amber-700'
              : r.riskLevel === 'high'
                ? 'bg-orange-100 text-orange-700'
                : 'bg-red-100 text-red-700'
        }`}
      >
        {r.riskLevel}
      </span>
    ),
  },
  { key: 'score', label: 'Score', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'validUntil', label: 'Valid until', sortable: true },
  {
    key: 'reusable',
    label: 'Reusable',
    sortable: true,
    render: (r) =>
      r.reusable ? (
        <span className="text-green-700 text-xs font-medium">Yes</span>
      ) : (
        <span className="text-gray-400 text-xs">No</span>
      ),
  },
];

export const riskAssessmentsConfig: EntityConfig<'riskAssessment'> = {
  key: 'riskAssessment',
  columns,
  getId: (r) => r.id,
  getDisplayLabel: (r) => `${r.id} — ${r.title}`,
  defaultNew: () => ({
    id: `RA-${Math.floor(Math.random() * 9000 + 1000)}`,
    title: '',
    subjectType: 'supplier',
    category: 'security',
    riskLevel: 'low',
    score: 0,
    status: 'draft',
    assessorId: '',
    assessorName: '',
    assessedAt: new Date().toISOString(),
    validUntil: '',
    summary: '',
    mitigations: [],
    reusable: false,
    linkedRequestIds: [],
  }),
  fields: [
    { key: 'id', label: 'ID', type: 'text', required: true, readOnly: true },
    { key: 'title', label: 'Title', type: 'text', required: true },
    {
      key: 'subjectType',
      label: 'Subject Type',
      type: 'select',
      required: true,
      options: [
        { value: 'supplier', label: 'Supplier' },
        { value: 'contract', label: 'Contract' },
      ],
    },
    { key: 'supplierId', label: 'Supplier ID (SUP-xxx)', type: 'text', helpText: 'Leave blank if assessment is contract-scoped only' },
    { key: 'contractId', label: 'Contract ID (CON-xxx)', type: 'text', helpText: 'Required when subject type is contract' },
    {
      key: 'category',
      label: 'Category',
      type: 'select',
      required: true,
      options: [
        { value: 'security', label: 'Security' },
        { value: 'financial', label: 'Financial' },
        { value: 'operational', label: 'Operational' },
        { value: 'data-privacy', label: 'Data privacy' },
        { value: 'compliance', label: 'Compliance' },
        { value: 'esg', label: 'ESG' },
      ],
    },
    {
      key: 'riskLevel',
      label: 'Risk Level',
      type: 'select',
      required: true,
      options: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
        { value: 'critical', label: 'Critical' },
      ],
    },
    { key: 'score', label: 'Score (0-100)', type: 'number', min: 0, max: 100 },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      required: true,
      options: [
        { value: 'draft', label: 'Draft' },
        { value: 'in-review', label: 'In review' },
        { value: 'completed', label: 'Completed' },
        { value: 'expired', label: 'Expired' },
      ],
    },
    { key: 'assessorId', label: 'Assessor User ID', type: 'text' },
    { key: 'assessorName', label: 'Assessor Name', type: 'text' },
    { key: 'assessedAt', label: 'Assessed At (ISO)', type: 'text' },
    { key: 'validUntil', label: 'Valid Until', type: 'date', required: true },
    { key: 'summary', label: 'Summary', type: 'textarea' },
    {
      key: 'reusable',
      label: 'Reusable during intake',
      type: 'boolean',
      helpText: 'If on, this assessment is surfaced to requesters during validation when their supplier/contract matches.',
    },
  ],
  filters: [
    {
      key: 'category',
      label: 'Category',
      options: [
        { value: 'security', label: 'Security' },
        { value: 'financial', label: 'Financial' },
        { value: 'operational', label: 'Operational' },
        { value: 'data-privacy', label: 'Data privacy' },
        { value: 'compliance', label: 'Compliance' },
        { value: 'esg', label: 'ESG' },
      ],
      predicate: (r, v) => r.category === v,
    },
    {
      key: 'riskLevel',
      label: 'Risk Level',
      options: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
        { value: 'critical', label: 'Critical' },
      ],
      predicate: (r, v) => r.riskLevel === v,
    },
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'draft', label: 'Draft' },
        { value: 'in-review', label: 'In review' },
        { value: 'completed', label: 'Completed' },
        { value: 'expired', label: 'Expired' },
      ],
      predicate: (r, v) => r.status === v,
    },
  ],
};
