import type { AIAgent } from './types';

export const aiAgents: AIAgent[] = [
  {
    id: 'AI-001',
    name: 'Category Classifier',
    type: 'classification',
    status: 'active',
    accuracy: 94.2,
    decisionsMade: 1247,
    lastUpdated: '2025-01-02T09:00:00Z',
    description: 'Automatically classifies incoming procurement requests into categories and assigns commodity codes based on title, description, and historical patterns. Uses a fine-tuned transformer model trained on 3 years of procurement data.',
  },
  {
    id: 'AI-002',
    name: 'Request Validator',
    type: 'validation',
    status: 'active',
    accuracy: 91.8,
    decisionsMade: 892,
    lastUpdated: '2024-12-15T14:00:00Z',
    description: 'Validates incoming requests for completeness, policy compliance, and data quality. Checks for missing fields, budget availability, duplicate detection, and policy threshold violations. Flags issues before human review.',
  },
  {
    id: 'AI-003',
    name: 'Document Extractor',
    type: 'extraction',
    status: 'active',
    accuracy: 89.5,
    decisionsMade: 2340,
    lastUpdated: '2024-11-30T10:00:00Z',
    description: 'Extracts key data from uploaded documents including invoices, contracts, quotes, and proposals. Uses OCR and NLP to identify supplier names, amounts, dates, terms, and line items for automated processing.',
  },
  {
    id: 'AI-004',
    name: 'Spend Anomaly Detector',
    type: 'anomaly-detection',
    status: 'active',
    accuracy: 87.3,
    decisionsMade: 156,
    lastUpdated: '2025-01-04T16:00:00Z',
    description: 'Monitors spending patterns across categories, suppliers, and cost centres. Detects anomalies such as unusual spend spikes, off-contract purchasing, invoice duplicates, and price variance outliers. Generates alerts for procurement review.',
  },
  {
    id: 'AI-005',
    name: 'Supplier Recommender',
    type: 'recommendation',
    status: 'draft',
    accuracy: 78.6,
    decisionsMade: 45,
    lastUpdated: '2024-12-20T11:00:00Z',
    description: 'Recommends optimal suppliers for new procurement requests based on category match, performance scores, risk ratings, capacity, and pricing history. Currently in pilot — accuracy below threshold for production deployment.',
  },
  {
    id: 'AI-006',
    name: 'PR Compliance Reviewer',
    type: 'validation',
    status: 'active',
    accuracy: 96.1,
    decisionsMade: 534,
    lastUpdated: '2025-01-08',
    description: 'Reviews purchase requisitions before PO creation. Validates budget availability, contract coverage, supplier compliance status, and policy adherence. Produces a compliance report with pass/fail decision and detailed findings.',
  },
];

export function getAgentById(id: string): AIAgent | undefined {
  return aiAgents.find((a) => a.id === id);
}

export function getActiveAgents(): AIAgent[] {
  return aiAgents.filter((a) => a.status === 'active');
}
