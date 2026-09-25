// Seed data only — the runtime reads `ai_agents` (Admin → AI agents).
//
// Each agent is a switch on something the product really does; the
// description says what, in plain terms, and where it shows. The descriptions
// here used to be marketing ("a fine-tuned transformer model trained on 3 years
// of procurement data"), with accuracy and decision counts nobody measured.
// Two agents are gone (2026-09-25): AI-003 only relabelled a disabled upload
// button, and AI-006 wrote compliance reports whose checks were invented passes.

import type { AIAgent } from './types.js';
import { DEFAULT_STATUS_CONFIG } from '../lib/assistant/status-config.js';

export const aiAgents: AIAgent[] = [
  {
    id: 'AI-001',
    name: 'Category Classifier',
    type: 'classification',
    status: 'active',
    lastUpdated: '2026-09-25',
    description: 'Reads the demand as the requester wrote it and suggests the category and a title, supplier and value where it can find them — through the language model (Groq, with Gemini as fallback). The categories it chooses from are the ones configured under Categories. When it is not active, or the model is unavailable, the configured keywords classify instead.',
  },
  {
    id: 'AI-002',
    name: 'Request Validator',
    type: 'validation',
    status: 'active',
    lastUpdated: '2026-09-25',
    description: 'Runs the policy checks on the Review step: contract required before a PO, budget approval, the supplier\'s risk assessment, competitive sourcing and the preferred-supplier rule — each against Decisioning thresholds and the category\'s preferred suppliers. These are rules, not a model. When it is not active, the checks are reported as not run rather than passed.',
  },
  {
    id: 'AI-004',
    name: 'Spend Anomaly Checks',
    type: 'anomaly-detection',
    status: 'active',
    lastUpdated: '2026-09-25',
    description: 'Flags, on Analytics, open requests at or above the contract-required threshold with no contract behind them, and suppliers with three or more requests in flight whose combined value is above the budget-approval threshold. Both figures come from Decisioning thresholds. Rules, not a model.',
  },
  {
    id: 'AI-005',
    name: 'Supplier Recommender',
    type: 'recommendation',
    status: 'active',
    lastUpdated: '2026-09-25',
    description: 'Ranks suppliers for the request on the Details step: the category\'s preferred suppliers first, then by how well the supplier\'s categories fit, its performance score and its risk rating. When it is not active, no ranked suggestions are shown and the supplier can still be chosen.',
  },
  {
    id: 'AI-007',
    name: 'Status Answers',
    type: 'status',
    status: 'active',
    lastUpdated: '2026-09-25',
    description: 'Answers status questions on Home and in the assistant — where a request is, what is waiting on you, a PO, an invoice, a contract or a supplier. Which attributes it may state, and whose records each role may ask about, are configured below.',
    config: DEFAULT_STATUS_CONFIG,
  },
];
