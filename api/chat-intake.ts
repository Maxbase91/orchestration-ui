import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callLLM } from '../src/lib/llm.js';
import {
  determineNextQuestion,
  buildAgenda,
  isConversationComplete,
  resolveSlots,
  type DemandConversationContext,
} from '../src/lib/procurement/demand-conversation.js';
import { getServiceDescriptionTemplate } from './_sd-template.js';

// Base intake assistant rules. The QUESTION ORDER is NOT hard-coded here — it is
// computed per-turn by the demand-conversation engine and injected below, so the
// conversation adapts to prior answers and never re-asks known facts.
const BASE_PROMPT = `You are a procurement intake assistant. Capture a demand through a short, ADAPTIVE conversation — ONE question at a time.

The user is here because no catalogue item or active contract fit, so a full service description (SOW) is required to drive supplier selection, risk and sourcing.

## RULES
- Ask ONLY the single next question provided below. Do NOT invent, reorder, batch or skip ahead.
- Extract ALL data the user provides in their answer — if they give value + timeline together, capture both.
- Skip anything already in "Data collected so far".
- Keep the question under 2 sentences; do not summarise the user's last answer before asking.
- NEVER ask meta-questions ("Would you like to refine this?", "Shall I ask more?", "Should we proceed/continue/expand?", "Do you want a detailed SOW?"). Step straight to the next question.
- Do NOT ask about cost centre, the requester's location/country, or who the request is for — those are captured outside this chat.
- NEVER output internal directives (e.g. "STEP 3", "set complete=true", "generate narrative") as the message text.

Known suppliers: Accenture, SAP SE, Deloitte, KPMG, Capgemini, AWS, Microsoft, Siemens, Bosch, WPP, Sodexo, Randstad, Hays, Iron Mountain, Konica Minolta

## EXTRACTION TARGETS
- Top-level request fields → "extracted": title, supplier, estimatedValue, deliveryDate, isUrgent.
- SOW elements → "serviceDescription": objective, scope, exclusions, deliverables, resources, timeline, acceptanceCriteria, pricingModel, location, dependencies, narrative. Accumulate — include ALL previously collected SOW fields plus any new ones from this turn.

Respond with ONLY JSON:
{
  "extracted": { "title": "...", "supplier": "...", "estimatedValue": 0, "deliveryDate": "...", "isUrgent": false },
  "serviceDescription": { "objective": "...", "scope": "...", "exclusions": "...", "deliverables": "...", "timeline": "...", "resources": "...", "acceptanceCriteria": "...", "pricingModel": "...", "location": "...", "dependencies": "...", "narrative": "..." },
  "nextQuestion": "Your phrasing of the single next question below",
  "answerVerdict": { "addresses": true, "reason": "", "suggested": "" },
  "complete": false,
  "summary": "One-line summary"
}
Only include fields you have actually extracted.

## JUDGING THE ANSWER
"answerVerdict" is about the user's LAST message, against the question you asked before it.
- addresses=true when it is a genuine attempt at that question, however brief or imperfect. Do not
  demand polish. Only their content matters, not their grammar.
- addresses=false when it is placeholder or filler ("bla", "tbd", "asdf"), unreadable, a repeat of
  the question, or fluent text about something other than what was asked.
- When addresses=false, and ONLY then, put a drafted answer in "suggested" — one or two sentences
  the user can accept as their answer, written in their voice, in the third person.
  "suggested" MUST be derivable from what they have actually told you: the category, the title, the
  value, and their earlier answers. Invent NOTHING — no supplier, no date, no number, no scope they
  never mentioned. If you cannot draft something grounded in what they said, leave "suggested" empty.
- "reason" is one short clause naming what is missing, addressed to the user.
- When the user has NOT yet answered anything (your first message), set addresses=true.
- Do NOT put the extracted value of a rejected answer into "serviceDescription" or "extracted".`;

/** Build the engine context from the running "data collected so far". */
function contextFrom(category: string, soFar: Record<string, unknown>): DemandConversationContext {
  const sow = (soFar.serviceDescription ?? {}) as Record<string, string | undefined>;
  return {
    category,
    title: (soFar.title as string) || undefined,
    estimatedValue: (soFar.estimatedValue as number) || undefined,
    deliveryDate: (soFar.deliveryDate as string) || undefined,
    sow: {
      objective: sow.objective, scope: sow.scope, exclusions: sow.exclusions, deliverables: sow.deliverables,
      resources: sow.resources, timeline: sow.timeline, acceptanceCriteria: sow.acceptanceCriteria,
      pricingModel: sow.pricingModel, dependencies: sow.dependencies,
    },
  };
}

export const config = { maxDuration: 30 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, category, extractedSoFar } = req.body;

  // Which questions get asked is admin config, not a code constant. This is the
  // reason the template is a table: PolicyConfig is localStorage-only, so a
  // serverless route can never see an admin's overrides through it.
  // getServiceDescriptionTemplate fails open to the built-in, which serialises
  // the same slot set the engine defaults to — so an unreachable database
  // changes nothing about the conversation.
  const template = await getServiceDescriptionTemplate(category);
  const slots = resolveSlots(template.slots);

  // The engine decides what to ask next from everything captured so far.
  const ctx = contextFrom(category ?? 'goods', (extractedSoFar ?? {}) as Record<string, unknown>);
  const next = determineNextQuestion(ctx, undefined, slots);
  const complete = isConversationComplete(ctx, undefined, slots);
  const remaining = buildAgenda(ctx, undefined, slots).map((s) => s.id).join(', ') || 'none';

  const agendaBlock = next
    ? `## YOUR NEXT MESSAGE\nAsk EXACTLY this one thing, and nothing else:\n"${next.prompt}"\n\nPut it in the context of what THIS requester has actually described — refer to their own words for what they are buying. Keep it a single short question, one sentence, ending in a question mark. Do NOT answer it yourself, do NOT append an example, and do NOT mention any project other than theirs.\nThe user's answer fills the "${next.slot.target.kind === 'sow' ? 'serviceDescription.' : ''}${next.slot.target.field}" field.\nStill to capture after this (do NOT ask these yet): ${remaining}.`
    : `## YOUR NEXT MESSAGE\nAll required details are captured. Do NOT ask anything else. Generate "narrative" (a professional 2-3 paragraph SOW summary) and return a short closing like "Thanks — all details captured, you can proceed to the next step."`;

  const systemMessage = `${BASE_PROMPT}\n\n${agendaBlock}\n\nRequest category: ${category}\nConversation complete: ${complete}\nData collected so far: ${JSON.stringify(extractedSoFar ?? {})}`;

  try {
    const content = await callLLM({
      messages: [
        { role: 'system', content: systemMessage },
        ...(messages ?? []).map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
      temperature: 0.4,
      maxTokens: 1024,
    });

    return res.status(200).json(JSON.parse(content));
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Chat intake error:', msg);
    return res.status(502).json({ error: msg });
  }
}
