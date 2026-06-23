# FR-11: AI Assistant & Knowledge Base

**Version:** 1.0 · **Date:** June 2026 · **Roles:** All internal roles

---

## Purpose

The AI assistant is a conversational procurement concierge — it answers policy questions, looks up objects, proposes actions, and routes buy intent. It uses tool calling to ground answers in live KB/Supabase data.

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
    ▼ POST /api/chat (Groq llama-3.3-70b-versatile)
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
| `lookup_object` | Status query by ID/name | Query Supabase for request/supplier/contract/PO/invoice |
| `filter_objects` | "Show me all X" | Filter Supabase with conditions |
| `propose_action` | State-change intent | Return `ConfirmTurn` to user; wait for confirmation |
| `create_ticket` | Human help needed | Insert `tickets` row |
| `start_demand` | Buy/procure intent | Return deep-link to `/requests/new?category=...` |
| `remember_preference` | User tells delegate/cost-centre | Upsert `user_preferences.prefs` |
| `filter_objects` | List queries | Query Supabase with field filters |

---

## Action Role Gating

FR11-20 · `executeAction()` checks `ROLE_ALLOWED_ACTIONS[ctx.role]` before executing.
FR11-21 · `proposeAction()` also checks — blocked actions return an error message, not a confirm turn.

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
FR11-41 · `execSearchKnowledge()`: tries Supabase first; falls back to hardcoded `knowledgeBase` array if table empty.
FR11-42 · KB Management admin page (`/admin/kb`) for adding/editing entries.

---

## Key Files

- `api/chat.ts` — tool loop, tool handlers, SYSTEM_PROMPT
- `api/_llm.ts` — Groq integration, streaming, fallback to Gemini
- `src/features/ai-assistant/ai-chat-overlay.tsx`
- `src/features/ai-assistant/components/turn-chat-answer.tsx`
- `src/lib/assistant/capabilities/action.ts`
