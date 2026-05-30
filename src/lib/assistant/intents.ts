import type { Role } from '@/config/roles';

export type IntentType = 'knowledge' | 'lookup' | 'action' | 'handover' | 'intake' | 'unknown';

export function classifyIntent(input: string): IntentType {
  const t = input.toLowerCase();

  const scores: Record<IntentType, number> = {
    knowledge: 0,
    lookup: 0,
    action: 0,
    handover: 0,
    intake: 0,
    unknown: 0,
  };

  // Knowledge — policy / process questions
  if (/\b(policy|policies|threshold|limit|rules?|guideline|procedure|explain|allowed|permitted|require|mandatory|kop|faq|standard)\b/.test(t)) scores.knowledge += 2;
  if (/\b(when (can|should|do i)|how (much|many|do i|does|should|to)|what (is|are) the (policy|rule|limit|threshold|process|procedure|requirement|guideline|standard|penalty|deadline|definition))\b/.test(t)) scores.knowledge += 2;
  if (/\b(consulting|approval|payment terms|sra|esg|framework|catalogue|onboard|renew|delegate|ooo|out.of.office|ir35|dpa|gdpr|capex|opex|tprm)\b/.test(t) && /\b(what|how|when|why|explain|policy|rule|process)\b/.test(t)) scores.knowledge += 1;
  // "how to" process questions
  if (/\bhow (to|do i|can i|should i)\b/.test(t)) scores.knowledge += 2;

  // Lookup — status / find a specific object
  if (/\b(req-|sup-|con-|po-|inv-|ra-|tkt-)\w+/.test(t)) scores.lookup += 3;
  if (/\b(risk rating|risk status|performance score|utilisation|match status|payment status|sra status)\b/.test(t)) scores.lookup += 1;
  if (/\b(show me|find|look up|search for|tell me about|what('s| is) (the )?(risk|score|rating)|details (of|for)|profile of)\b/.test(t)) scores.lookup += 1;
  if (/\b(acme|accenture|sap|deloitte|infosys|capgemini|atos|randstad|hays)\b/.test(t) && !/\b(policy|panel|threshold)\b/.test(t)) scores.lookup += 1;

  // Action — imperative commands that change state
  // Strong explicit action verbs score +4 so they beat any ID-based lookup score (+3).
  if (/\b(add (me|myself) (as )?(a )?watcher|set (my |the )?(approval )?delegate|set (me as |my )?ooo|request (a )?risk reassessment|request (contract )?renewal|request (a )?po change|raise (a )?payment.*(escalation|escalate)|reassign|approver substitut)\b/.test(t)) scores.action += 4;
  if (/\b(set (my|a|the)|delegate (my |approvals? )?(to)?|out.of.office|escalat(e|ion)|substitut)\b/.test(t)) scores.action += 2;
  if (/\b(approve on my behalf|cover for me|change (the )?(approver|owner)|update (the )?(po|contract)|raise (a |an )?(escalation|payment))\b/.test(t)) scores.action += 2;

  // Intake — buying / raising a demand (exclude "I need to speak/talk" to avoid handover collision)
  if (/\b(i (want|need|would like) to (buy|purchase|procure|order|get)|buy|purchase|procure|raise a demand|new (request|demand)|want to (buy|order)|can you (buy|order|raise|get))\b/.test(t) && !/\b(speak|talk|contact|person|human|someone)\b/.test(t)) scores.intake += 2;
  if (/\bi need (a|some) /.test(t) && !/\b(speak|talk|contact|person|human|someone)\b/.test(t)) scores.intake += 2;
  if (/\b(create (a )?request|submit (a )?request|raise (a )?(pr|purchase request|procurement request))\b/.test(t)) scores.intake += 3;
  if (/\b(purchase request|procurement request)\b/.test(t)) scores.intake += 2;

  // Handover — ask for a human (explicit "speak to"/"talk to" scored higher)
  if (/\b(speak (to|with)|talk (to|with))\b/.test(t)) scores.handover += 3;
  if (/\b(contact|person|human|agent|someone|not working|issue|problem|complain|escalate to|can't find|don't understand)\b/.test(t)) scores.handover += 1;

  const best = (Object.keys(scores) as IntentType[]).reduce((a, b) => (scores[a] >= scores[b] ? a : b));
  return scores[best] > 0 ? best : 'unknown';
}

// Actions available per role. Used to filter suggestion chips.
const roleActions: Record<Role, string[]> = {
  'service-owner': ['raise a demand', 'track my request', 'add me as watcher', 'set my delegate'],
  'procurement-manager': ['raise a demand', 'reassign request', 'request contract renewal', 'request risk reassessment', 'set my delegate', 'set out-of-office'],
  'vendor-manager': ['request risk reassessment', 'request contract renewal', 'set my delegate'],
  'operations-lead': ['reassign request', 'request PO change', 'raise payment escalation', 'approver substitution', 'set my delegate'],
  'supplier': [],
  'admin': ['reassign request', 'request PO change', 'approver substitution', 'set my delegate', 'set out-of-office'],
};

export function allowedActions(role: Role): string[] {
  return roleActions[role] ?? [];
}
