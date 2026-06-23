# Fix: AI Assistant leaks `tool_calls.NAME(...)` as text and never answers

**Build observed:** `index-LlQShsel.js` (2 Jun 2026) · **Severity:** HIGH · **Area:** `api/chat.ts`, `api/_llm.ts`, `src/lib/assistant/*`

## Symptom
Ask the assistant "What is the approval threshold for consulting engagements?" → a chat bubble shows the literal text:
```
tool_calls.search_knowledge(query="approval threshold consulting engagements")
```
…and then it stalls. No grounded answer, no source. (Earlier builds leaked chain-of-thought + `$\boxed{}$`; this build leaks the tool call in `tool_calls.NAME(...)` form.)

## Root cause (verified in code)
1. The model emits its tool call as **plain text** (`tool_calls.search_knowledge(query="...")`) in the streamed `content`, rather than as a structured `tool_calls` object.
2. The server's text fallback `parseTextToolCall()` in `api/chat.ts` (~L421–446) only matches the legacy shapes `search_knowledge: <query>`, `lookup_object: <type> <id>`, etc. It does **not** match `tool_calls.NAME(arg="val")`, so the call is never parsed → the execute-and-continue branch (the code that loops back with a tool result) is never entered.
3. Because the **first** model call is streamed with `tool_choice:'auto'`, any `delta.content` (including the tool-call-as-text) is forwarded directly to the client UI. There is no guard that prevents tool-call-shaped first-turn content from reaching the user.

Net: the model's intended tool call is shown verbatim and never executed.

## Fix — robust, two-part (architecture + defensive fallback)

### Part A (primary) — make tool execution reliable: non-streamed planning call, streamed answer
In `api/chat.ts`, restructure the loop so the model's tool-using "planning" turn is **not streamed** (so structured `tool_calls` are read reliably), and only the final grounded answer is streamed.

- **First/planning call:** `callLLMWithTools(messages, TOOLS)` with `tool_choice:'auto'`, **non-streaming**. Read `result.toolCalls` (structured). If present, execute each via the existing capability handlers (`execSearchKnowledge`, `execLookupObject`, `execFilterObjects`, `propose_action`, `start_demand`, `create_ticket`, …) against KB/Supabase, append the `tool` result messages, and loop.
- **Final call:** once tools are done (or none were needed), call the model **streamed** with `tool_choice:'none'` and stream **only** that text to the client as the `chat-answer` turn.
- Never stream the first/planning turn's `content` to the UI.

`api/_llm.ts` already supports `tool_choice` ('auto' on the tool call, 'none' on the streamed answer) and the model id is fine — keep those. The change is the **ordering**: plan (non-stream, structured tool_calls) → execute → answer (stream).

### Part B (defensive) — catch text tool calls in any shape, and never leak them
Even with Part A, Groq/Gemini occasionally drift to text. Harden both ends:

1. **Broaden `parseTextToolCall()`** (`api/chat.ts`) to also match the `tool_calls.NAME(args)` and bare-JSON shapes, then fall through to the legacy patterns:
```ts
function parseTextToolCall(content: string): ParsedTextToolCall | null {
  const c = content.trim();
  const id = `call_txt_${Date.now()}`;

  // tool_calls.search_knowledge(query="...")  OR  search_knowledge(query="...")
  const fn = c.match(/(?:tool_calls\.)?(\w+)\s*\(([^)]*)\)/);
  if (fn && KNOWN_TOOLS.has(fn[1])) {
    const args: Record<string, unknown> = {};
    for (const m of fn[2].matchAll(/(\w+)\s*=\s*"([^"]*)"/g)) args[m[1]] = m[2];
    // also accept JSON-ish: {"query":"..."}
    if (Object.keys(args).length === 0) {
      try { Object.assign(args, JSON.parse(`{${fn[2].replace(/(\w+)\s*=/g,'"$1":')}}`)); } catch {}
    }
    if (Object.keys(args).length) return { id, name: fn[1], args };
  }

  // JSON tool call: {"tool":"search_knowledge","query":"..."} or {"name":...,"arguments":{...}}
  const j = c.match(/\{[\s\S]*\}/);
  if (j) { try {
    const o = JSON.parse(j[0]);
    const name = o.tool ?? o.name ?? o.function?.name;
    if (name && KNOWN_TOOLS.has(name)) {
      const args = o.arguments ?? o.parameters ?? o; return { id, name, args };
    }
  } catch {} }

  // legacy: search_knowledge: <query>  (keep existing patterns) …
  return /* existing legacy matches */ null;
}
const KNOWN_TOOLS = new Set(['search_knowledge','lookup_object','filter_objects','propose_action','execute_action','create_ticket','start_demand','remember_preference']);
```
When `parseTextToolCall` returns a call, **execute it and continue the loop** (this branch already exists — it just wasn't reached). Critically, **do not also stream that raw content** to the client.

2. **Client-side suppression** (`src/lib/assistant/useAssistant.ts` / `groqProvider.ts` SSE accumulator and `turn-chat-answer.tsx`): before rendering a `chat-answer`, **drop** any text that matches a tool-call/CoT/LaTeX signature so nothing leaks even if the server misses it:
```ts
const TOOLCALL_RE = /(?:tool_calls\.)?\b(search_knowledge|lookup_object|filter_objects|propose_action|execute_action|create_ticket|start_demand|remember_preference)\b\s*[:(]/i;
function isLeak(t: string){ return TOOLCALL_RE.test(t) || /\$\\?boxed|## ?Step|^Step \d|\\\(|\\\[/.test(t); }
// when assembling the streamed turn: if isLeak(text) and no real answer followed, show a graceful
// "Let me look that up…" placeholder instead of the raw text, and rely on the executed tool result.
```
Also strip LaTeX/`## Step`/"The final answer is:" from any answer before render.

### Part C — prompt hardening (`SYSTEM_PROMPT` in `api/chat.ts`)
Keep the "use structured tool_calls; never write tool names as text; no CoT; no LaTeX; cite the source" rules, but make the text-fallback explicit so if the model must use text it uses a shape the parser understands:
> If (and only if) you cannot use the structured tool_calls API, output the call **alone** on one line as `tool_calls.FUNCTION(arg="value")` and nothing else.

## Files to change
- `api/chat.ts` — reorder loop (plan non-stream → execute → stream answer); broaden `parseTextToolCall`; ensure planning-turn content is never streamed; tighten `SYSTEM_PROMPT`.
- `api/_llm.ts` — no behavioural change required (confirm non-stream variant returns `tool_calls`; streamed variant uses `tool_choice:'none'`).
- `src/lib/assistant/useAssistant.ts` / `groqProvider.ts` / `components/turn-chat-answer.tsx` — leak guard + LaTeX/CoT stripping on render.
- `src/lib/assistant/mockProvider.ts` — already returns clean grounded turns; use it as the reference behaviour and for `VITE_ASSISTANT_PROVIDER=mock` tests.

## Acceptance criteria
1. Asking the 4 brief strawman scenarios returns a **clean grounded answer with a source chip** — never any `tool_calls.…`, `## Step`, or `$…$` text — in both `mock` and `groq` modes.
2. The knowledge query "approval threshold for consulting engagements" returns the actual policy from the KB, with the source cited.
3. A lookup ("status of REQ-2025-0114") returns a short answer + a deep-link callout.
4. Even if the model emits a text tool call, the server executes it (no leak) OR the client suppresses it and shows a graceful placeholder — the user never sees raw tool syntax.
5. No regression: state-changing actions still require explicit confirm before execute.

## Test cases added to TEST_PLAYBOOK.md
- **TC-AI-01** (updated): grounded answer + source; **no `tool_calls.NAME(...)` / CoT / LaTeX leak**; not stalled.
- **TC-AI-09** (new): force/observe a text-format tool call → server executes it (or client suppresses) → user sees a clean answer, never raw `tool_calls.…`.
- **TC-AI-10** (new): provider parity — same query returns equivalent grounded answers in `mock` and `groq`.
