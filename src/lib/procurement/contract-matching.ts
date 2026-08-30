// Contract matching domain logic. The matcher turns a free-text demand and a
// versioned contract scope into an explainable recommendation; API handlers
// provide the authoritative data and optional provider reranking.

import type {
  ContractMatchCandidate,
  ContractMatchResponse,
  ContractScopeDeliverable,
  ContractScopeExclusion,
  ContractScopeVersion,
} from '../../data/types.js';

export interface ContractMatchScope extends ContractScopeVersion {
  contractTitle: string;
  supplierId: string;
  supplierName: string;
  contractValue: number;
  utilisationPercentage: number;
  contractStatus: string;
  deliverables: ContractScopeDeliverable[];
  exclusions: ContractScopeExclusion[];
}

export interface ContractMatchInput {
  text: string;
  category?: string;
  supplierId?: string;
  estimatedValue?: number;
  needByDate?: string;
  serviceStartDate?: string;
  serviceEndDate?: string;
  geography?: string;
  businessUnit?: string;
  clarificationAnswers?: Record<string, string>;
}

interface Signals {
  tokens: string[];
  serviceTokens: string[];
  deliverableTokens: string[];
  contextTokens: string[];
}

const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'from', 'our', 'this', 'that', 'need', 'want', 'please', 'provide', 'service', 'services']);
const CONTEXT_WORDS = new Set(['uk', 'ireland', 'germany', 'frankfurt', 'london', 'berlin', 'office', 'offices', 'team', 'department', 'annual', 'monthly', 'quarterly', 'year', 'years']);

function tokens(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function containsToken(haystack: string, token: string): boolean {
  return haystack.includes(token) || (token.endsWith('s') && haystack.includes(token.slice(0, -1)));
}

function signalize(input: ContractMatchInput): Signals {
  const text = [input.text, ...Object.values(input.clarificationAnswers ?? {})].join(' ');
  const all = tokens(text);
  return {
    tokens: all,
    serviceTokens: all.filter((token) => !CONTEXT_WORDS.has(token)),
    deliverableTokens: all.filter((token) => !CONTEXT_WORDS.has(token)),
    contextTokens: all.filter((token) => CONTEXT_WORDS.has(token)),
  };
}

function contextValues(input: ContractMatchInput): string[] {
  return [input.geography, input.businessUnit, input.supplierId, input.needByDate, input.serviceStartDate, input.serviceEndDate]
    .filter((value): value is string => Boolean(value && value.trim()))
    .flatMap(tokens);
}

function restrictionMatches(values: string[], input: ContractMatchInput): boolean {
  if (values.length === 0) return true;
  const supplied = [input.geography, input.businessUnit].filter((value): value is string => Boolean(value)).map((value) => value.toLowerCase());
  // An omitted context is handled by the sufficiency gate; do not discard a
  // potentially useful candidate before the requester has answered a question.
  if (supplied.length === 0) return true;
  return supplied.some((value) => values.some((allowed) => allowed.toLowerCase() === value || value.includes(allowed.toLowerCase()) || allowed.toLowerCase().includes(value)));
}

function dateInScope(scope: ContractMatchScope, input: ContractMatchInput): boolean {
  const requestedStart = input.serviceStartDate ?? input.needByDate;
  const requestedEnd = input.serviceEndDate ?? input.needByDate;
  if (requestedStart && scope.effectiveTo && requestedStart > scope.effectiveTo) return false;
  if (requestedEnd && requestedEnd < scope.effectiveFrom) return false;
  return true;
}

function exclusionHit(scope: ContractMatchScope, input: ContractMatchInput): string | undefined {
  const text = [input.text, ...Object.values(input.clarificationAnswers ?? {})].join(' ').toLowerCase();
  return scope.exclusions.find((exclusion) => text.includes(exclusion.term.toLowerCase()))?.term;
}

function hasCoverageSignal(input: ContractMatchInput): { sufficient: boolean; missingFields: string[] } {
  const signal = signalize(input);
  const service = signal.serviceTokens.length > 0 || Boolean(input.category);
  // A deliverable verb is enough to establish an outcome even when the user
  // only gives one noun (for example, “implement payroll”).
  const deliverable = signal.deliverableTokens.length >= 2 || /\b(implement|deliver|deliverable|support|manage|audit|renew|monitor|provide|build|design)\b/i.test(input.text);
  const context = contextValues(input).length > 0 || signal.contextTokens.length > 0 || Boolean(input.estimatedValue);
  const missingFields: string[] = [];
  if (!service) missingFields.push('service family');
  if (!deliverable) missingFields.push('deliverable or outcome');
  if (!context) missingFields.push('business context, location, supplier, timeframe, or value');
  return { sufficient: missingFields.length === 0, missingFields };
}

function questionFor(field: string): string {
  if (field === 'service family') return 'What type of service do you need?';
  if (field === 'deliverable or outcome') return 'What should the supplier deliver or achieve?';
  return 'Which location, team, supplier, timeframe, or approximate value should this cover?';
}

function scoreScope(scope: ContractMatchScope, input: ContractMatchInput, signals: Signals): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const narrative = `${scope.scopeNarrative} ${scope.serviceFamily ?? ''} ${scope.contractTitle} ${scope.contractStatus}`.toLowerCase();
  const deliverables = scope.deliverables.map((item) => `${item.name} ${item.aliases.join(' ')} ${item.description ?? ''}`).join(' ').toLowerCase();
  const scopeTerms = `${narrative} ${deliverables}`;
  const matchedService = signals.serviceTokens.filter((token) => containsToken(narrative, token));
  const matchedDeliverables = signals.deliverableTokens.filter((token) => containsToken(deliverables, token));
  const matchedContext = [...signals.contextTokens, ...contextValues(input)].filter((token) => containsToken(scopeTerms, token));
  const supplierMatch = Boolean(input.supplierId && input.supplierId === scope.supplierId);
  const categoryMatch = Boolean(input.category && scope.eligibleCategories.some((category) => category.toLowerCase() === input.category?.toLowerCase()));
  const serviceScore = matchedService.length > 0 ? 0.3 : 0;
  const deliverableScore = matchedDeliverables.length > 0 ? 0.3 : 0;
  const narrativeScore = Math.min(0.15, matchedService.length * 0.03 + matchedDeliverables.length * 0.03);
  const contextScore = matchedContext.length > 0 ? 0.1 : 0;
  const explicitScore = (supplierMatch ? 0.07 : 0) + (categoryMatch ? 0.03 : 0);
  const remaining = Math.max(0, scope.contractValue * (1 - scope.utilisationPercentage / 100));
  const commercialScore = input.estimatedValue && remaining >= input.estimatedValue ? 0.05 : 0;
  if (matchedService.length) reasons.push(`service scope matches ${matchedService.slice(0, 3).join(', ')}`);
  if (matchedDeliverables.length) reasons.push(`deliverables match ${matchedDeliverables.slice(0, 3).join(', ')}`);
  if (matchedContext.length) reasons.push('business context is covered');
  if (supplierMatch) reasons.push(`matches selected supplier ${scope.supplierName}`);
  if (categoryMatch) reasons.push(`covers ${scope.eligibleCategories.join(', ')}`);
  if (commercialScore) reasons.push('remaining contract capacity covers the estimated value');
  return { score: Math.min(1, serviceScore + deliverableScore + narrativeScore + contextScore + explicitScore + commercialScore), reasons };
}

export function matchContractScopes(input: ContractMatchInput, scopes: ContractMatchScope[]): ContractMatchResponse {
  const coverage = hasCoverageSignal(input);
  const candidates: ContractMatchCandidate[] = [];
  for (const scope of scopes) {
    if (scope.completeness !== 'complete' || scope.status !== 'active') continue;
    if (!['active', 'expiring'].includes(scope.contractStatus)) continue;
    if (!dateInScope(scope, input)) continue;
    if (exclusionHit(scope, input)) continue;
    if (input.supplierId && input.supplierId !== scope.supplierId) continue;
    if (!restrictionMatches(scope.geographies, input) || !restrictionMatches(scope.businessUnits, input)) continue;
    const result = scoreScope(scope, input, signalize(input));
    if (result.score < 0.3) continue;
    const confidence = result.score >= 0.8 ? 'high' : result.score >= 0.6 ? 'medium' : 'low';
    candidates.push({ contractId: scope.contractId, scopeVersionId: scope.id, score: Number(result.score.toFixed(3)), confidence, reasons: result.reasons, exclusionsChecked: scope.exclusions.map((item) => item.term) });
  }
  candidates.sort((a, b) => b.score - a.score);
  const top = candidates.slice(0, 4);
  if (!coverage.sufficient) {
    return { sufficient: false, route: 'clarify', missingFields: coverage.missingFields, questions: coverage.missingFields.slice(0, 3).map(questionFor), candidates: top };
  }
  if (top.length === 0) return { sufficient: true, route: 'full-request', missingFields: [], questions: [], candidates: [] };
  if (top[0].confidence === 'low') return { sufficient: true, route: 'clarify', missingFields: ['a more specific contract discriminator'], questions: [questionFor('business context, location, supplier, timeframe, or value')], candidates: top };
  return { sufficient: true, route: 'contract', missingFields: [], questions: [], candidates: top };
}
