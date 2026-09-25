# Home intent: policy and status answers, from configuration

Asked by the product owner (2026-09-25): remove the duplicate-demand line; build
the policy / status intent on Home. Policy answers come from the existing
policy configuration; status answers are an AI agent whose configuration lists,
per object, which attributes may be asked about.

Decisions taken (2026-09-25):
- Status topics: requests (incl. "my open requests"), my approvals, POs,
  invoices, contracts, suppliers.
- Status is an **AI agent** (Admin → AI agents), not a new admin section.
- Attributes are **auto-listed** from the object's data model, **off** until an
  admin enables them. A guard test fails when an attribute has no entry.
- Per attribute: **label** the chatbot uses, **summary vs on-ask**, **who may
  see it** (everyone who can see the record / procurement roles only).
- Row access: a **role × object matrix**, cells None / Own / All. "Own" is
  defined per object (raised / beneficiary / owner; linked PO, invoice,
  contract, supplier). Approvals waiting on you are always own.
- Policy: configuration and knowledge base **aligned**. Figures the platform
  enforces come from configuration (linked into the entry); figures it does not
  enforce stay KB text, marked "policy text only". Entries that describe the
  platform wrongly are **rewritten**, and all entries move into the live
  knowledge base.
- Policy management page is removed (static third copy of the policy text,
  used nowhere).

## Commits
1. [x] Remove the duplicate-demand check — Review loading text, request-detail
       card, the record's `duplicateCheck` (column made nullable, no longer
       written), the dead `duplicateDetected` referral input.
2. [ ] Remove the Policy management page — route, nav, links, tests, docs.
3. [ ] Knowledge base linked to configuration — `{{policy:key}}` and
       `{{approval-chains}}` tokens rendered with live values (browser and
       server); entries rewritten to match the platform; linked / text-only
       marked on Admin → Knowledge base; backfill into the live table.
4. [ ] Status agent — `ai_agents.config` (nullable JSONB); AI-007 seeded;
       config model (objects → attributes; role × object access); admin UI on
       the agent; shared answer module; the assistant's lookups (browser and
       `api/chat.ts`) honour it.
5. [ ] Home intent step — policy and status answered inline on Home, with the
       follow-up into the assistant; page names still navigate; demands and
       catalogue unchanged.
6. [ ] Mock + docs.

## Verification
tsc, lint, test:all, the offline browser suites, a new browser check for the
Home answers, live backfills idempotent and read back; the production
interaction suite after deploy.
