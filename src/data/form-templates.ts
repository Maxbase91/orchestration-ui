// Shared types + mock seed for form templates.
// The `formTemplates` array is seed-only (Wave 2 migrated reads to
// `@/lib/db/hooks/use-form-templates`); types remain here for direct import.

export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'multi-select'
  | 'radio'
  | 'checkbox'
  | 'date'
  | 'file-upload'
  | 'separator'
  | 'info-text';

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FormField {
  id: string;
  fieldType: FormFieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  helpText?: string;
  options?: FormFieldOption[];
  defaultValue?: string;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
  prePopulateFrom?: string;
  infoContent?: string;
  width?: 'full' | 'half';
}

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'draft' | 'disabled';
  category: string;
  triggerStages: string[];
  triggerConditions?: { field: string; operator: string; value: string }[];
  fields: FormField[];
  version: string;
  lastModified: string;
  createdBy: string;
}

export const formTemplates: FormTemplate[] = [
  // ── 1. Risk Assessment Triage ──────────────────────────────────────
  {
    id: 'FORM-001',
    name: 'Risk Assessment Triage',
    description:
      'Quick triage to determine whether a full Supplier Risk Assessment (SRA) is required for this engagement.',
    status: 'active',
    category: 'Risk',
    triggerStages: ['validation'],
    version: '1.2',
    lastModified: '2024-11-10T09:00:00Z',
    createdBy: 'u1',
    fields: [
      {
        id: 'f001-sep',
        fieldType: 'separator',
        label: 'Supplier Risk Triage',
        required: false,
      },
      {
        id: 'f001-info',
        fieldType: 'info-text',
        label: '',
        required: false,
        infoContent:
          'This short assessment determines whether a full Supplier Risk Assessment is required. Please answer all questions based on the current engagement scope.',
      },
      {
        id: 'f001-registered',
        fieldType: 'select',
        label: 'Is the supplier already registered?',
        required: true,
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ],
        width: 'half',
      },
      {
        id: 'f001-sra-status',
        fieldType: 'select',
        label: 'Does the supplier have a valid SRA?',
        required: true,
        prePopulateFrom: 'sraStatus',
        options: [
          { value: 'yes-valid', label: 'Yes - valid' },
          { value: 'yes-expiring', label: 'Yes - expiring within 90 days' },
          { value: 'no', label: 'No' },
          { value: 'unknown', label: 'Unknown' },
        ],
        width: 'half',
      },
      {
        id: 'f001-annual-spend',
        fieldType: 'number',
        label: 'Estimated annual spend with this supplier (EUR)',
        required: true,
        prePopulateFrom: 'value',
        placeholder: '0',
        validation: { min: 0 },
        width: 'half',
      },
      {
        id: 'f001-data-sensitivity',
        fieldType: 'radio',
        label: 'Data sensitivity level',
        required: true,
        helpText: 'Select the highest classification of data the supplier will access.',
        options: [
          { value: 'none', label: 'None' },
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
          { value: 'critical', label: 'Critical' },
        ],
      },
      {
        id: 'f001-premises',
        fieldType: 'radio',
        label: 'Will the supplier have access to company premises?',
        required: true,
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ],
        width: 'half',
      },
      {
        id: 'f001-high-risk-jurisdiction',
        fieldType: 'checkbox',
        label: 'Supplier operates in a high-risk jurisdiction',
        required: false,
        helpText:
          'Refer to the corporate sanctions list and FATF grey/black-list countries.',
      },
      {
        id: 'f001-notes',
        fieldType: 'textarea',
        label: 'Additional risk considerations',
        required: false,
        placeholder: 'Enter any additional context relevant to the risk assessment...',
        validation: { maxLength: 2000 },
      },
    ],
  },

  // ── 2. Full Risk Questionnaire ─────────────────────────────────────
  {
    id: 'FORM-002',
    name: 'Full Risk Questionnaire',
    description:
      'Comprehensive supplier risk assessment for engagements that exceed the triage thresholds.',
    status: 'active',
    category: 'Risk',
    triggerStages: ['validation'],
    version: '2.0',
    lastModified: '2024-12-01T14:30:00Z',
    createdBy: 'u1',
    fields: [
      {
        id: 'f002-sep',
        fieldType: 'separator',
        label: 'Supplier Risk Assessment',
        required: false,
      },
      {
        id: 'f002-info',
        fieldType: 'info-text',
        label: '',
        required: false,
        infoContent:
          'Complete this form for suppliers requiring a full risk assessment. All mandatory fields must be completed before the request can proceed to sourcing.',
      },
      {
        id: 'f002-legal-entity',
        fieldType: 'text',
        label: 'Supplier legal entity name',
        required: true,
        prePopulateFrom: 'supplierName',
        placeholder: 'Full legal entity name as per company register',
        width: 'half',
      },
      {
        id: 'f002-country',
        fieldType: 'text',
        label: 'Country of incorporation',
        required: true,
        placeholder: 'e.g. Germany',
        width: 'half',
      },
      {
        id: 'f002-category',
        fieldType: 'select',
        label: 'Primary service/goods category',
        required: true,
        prePopulateFrom: 'category',
        options: [
          { value: 'goods', label: 'Goods' },
          { value: 'services', label: 'Services' },
          { value: 'software', label: 'Software' },
          { value: 'consulting', label: 'Consulting' },
          { value: 'contingent-labour', label: 'Contingent Labour' },
          { value: 'contract-renewal', label: 'Contract Renewal' },
        ],
        width: 'half',
      },
      {
        id: 'f002-personal-data',
        fieldType: 'radio',
        label: 'Does the supplier handle personal data?',
        required: true,
        helpText: 'Personal data as defined under GDPR Art. 4(1).',
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ],
        width: 'half',
      },
      {
        id: 'f002-data-volume',
        fieldType: 'select',
        label: 'Data processing volume',
        required: true,
        options: [
          { value: 'none', label: 'None' },
          { value: 'low', label: 'Low (< 1,000 records)' },
          { value: 'medium', label: 'Medium (1,000 - 100,000 records)' },
          { value: 'high', label: 'High (> 100,000 records)' },
        ],
        width: 'half',
      },
      {
        id: 'f002-subcontractors',
        fieldType: 'checkbox',
        label: 'Supplier uses subcontractors for delivery',
        required: false,
        helpText: 'If checked, the subcontractor assessment addendum will be required.',
      },
      {
        id: 'f002-bcp',
        fieldType: 'textarea',
        label: 'Business continuity arrangements',
        required: true,
        placeholder:
          'Describe the supplier\'s disaster recovery and business continuity measures...',
        validation: { minLength: 50, maxLength: 3000 },
      },
      {
        id: 'f002-pi-insurance',
        fieldType: 'text',
        label: 'Professional indemnity insurance value',
        required: false,
        placeholder: 'e.g. EUR 5,000,000',
        width: 'half',
      },
      {
        id: 'f002-certifications',
        fieldType: 'multi-select',
        label: 'Compliance certifications held',
        required: false,
        helpText: 'Select all that apply.',
        options: [
          { value: 'iso27001', label: 'ISO 27001' },
          { value: 'iso9001', label: 'ISO 9001' },
          { value: 'soc2', label: 'SOC 2' },
          { value: 'gdpr', label: 'GDPR compliance attestation' },
          { value: 'pci-dss', label: 'PCI DSS' },
          { value: 'none', label: 'None' },
        ],
      },
      {
        id: 'f002-sanctions',
        fieldType: 'radio',
        label:
          'Has the supplier been subject to sanctions, legal action, or adverse media?',
        required: true,
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
          { value: 'unknown', label: 'Unknown' },
        ],
      },
      {
        id: 'f002-compliance-notes',
        fieldType: 'textarea',
        label: 'Additional compliance notes',
        required: false,
        placeholder: 'Any further information relevant to the risk assessment...',
        validation: { maxLength: 2000 },
      },
    ],
  },

  // ── 3. Vendor Onboarding Form ──────────────────────────────────────
  {
    id: 'FORM-003',
    name: 'Vendor Onboarding Form',
    description:
      'Captures key vendor master data required for supplier registration in the ERP system.',
    status: 'active',
    category: 'Procurement',
    triggerStages: ['supplier-onboarding'],
    version: '1.0',
    lastModified: '2024-10-05T11:00:00Z',
    createdBy: 'u9',
    fields: [
      {
        id: 'f003-company-name',
        fieldType: 'text',
        label: 'Company name',
        required: true,
        prePopulateFrom: 'supplierName',
        placeholder: 'Legal entity name',
        width: 'half',
      },
      {
        id: 'f003-trade-name',
        fieldType: 'text',
        label: 'Trade name (if different)',
        required: false,
        placeholder: 'Trading / brand name',
        width: 'half',
      },
      {
        id: 'f003-tax-id',
        fieldType: 'text',
        label: 'Tax identification number (VAT ID)',
        required: true,
        placeholder: 'e.g. DE123456789',
        validation: { minLength: 5, maxLength: 20 },
        width: 'half',
      },
      {
        id: 'f003-duns',
        fieldType: 'text',
        label: 'DUNS number',
        required: false,
        placeholder: '9-digit DUNS',
        validation: { pattern: '^[0-9]{9}$' },
        width: 'half',
      },
      {
        id: 'f003-address',
        fieldType: 'textarea',
        label: 'Registered address',
        required: true,
        placeholder: 'Street, City, Postal Code, Country',
        validation: { maxLength: 500 },
      },
      {
        id: 'f003-contact-name',
        fieldType: 'text',
        label: 'Primary contact name',
        required: true,
        placeholder: 'Full name',
        width: 'half',
      },
      {
        id: 'f003-contact-email',
        fieldType: 'text',
        label: 'Primary contact email',
        required: true,
        placeholder: 'email@company.com',
        validation: { pattern: '^[^@]+@[^@]+\\.[^@]+$' },
        width: 'half',
      },
      {
        id: 'f003-bank-name',
        fieldType: 'text',
        label: 'Bank name',
        required: true,
        placeholder: 'Name of financial institution',
        width: 'half',
      },
      {
        id: 'f003-iban',
        fieldType: 'text',
        label: 'Bank account (IBAN)',
        required: true,
        placeholder: 'e.g. DE89370400440532013000',
        validation: { minLength: 15, maxLength: 34 },
        width: 'half',
      },
      {
        id: 'f003-payment-terms',
        fieldType: 'select',
        label: 'Preferred payment terms',
        required: true,
        options: [
          { value: 'net-14', label: 'Net 14 days' },
          { value: 'net-30', label: 'Net 30 days' },
          { value: 'net-45', label: 'Net 45 days' },
          { value: 'net-60', label: 'Net 60 days' },
          { value: 'net-90', label: 'Net 90 days' },
        ],
        defaultValue: 'net-30',
        width: 'half',
      },
    ],
  },

  // ── 4. Contract Intake Form ────────────────────────────────────────
  {
    id: 'FORM-004',
    name: 'Contract Intake Form',
    description:
      'Collects the key commercial and legal parameters required to draft or review a contract.',
    status: 'active',
    category: 'Procurement',
    triggerStages: ['contracting'],
    version: '1.1',
    lastModified: '2024-11-20T16:00:00Z',
    createdBy: 'u3',
    fields: [
      {
        id: 'f004-contract-type',
        fieldType: 'select',
        label: 'Contract type',
        required: true,
        options: [
          { value: 'fixed-price', label: 'Fixed Price' },
          { value: 'time-materials', label: 'Time & Materials' },
          { value: 'retainer', label: 'Retainer' },
          { value: 'framework', label: 'Framework Agreement' },
          { value: 'sla-based', label: 'SLA-based' },
        ],
        width: 'half',
      },
      {
        id: 'f004-term-months',
        fieldType: 'number',
        label: 'Proposed term (months)',
        required: true,
        placeholder: '12',
        validation: { min: 1, max: 120 },
        width: 'half',
      },
      {
        id: 'f004-auto-renewal',
        fieldType: 'checkbox',
        label: 'Contract includes auto-renewal clause',
        required: false,
        helpText: 'If checked, specify the renewal period in special conditions.',
      },
      {
        id: 'f004-obligations',
        fieldType: 'textarea',
        label: 'Key obligations',
        required: true,
        placeholder: 'Summarise the main deliverables and obligations of each party...',
        validation: { minLength: 20, maxLength: 5000 },
      },
      {
        id: 'f004-sla',
        fieldType: 'textarea',
        label: 'SLA requirements',
        required: false,
        placeholder: 'Response times, uptime commitments, penalty regime...',
        validation: { maxLength: 3000 },
      },
      {
        id: 'f004-exit-clause',
        fieldType: 'textarea',
        label: 'Exit / termination clause',
        required: true,
        placeholder: 'Termination notice period, convenience vs. cause, transition support...',
        validation: { maxLength: 2000 },
      },
      {
        id: 'f004-liability-cap',
        fieldType: 'text',
        label: 'Liability cap',
        required: true,
        placeholder: 'e.g. EUR 1,000,000 or 100% of contract value',
        width: 'half',
      },
      {
        id: 'f004-ip-ownership',
        fieldType: 'select',
        label: 'IP ownership',
        required: true,
        options: [
          { value: 'buyer', label: 'Buyer owns all IP' },
          { value: 'supplier', label: 'Supplier retains IP, buyer gets licence' },
          { value: 'joint', label: 'Joint ownership' },
          { value: 'na', label: 'Not applicable' },
        ],
        width: 'half',
      },
      {
        id: 'f004-governing-law',
        fieldType: 'select',
        label: 'Governing law',
        required: true,
        options: [
          { value: 'german', label: 'German law' },
          { value: 'english', label: 'English law' },
          { value: 'eu', label: 'EU law' },
        ],
        defaultValue: 'german',
        width: 'half',
      },
      {
        id: 'f004-special-conditions',
        fieldType: 'textarea',
        label: 'Special conditions',
        required: false,
        placeholder: 'Any non-standard clauses or deviations from template...',
        validation: { maxLength: 3000 },
      },
    ],
  },

  // ── 5. Budget Approval Form ────────────────────────────────────────
  {
    id: 'FORM-005',
    name: 'Budget Approval Form',
    description:
      'Budget validation and manager sign-off required before financial approval of a procurement request.',
    status: 'active',
    category: 'Compliance',
    triggerStages: ['approval'],
    version: '1.0',
    lastModified: '2024-09-15T10:00:00Z',
    createdBy: 'u7',
    fields: [
      {
        id: 'f005-budget-code',
        fieldType: 'text',
        label: 'Budget code',
        required: true,
        prePopulateFrom: 'costCentre',
        placeholder: 'e.g. CC-IT-001',
        width: 'half',
      },
      {
        id: 'f005-gl-account',
        fieldType: 'text',
        label: 'GL account',
        required: true,
        placeholder: 'e.g. 6200-00-000',
        width: 'half',
      },
      {
        id: 'f005-cost-allocation',
        fieldType: 'number',
        label: 'Cost allocation (%)',
        required: true,
        placeholder: '100',
        validation: { min: 1, max: 100 },
        helpText: 'Percentage of cost allocated to this budget code. Use 100 for single allocation.',
        width: 'half',
      },
      {
        id: 'f005-fiscal-year',
        fieldType: 'select',
        label: 'Fiscal year',
        required: true,
        options: [
          { value: '2024', label: 'FY 2024' },
          { value: '2025', label: 'FY 2025' },
          { value: '2026', label: 'FY 2026' },
        ],
        defaultValue: '2025',
        width: 'half',
      },
      {
        id: 'f005-budget-remaining-info',
        fieldType: 'info-text',
        label: '',
        required: false,
        prePopulateFrom: 'budgetRemaining',
        infoContent:
          'Budget remaining will be displayed here once the budget code is validated against the financial system.',
      },
      {
        id: 'f005-manager-name',
        fieldType: 'text',
        label: 'Budget owner / manager name',
        required: true,
        prePopulateFrom: 'budgetOwner',
        placeholder: 'Full name of the approving manager',
      },
      {
        id: 'f005-manager-confirmation',
        fieldType: 'checkbox',
        label: 'I confirm that sufficient budget is available and this expenditure is approved',
        required: true,
        helpText:
          'By checking this box you confirm budget availability and authorise the procurement to proceed.',
      },
    ],
  },

  // ── 6. IT Security Assessment ──────────────────────────────────────
  {
    id: 'FORM-006',
    name: 'IT Security Assessment',
    description:
      'Security review for software, SaaS and cloud-based procurement to ensure compliance with IT security policies.',
    status: 'active',
    category: 'Risk',
    triggerStages: ['validation'],
    triggerConditions: [
      { field: 'category', operator: 'equals', value: 'software' },
    ],
    version: '1.3',
    lastModified: '2024-12-05T08:00:00Z',
    createdBy: 'u3',
    fields: [
      {
        id: 'f006-app-name',
        fieldType: 'text',
        label: 'Application / service name',
        required: true,
        prePopulateFrom: 'title',
        placeholder: 'Name of the software or service',
        width: 'half',
      },
      {
        id: 'f006-data-classification',
        fieldType: 'select',
        label: 'Data classification',
        required: true,
        helpText: 'Highest classification of data the application will process.',
        options: [
          { value: 'public', label: 'Public' },
          { value: 'internal', label: 'Internal' },
          { value: 'confidential', label: 'Confidential' },
          { value: 'restricted', label: 'Restricted' },
        ],
        width: 'half',
      },
      {
        id: 'f006-hosting',
        fieldType: 'select',
        label: 'Hosting model',
        required: true,
        options: [
          { value: 'on-premise', label: 'On-premise' },
          { value: 'private-cloud', label: 'Private Cloud' },
          { value: 'public-cloud', label: 'Public Cloud (IaaS/PaaS)' },
          { value: 'saas', label: 'SaaS' },
        ],
        width: 'half',
      },
      {
        id: 'f006-encryption-rest',
        fieldType: 'radio',
        label: 'Encryption at rest',
        required: true,
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ],
        width: 'half',
      },
      {
        id: 'f006-encryption-transit',
        fieldType: 'radio',
        label: 'Encryption in transit',
        required: true,
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ],
        width: 'half',
      },
      {
        id: 'f006-mfa',
        fieldType: 'radio',
        label: 'Multi-factor authentication (MFA) supported',
        required: true,
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ],
        width: 'half',
      },
      {
        id: 'f006-api-security',
        fieldType: 'radio',
        label: 'API security (OAuth 2.0 / API keys)',
        required: true,
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ],
        width: 'half',
      },
      {
        id: 'f006-pen-test',
        fieldType: 'radio',
        label: 'Penetration test completed in last 12 months',
        required: true,
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ],
        width: 'half',
      },
      {
        id: 'f006-last-audit',
        fieldType: 'date',
        label: 'Last security audit date',
        required: false,
        width: 'half',
      },
      {
        id: 'f006-security-contact',
        fieldType: 'text',
        label: 'Security contact email',
        required: true,
        placeholder: 'security@vendor.com',
        validation: { pattern: '^[^@]+@[^@]+\\.[^@]+$' },
        width: 'half',
      },
    ],
  },

  // ── 7. Goods Receipt Confirmation ──────────────────────────────────
  {
    id: 'FORM-007',
    name: 'Goods Receipt Confirmation',
    description:
      'Confirms receipt and inspection of physical goods against the purchase order.',
    status: 'active',
    category: 'Operations',
    triggerStages: ['receipt'],
    version: '1.0',
    lastModified: '2024-08-20T13:00:00Z',
    createdBy: 'u1',
    fields: [
      {
        id: 'f007-po-ref',
        fieldType: 'text',
        label: 'PO reference',
        required: true,
        prePopulateFrom: 'poId',
        placeholder: 'e.g. PO-001',
        width: 'half',
      },
      {
        id: 'f007-items-description',
        fieldType: 'textarea',
        label: 'Items received description',
        required: true,
        placeholder: 'Describe the items/services received...',
        validation: { minLength: 10, maxLength: 2000 },
      },
      {
        id: 'f007-quantity',
        fieldType: 'number',
        label: 'Quantity received',
        required: true,
        placeholder: '0',
        validation: { min: 1 },
        width: 'half',
      },
      {
        id: 'f007-condition',
        fieldType: 'select',
        label: 'Condition on arrival',
        required: true,
        options: [
          { value: 'good', label: 'Good' },
          { value: 'minor-damage', label: 'Minor Damage' },
          { value: 'major-damage', label: 'Major Damage' },
          { value: 'rejected', label: 'Rejected' },
        ],
        width: 'half',
      },
      {
        id: 'f007-quality-rating',
        fieldType: 'radio',
        label: 'Quality rating',
        required: true,
        helpText: '1 = Poor, 5 = Excellent',
        options: [
          { value: '1', label: '1' },
          { value: '2', label: '2' },
          { value: '3', label: '3' },
          { value: '4', label: '4' },
          { value: '5', label: '5' },
        ],
      },
      {
        id: 'f007-notes',
        fieldType: 'textarea',
        label: 'Notes',
        required: false,
        placeholder: 'Any additional observations or issues...',
        validation: { maxLength: 2000 },
      },
    ],
  },

  // ── 8. Change Request Form ─────────────────────────────────────────
  {
    id: 'FORM-008',
    name: 'Change Request Form',
    description:
      'Captures and documents changes to scope, timeline, or cost of an active procurement request.',
    status: 'active',
    category: 'Procurement',
    triggerStages: [
      'intake',
      'validation',
      'approval',
      'sourcing',
      'contracting',
      'po',
      'receipt',
    ],
    version: '1.0',
    lastModified: '2024-10-12T15:30:00Z',
    createdBy: 'u4',
    fields: [
      {
        id: 'f008-description',
        fieldType: 'textarea',
        label: 'Change description',
        required: true,
        placeholder: 'Describe the proposed change in detail...',
        validation: { minLength: 20, maxLength: 5000 },
      },
      {
        id: 'f008-reason',
        fieldType: 'select',
        label: 'Reason for change',
        required: true,
        options: [
          { value: 'scope-change', label: 'Scope Change' },
          { value: 'price-change', label: 'Price Change' },
          { value: 'timeline-change', label: 'Timeline Change' },
          { value: 'supplier-change', label: 'Supplier Change' },
          { value: 'other', label: 'Other' },
        ],
        width: 'half',
      },
      {
        id: 'f008-impact',
        fieldType: 'textarea',
        label: 'Impact assessment',
        required: true,
        placeholder:
          'Describe the impact on timeline, budget, and/or deliverables...',
        validation: { minLength: 10, maxLength: 3000 },
      },
      {
        id: 'f008-additional-cost',
        fieldType: 'number',
        label: 'Additional cost (EUR)',
        required: false,
        placeholder: '0',
        validation: { min: 0 },
        helpText: 'Enter 0 if no additional cost. Negative values for savings.',
        width: 'half',
      },
      {
        id: 'f008-approval-required',
        fieldType: 'checkbox',
        label: 'Approval required before implementation',
        required: false,
        helpText:
          'Check if this change requires additional management or financial approval.',
      },
      {
        id: 'f008-documents',
        fieldType: 'file-upload',
        label: 'Supporting documents',
        required: false,
        helpText: 'Upload any supporting documentation (max 10 MB per file).',
      },
    ],
  },
];

export function getFormTemplate(id: string): FormTemplate | undefined {
  return formTemplates.find((t) => t.id === id);
}

export function getFormsForStage(
  stage: string,
  category?: string,
): FormTemplate[] {
  return formTemplates.filter((t) => {
    const stageMatch = t.triggerStages.includes(stage);
    const categoryMatch = category ? t.category === category : true;
    return stageMatch && categoryMatch && t.status === 'active';
  });
}
