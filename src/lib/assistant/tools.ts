// Tool definitions — used by groqProvider in Phase 2 to send tool schemas to the LLM.
// The mock provider calls capability handlers directly; this file defines the shared schema.

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
}

export const tools: ToolDefinition[] = [
  {
    name: 'search_knowledge',
    description: 'Search the procurement knowledge base for policies, FAQs, KOPs, and guidelines. Always cite the source field in the answer.',
    parameters: {
      query: { type: 'string', description: 'User question or search phrase', required: true },
    },
  },
  {
    name: 'lookup_object',
    description: 'Look up a specific procurement object (request, supplier, contract, PO, invoice, risk assessment) by type and identifier.',
    parameters: {
      type: { type: 'string', description: 'Object type: request | supplier | contract | po | invoice | risk-assessment', required: true },
      identifier: { type: 'string', description: 'ID (e.g. REQ-2024-0001) or name (e.g. Accenture)', required: true },
    },
  },
  {
    name: 'propose_action',
    description: 'Build a structured action proposal for the user to confirm before execution. Never execute directly.',
    parameters: {
      action_type: { type: 'string', description: 'Action type from the action catalogue', required: true },
      params: { type: 'object', description: 'Action parameters as key-value pairs', required: true },
    },
  },
  {
    name: 'execute_action',
    description: 'Execute a previously proposed and user-confirmed action. Only callable after explicit user confirmation.',
    parameters: {
      action_id: { type: 'string', description: 'The actionId returned by propose_action', required: true },
    },
  },
  {
    name: 'create_ticket',
    description: 'Create a support/handover ticket when no grounded answer or safe action exists, or when the user asks for a human.',
    parameters: {
      summary: { type: 'string', description: 'One-line summary of the issue', required: true },
      context: { type: 'string', description: 'Full context gathered in the conversation', required: true },
    },
  },
  {
    name: 'start_demand',
    description: 'Detect buy intent and produce a deep-link into the New Request wizard with fields pre-populated.',
    parameters: {
      category: { type: 'string', description: 'Procurement category', required: true },
      value: { type: 'number', description: 'Estimated value in EUR', required: false },
      supplier: { type: 'string', description: 'Preferred supplier name if known', required: false },
    },
  },
];
