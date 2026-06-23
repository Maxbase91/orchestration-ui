# Fix: AI Assistant hangs on loading spinner, never returns an answer

**Build observed:** `index-C5da2DbT.js` (2 Jun 2026) · **Severity:** HIGH · **Supersedes** the leak portion of CHATBOT_TOOLCALL_FIX.md (the `tool_calls.NAME(...)` text leak is now fixed; this is the new failure mode).

## Symptom
Ask "What is the approval threshold for consulting engagements?" → assistant shows the **loading spinner forever (30s+) and never renders an answer.** Exactly **one** `POST /api/chat → 200`; no answer; no console error; **no text leak** (improvement). The input unlocks (typing indicator clears) but the answer turn never appears.

## Root cause (verified in current code, two independent investigations)
1. **SSE contract is fine.** Server emits `data: {"t":"tok","c":...}` tokens and a final `data: {"t":"done","turns":[...]}`; the client (`src/lib/assistant/useAssistant.ts` `fetchSSE`, ~L64–69) parses exactly those (`payload.t === 'tok'` / `'done'`). No shape mismatch.
2. **The hang is in the streamed second call.** On the tool-call path, after the first model call returns structured `tool_calls` and the capability is executed, `api/chat.ts` (~L682–693, the `if (isSSE && hadToolCalls)` branch) calls:
   ```ts
   await callLLMStreaming(llmMessages, (token) => {
     res.write(`data: ${JSON.stringify({ t: 'tok', c: token })}\n\n`);
   }, TOOLS);
   res.write(`data: ${JSON.stringify({ t: 'done', turns: structuralTurns })}\n\n`);
   res.end();
   ```
3. **`callLLMStreaming` has no timeout and no guaranteed termination** (`api/_llm.ts` ~L168–225). It does `while (true) { const {done,value} = await reader.read(); … if (payload === '[DONE]') return; }`. If the second call's stream never delivers a recognised `data: [DONE]` (or delivers no streamable tokens for this message shape), `reader.read()` never resolves `done` and the `[DONE]` branch is never hit → **the awaited promise never resolves.** So the line that writes `{t:'done'}` and `res.end()` (L692–693) **never executes**, the HTTP response stays open, and the client's `reader.read()` blocks forever → spinner hangs.

**Why deterministic (every time):** the second streamed call — made with `tools` present but `tool_choice:'none'`, on a message list that now contains a `tool` result — consistently fails to produce a recognised token/`[DONE]` terminator in streaming mode, so the loop never exits. (A flaky-network timeout would be intermittent; this is structural.)

## The fix (full plan)

### Fix 1 (primary, most robust) — make the grounded answer a NON-streamed call
Streaming `[DONE]` parsing is the fragile part. After tools are executed, generate the final answer with a **non-streaming** call and emit it as one token + done. This sidesteps the streaming terminator entirely.

In `api/chat.ts`, replace the `if (isSSE && hadToolCalls)` streamed branch with:
```ts
if (isSSE && hadToolCalls) {
  let answer = '';
  try {
    // non-streaming, tool_choice:'none' → reliable, returns full content
    const final = await callLLMWithTools(llmMessages, TOOLS, 0.2, 'none'); // add a toolChoice arg, or use callLLM
    answer = (final.content ?? '').trim();
  } catch (e) {
    console.error('final answer call failed:', e);
  }
  if (!answer) answer = 'I found relevant information but could not compose a response. Please try again.';
  if (!isToolCallLeak(answer)) res.write(`data: ${JSON.stringify({ t: 'tok', c: answer })}\n\n`);
  res.write(`data: ${JSON.stringify({ t: 'done', turns: structuralTurns })}\n\n`);
  res.end();
  return;
}
```
(If you want to keep token-by-token streaming UX, do Fix 2 instead/as well — but Fix 1 alone makes it correct and reliable.)

### Fix 2 — if keeping `callLLMStreaming`, add a timeout + guaranteed termination
In `api/_llm.ts` `callLLMStreaming`:
- Use an `AbortController` with an **overall timeout** (e.g. 30s) and an **idle/per-chunk timeout** (e.g. 12s) via `Promise.race([reader.read(), timeout])`; on timeout, `controller.abort()` and **throw**.
- Make terminator detection robust: `const p = trimmed.replace(/^data:\s*/, ''); if (p === '[DONE]') break;` and also `break` when a chunk's `choices[0].finish_reason` is set.
- Wrap the read loop in `try/finally` that releases the reader.

In `api/chat.ts`, wrap the streamed call so it can never block the response:
```ts
try {
  await Promise.race([
    callLLMStreaming(llmMessages, onTok, TOOLS),
    new Promise((_, rej) => setTimeout(() => rej(new Error('stream timeout')), 30000)),
  ]);
} catch (e) {
  console.error('stream failed/timeout, falling back:', e);
  try { const f = await callLLM({ messages: llmMessages }); if (f) res.write(`data: ${JSON.stringify({t:'tok',c:f})}\n\n`); } catch {}
}
```

### Fix 3 — ALWAYS terminate the SSE response (defense in depth)
Guarantee the final `{t:'done'}` + `res.end()` run on every path, including thrown errors, by putting them in a `finally` around the whole handler body (and write a `{t:'done', turns:[]}` if nothing else was sent). The response must never be left open.

### Fix 4 — client-side watchdog (never let the UI hang)
In `src/lib/assistant/useAssistant.ts` `fetchSSE`, add a timeout (e.g. 40s) on the read loop: if no `done` event arrives, abort the fetch, stop the loading state, and render a graceful "Sorry, that timed out — please retry." So even a server hang can't lock the UI. Mirror the clean turn shape used by `mockProvider.ts`.

## Files to change
- `api/chat.ts` — replace the streamed answer branch with a non-streamed final call (Fix 1); ensure `{t:'done'}`+`res.end()` in a `finally` (Fix 3).
- `api/_llm.ts` — add timeout + robust `[DONE]`/`finish_reason` handling to `callLLMStreaming` (Fix 2); confirm a `toolChoice` param exists on the non-streaming `callLLMWithTools`/`callLLM`.
- `src/lib/assistant/useAssistant.ts` — client read-loop watchdog timeout (Fix 4).

## Acceptance criteria
1. The 4 brief strawman scenarios each return a clean grounded answer **within ~10s**, with a source chip — never an infinite spinner, never `tool_calls.…`/CoT/LaTeX.
2. "approval threshold for consulting engagements" returns the actual KB policy, cited.
3. If the model/stream errors or times out, the user sees a graceful retry message (not an endless spinner); server logs the cause.
4. The `/api/chat` response always terminates (a `{t:'done'}` event is always sent; `res.end()` always called).
5. Works in `mock` and `groq`.

## Test cases (added to TEST_PLAYBOOK.md)
- **TC-AI-01** (existing): grounded answer + source; no leak; **not stalled — answer within ~10s**.
- **TC-AI-11** (new): induce a slow/empty second call (or set a tiny timeout) → user gets a graceful timeout/fallback message, **never an infinite spinner**; `/api/chat` terminates.
