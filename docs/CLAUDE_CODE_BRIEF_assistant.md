# Claude Code Brief — Upgrade the AI Assistant into the Procurement Support Chatbot

**Repo:** Maxbase91/orchestration-ui
**Target:** extend the existing `src/features/ai-assistant/` module
**Mode:** mock data only, no live integrations
**Model layer:** Groq, via a Vercel serverless function (key stays server-side)

---

## 0. Read first

Before writing code, read these so you match existing conventions exactly:

- `README.md` and `procurement_platform_ui_requirements_v2.md`
- `src/features/ai-assistant/` — the current floating overlay + full-page mode and its ~50 keyword patterns. **You are upgrading this, not adding a parallel module.**
- `src/lib/` — the existing mock AI engine. The new provider layer wraps/replaces this.
- `src/data/` — the typed mock data files (requests, suppliers, contracts, POs, invoices, etc.). All lookups and actions read/write these.
- `src/config/` — navigation, roles, theme tokens.
- `src/stores/` — Zustand store patterns.
- `api/` and `.env.example` — the serverless function goes here; the Groq key goes in env.

Do not invent new top-level folders. Follow the structure that exists.

---

## 1. What we're building

Turn the keyword-matching AI assistant into a conversational procurement chatbot with five capabilities. The defining behaviour: **easy questions are answered inside the chat; complex tasks return a deep-link callout into the existing platform UI.** Every state-changing action is read back and confirmed before it fires.

### The five capabilities

1. **Knowledge** — grounded Q&A over procurement knowledge (KOPs, FAQs, policies, preferred suppliers, category instructions). Mock the knowledge base as a typed file in `src/data/` (e.g. `knowledgeBase.ts`) with `{ id, title, body, source, tags }`. Answers must cite the source field.
2. **Transactional lookup** — return status + key facts for an object (request, supplier, contract, risk assessment, PO, invoice, payment, ticket) by reading existing mock data. Short answers stay in chat; full detail returns a deep-link callout.
3. **Action trigger** — build a structured action, show a confirmation read-back, then on confirm mutate the relevant Zustand store / mock data and return a result with a reference ID. Cover the action catalogue below.
4. **Ticket / handover** — when no grounded answer and no safe action exists, or the user asks for a person, summarise the gathered context, create a mock ticket (`src/data/tickets.ts`), return the ticket ID.
5. **Demand intake** — detect buy intent, gather the minimum (category, rough value, supplier if known), then deep-link into the existing New Request wizard (`src/features/requests/`) with fields pre-populated via route state or the requests store.

### Action catalogue (mock, end-to-end)

Self-serve (fire after confirm): add a watcher, set own approval delegate, set out-of-office.
Team task (create a routed task): approver substitution, reassign a request, request a risk reassessment, request a contract renewal, request a PO change, raise a payment-status escalation.
All actions append to an audit/activity log in mock data.

---

## 2. Architecture to implement

### 2.1 Provider abstraction (the key design point)

Create a response-provider interface so the same UI runs keyless or on Groq:

```
src/lib/assistant/
  provider.ts        // interface: respond(messages, context) => AssistantTurn
  mockProvider.ts    // upgraded keyword/intent engine, no network
  groqProvider.ts    // calls /api/chat, uses Groq tool-calling
  intents.ts         // intent types + routing
  tools.ts           // tool/function definitions (see 2.3)
  capabilities/      // one handler per capability, all read src/data
    knowledge.ts
    lookup.ts
    action.ts
    handover.ts
    intake.ts
```

Select the provider from an env flag (e.g. `VITE_ASSISTANT_PROVIDER=mock|groq`), defaulting to `mock` so the build always runs without a key.

### 2.2 Groq via serverless function

- Add `api/chat.ts` (Vercel function). It holds `GROQ_API_KEY` (server-side env, never `VITE_`-prefixed). It proxies to Groq's OpenAI-compatible chat completions endpoint, supports streaming, and passes through tool definitions and tool results.
- Model: a current Groq-hosted model (e.g. a Llama 3.3 70B class model) — confirm the exact model id against Groq's docs at build time; do not hardcode a stale id.
- Add `GROQ_API_KEY=` and `VITE_ASSISTANT_PROVIDER=mock` to `.env.example`.
- The frontend never sees the key. It only calls `/api/chat`.

### 2.3 Tool-calling, not freestyle

The model must not answer about platform data from its own head. Define tools the model can call; your code executes them against mock data and returns grounded results:

- `search_knowledge(query)` → returns matching knowledge entries with source
- `lookup_object(type, identifier)` → returns status + key facts + deep-link target
- `propose_action(action_type, params)` → returns a confirmation payload (does NOT execute)
- `execute_action(action_id)` → only callable after explicit user confirm in the UI
- `create_ticket(summary, context)` → returns ticket id
- `start_demand(category, value, supplier?)` → returns the prefilled-wizard deep-link

The mock provider implements the same routing with keyword/intent rules so behaviour is identical without Groq.

---

## 3. UI requirements

Match the strawman and the platform's existing visual language (reuse shadcn/ui, lucide-react, the theme tokens — Navy #1B2A4A, Medium Blue #2D5F8A, Amber #D4782F; AI cards use the existing blue-tinted + sparkle treatment).

- Keep both existing modes (floating overlay + full-page) but render the new richer turn types in both.
- **Turn types to render:**
  - `chat-answer` — plain grounded answer, with a source chip when from knowledge.
  - `deep-link` — a distinct bordered callout: an "opens in platform" label, an icon, and a named target (e.g. "Vendor 360 — Acme Logistics"). Clicking navigates via React Router to the real screen with the object id. This is a component, not an inline link.
  - `confirm` — amber "confirm before I act" header, the read-back, and Confirm / Edit buttons. Only on Confirm does `execute_action` run.
  - `suggestion-chips` — the "one step ahead" forward steps, role-filtered.
- **Forward step on every turn** where one applies (lookup → propose related action; expiring contract → renewal; etc.).
- **Role awareness:** read the current role from the existing role store. Filter both the data returned and the actions/chips offered to match the existing permission matrix. A requestor gets "raise a demand"; an Operations Lead does not.

### Deep-link targets (use real routes in the repo)

Vendor 360 → supplier profile route; contract → contract detail; demand status → request detail (Workflow tab); bid comparison → Evaluation Centre; spend → Spend Overview; bottlenecks → Workflow Monitor; a form → the relevant wizard step.

---

## 4. Guardrails (must hold even in mock)

- No `execute_action` without an explicit user Confirm in the UI.
- No write-back to controlled master data (vendor bank details etc.) — those route to a ticket only.
- No factual claim without a tool result behind it. If `search_knowledge` and `lookup_object` both miss, the bot says it has no grounded answer and offers a handover.
- Every executed action writes an audit/activity entry in mock data.
- Groq key is server-side only. Fail the build review if any `VITE_`-prefixed var holds a secret.

---

## 5. Suggested work order

1. Read the repo (section 0). Confirm the exact route paths and store APIs.
2. Add `knowledgeBase.ts` and `tickets.ts` to `src/data/`; add an activity-log append helper.
3. Build the provider interface + `mockProvider` + capability handlers against mock data. Get the five flows working keyless end-to-end.
4. Build the new turn-type components (deep-link callout, confirm, source chip, chips) and wire them into both assistant modes.
5. Add role filtering from the role store.
6. Add `api/chat.ts` + `groqProvider.ts`; put the flag in `.env.example`. Test with a key locally.
7. Verify on the four strawman scenarios: consulting threshold (chat answer), Acme risk status (chat + Vendor 360 deep-link + forward step), set delegate (confirm → execute), compare bids (deep-link to Evaluation Centre).
8. Build, run lint, push to a feature branch — not straight to main.

---

## 6. Acceptance criteria

- The four strawman scenarios behave exactly as described, in both mock and Groq modes.
- With no Groq key and `VITE_ASSISTANT_PROVIDER=mock`, the full feature works.
- Switching to `groq` changes only the reasoning layer; UI, tools, grounding, and guardrails are identical.
- No secret is exposed to the client bundle.
- Role switching changes the data and actions the bot offers.
- Nothing that already worked in the platform is broken.
