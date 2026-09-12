# FR-11: AI Assistant & Knowledge Base

**Version:** 1.0 · **Date:** 30 August 2026 · **Roles:** All internal roles

---

## Purpose

The AI assistant is a conversational procurement concierge — it answers policy questions, looks up objects, proposes actions, and routes buy intent. It uses tool calling to ground answers in live knowledge-base and Neon-backed application data.

---

## User Stories

| ID | Role | Story | Priority |
|----|------|-------|----------|
| FR11-01 | any internal | I can ask "what is the approval threshold for consulting?" and get a grounded, cited answer | Must |
| FR11-02 | any internal | I can ask "show me all overdue requests" and get a filtered list | Must |
| FR11-03 | any internal | I can say "set my delegate to James Chen until Friday" and the system proposes + confirms the action | Must |
| FR11-04 | any internal | I can say "I need to buy laptops" and the system opens the New Request wizard pre-filled | Should |

---

## Tool Call Loop

```
User message
    │
    ▼ POST /api/chat (Groq openai/gpt-oss-120b)
       ┌ Structured tool_calls? ──► execute tool ──► second LLM call (tool_choice:none)
       │
       └ Text-based tool call? (e.g. "search_knowledge: ...")
           ──► parseTextToolCall() regex
           ──► execute tool
           ──► inject synthetic tool_calls message
           ──► continue loop
    │
    ▼ Second LLM call: grounded answer
    │
    ▼ cleanAssistantText(): strip LaTeX, ## Step CoT, "The final answer is:"
    │
    ▼ TurnChatAnswer renders clean markdown
```

FR11-10 · MAX_ITERATIONS = 5; loop terminates at limit with error message.
FR11-11 · `parseTextToolCall()` handles: `search_knowledge:`, `lookup_object:`, `filter_objects:`, `start_demand:` patterns with `/` separators.
FR11-12 · Synthetic tool_call_id format: `call_txt_{timestamp}` (Groq-compatible prefix).

---

## Tools (8 total)

| Tool | Trigger | Execution |
|------|---------|-----------|
| `search_knowledge` | Policy/process Q | Query `knowledge_base` table; score by keyword |
| `lookup_object` | Status query by ID/name | Query Neon-backed request/supplier/contract/PO/invoice data |
| `filter_objects` | "Show me all X" | Filter application-owned data with conditions |
| `propose_action` | State-change intent | Return `ConfirmTurn` to user; wait for confirmation. The card's text is **derived server-side** from the action — see Confirm before act |
| `create_ticket` | Human help needed | Insert `tickets` row |
| `start_demand` | Buy/procure intent | Return deep-link to `/requests/new?category=...` |
| `remember_preference` | User tells delegate/cost-centre | Upsert `user_preferences.prefs`, four allowlisted keys only — see Confirm before act |
| `filter_objects` | List queries | Query application-owned data with field filters |

---

## Action Role Gating

FR11-20 · `executeAction()` checks `ROLE_ALLOWED_ACTIONS[ctx.role]` before executing.
FR11-21 · `proposeAction()` also checks — blocked actions return an error message, not a confirm turn.

---

## Confirm before act

The confirm card is the only thing between a model suggestion and a real write, and
untrusted text reaches the model on every turn — knowledge-base bodies, request titles,
supplier names, and up to 50 000 characters of uploaded document text. These rules exist
because a poisoned record could otherwise get the model to propose one action while
describing another. Covered by `npm run test:assistant-boundary`.

FR11-22 · The sentence shown above **Confirm** is built by `api/_action-description.ts`
from `action_type` and `action_params`, with ids resolved to display names. The model's
own `read_back` is **not** used. The resolved targets are listed under the sentence, so a
plausible sentence about the wrong record is visible.
FR11-23 · An action with no description template shows **no** confirm card — the endpoint
could not have run it either. Every action `planAction()` can run must be describable.
FR11-24 · `remember_preference` accepts only `delegate`, `cost_centre`, `department` and
`preferred_supplier`, with a 120-character cap. The stored row is read back into the
system prompt of every later conversation, so an unbounded key would make a one-turn
injection permanent. Remembered facts are rendered as a labelled list marked as data, not
as instructions.
FR11-25 · `lookup_object` and `filter_objects` scope requests, purchase orders and
invoices to the caller as requester **or** owner; invoices resolve through their purchase
orders. `requestor_id` is not a model-settable filter. Suppliers, contracts and risk
assessments are deliberately **not** scoped — they are the shared registers every role
browses in the app.
FR11-26 · `/api/execute-action` reads the actor's name from the directory rather than the
request body, and a repeated `actionId` must describe the same action by the same actor
before success is reported.

> Scoping and integrity, not authorization: `userId` is whoever the client claims to be
> until the identity model in ADR-0003 lands.

---

## Output Cleanup

FR11-30 · `cleanAssistantText()` in `turn-chat-answer.tsx` strips:
  - LaTeX: `$$...$$`, `$\boxed{}$`, `\[...\]`, `\(...\)`
  - CoT headers: `## Step N`, `**Step N**`, `Step N:`
  - Summary phrases: `The final answer is:`, `Therefore,`
  - `<think>` tags
FR11-31 · SYSTEM_PROMPT explicitly forbids LaTeX, chain-of-thought, and step-by-step output.

---

## Knowledge Base

FR11-40 · `knowledge_base` table: id, title, body, source, tags[].
FR11-41 · `execSearchKnowledge()`: queries the Neon-backed `knowledge_base` table first and falls back to the built-in knowledge base when the table is empty. The fallback is degraded data, not a permissions boundary.
FR11-42 · KB Management admin page (`/admin/kb`) for adding/editing entries.

---

## Key Files

- `api/chat.ts` — tool loop, tool handlers, SYSTEM_PROMPT, record scoping
- `api/_llm.ts` — the one LLM helper: Groq first, Gemini fallback, streaming and
  tool-calling. Pins both Groq models (`openai/gpt-oss-120b` for the assistant,
  `openai/gpt-oss-20b` for single-shot callers) — governed under CLS-G0, see CLAUDE.md
- `api/_action-description.ts` — builds the confirm card's text from the action itself
- `api/execute-action.ts` — runs a confirmed action and its audit row in one transaction
- `src/features/ai-assistant/ai-chat-overlay.tsx`
- `src/features/ai-assistant/components/turn-chat-answer.tsx`
- `src/lib/assistant/capabilities/action.ts`
