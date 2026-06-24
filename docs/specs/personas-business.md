# Who Uses the Procurement Platform — A Business Guide to the Personas

*A plain-language companion to the technical [personas.md](personas.md). Written for sponsors,
business stakeholders, and change/training teams — no jargon.*

---

## Why this matters

Different people use this platform for very different reasons — and they need very different amounts of
help. A marketing manager who buys something twice a year should find it effortless. A procurement
manager who lives in it all day needs power and control. Getting this right is the difference between a
tool people *adopt* and a tool people *avoid*.

This guide describes the **six types of user**, what each one does, what they care about, and **how much
effort and training each will realistically need** — both for the first release and for the full vision.

---

## The six people who use the platform

| Persona | In one sentence | Think of them as… |
|---|---|---|
| **The Requestor** | A business person who needs to buy something. | "I just need this — make it easy." |
| **The Procurement Manager** | Runs the demand pipeline and sourcing strategy. | The pilot in the cockpit. |
| **The Vendor Manager** | Keeps suppliers compliant and low-risk. | The gatekeeper for suppliers. |
| **The Operations Lead** | Keeps everything moving and on time. | The air-traffic controller. |
| **The Administrator** | Sets the rules the platform runs on. | The architect / rule-maker. |
| **The Supplier** | An external company we buy from. | The outside partner. |

The first five work **inside** the organisation and share the same app. The **Supplier** is external and
uses a separate, private portal — they never see anything internal.

---

## How much effort each persona needs

Not everyone needs the same training or hand-holding. This is deliberate:

```
   Easiest ──────────────────────────────────────────────► Most involved
  Requestor    Supplier     Vendor Mgr · Ops Lead     Proc. Manager    Administrator
  (self-serve) (own portal)   (focused specialists)    (power user)     (expert)
```

- We push the **effort down** for the Requestor — the people who use it least should need the least
  training. The platform does the thinking for them.
- We **concentrate the complexity** in the Procurement Manager and Administrator — trained, full-time
  users who *want* control and depth.

**Practical implication for rollout:** light-touch onboarding (or none) for Requestors and Suppliers;
proper enablement and reference material for Managers, Vendor Managers, and Ops Leads; deep training +
guardrails for Administrators.

---

## The personas in detail

### 🧑‍💼 The Requestor — "I just need to buy something"
**Effort level: Very low.** *The person we most protect from complexity.*

- **A day in their life:** They occasionally need to buy a service, product, or renew a contract. They
  don't know (or want to know) procurement rules.
- **What they do:** Describe what they need in plain words. The platform figures out the rest — whether
  it can come from a catalogue, an existing contract, or needs a full request — and asks only the few
  questions that genuinely matter. They get a clear recommendation and simple next steps, and can track
  progress and approve things they own.
- **What they care about:** Speed, simplicity, knowing "what happens next."
- **Training needed:** Essentially none — it works like a guided conversation.
- **Release 1 → full vision:** Already simple in R1. In the full vision it gets even more automatic —
  more requests complete themselves, and the assistant *does* the next steps rather than just pointing
  to them.

### 🎯 The Procurement Manager — "I run the procurement engine"
**Effort level: High.** *The daily power user and main approver.*

- **A day in their life:** Watches the whole pipeline of demand, steers how things get sourced, approves
  spend, and keeps suppliers and contracts in good shape.
- **What they do:** Sees a control-tower view that leads with "what needs attention," key performance
  numbers, and the demand pipeline. Approves requests, reviews recommendations, runs sourcing, and
  oversees suppliers and contracts.
- **What they care about:** Visibility, control, getting the right outcome, and spotting problems early.
- **Training needed:** Meaningful — this is a professional tool for a professional user.
- **Release 1 → full vision:** In R1 they decide and route; in the full vision they also *execute*
  live (sourcing, contracts, orders happen in the connected systems), with more routine work automated
  so they focus on the exceptions.

### 🛡️ The Vendor Manager — "I keep our suppliers safe and compliant"
**Effort level: Medium-high (specialist).**

- **A day in their life:** Validates incoming requests, checks suppliers are permitted and low-risk, and
  manages supplier compliance.
- **What they do:** Works a validation queue, monitors supplier risk and compliance, flags problem
  suppliers, and takes part in sourcing.
- **What they care about:** Risk, compliance, supplier quality.
- **Training needed:** Moderate, focused on their specialism.
- **Release 1 → full vision:** R1 surfaces risk and screening signals; the full vision adds live
  background checks and ongoing automated re-assessment.

### 🛫 The Operations Lead — "I keep things moving"
**Effort level: Medium-high (operational).**

- **A day in their life:** Makes sure nothing gets stuck — watches workflow health, clears bottlenecks,
  and keeps things within their deadlines (SLAs). Oversees the order-to-pay operation.
- **What they do:** Uses an operations cockpit (workflow health, bottlenecks, SLA tracking) and manages
  purchasing operations and contracts.
- **What they care about:** Throughput, timeliness, no surprises.
- **Training needed:** Moderate, operational focus.
- **Release 1 → full vision:** As automation grows, they move from firefighting to continuous
  improvement.

### ⚙️ The Administrator — "I set the rules"
**Effort level: Expert.** *The most powerful — and the most carefully guarded.*

- **A day in their life:** Configures how the platform behaves for everyone — the rules, thresholds,
  approval chains, workflows, categories, users, and the AI assistants.
- **What they do:** Tunes the decision thresholds (with a built-in "simulate before you save" preview),
  manages routing rules, approval chains, the workflow designer, user accounts, policies, and the
  knowledge base.
- **What they care about:** Getting the rules right, governance, and not breaking things for everyone.
- **Training needed:** Significant — this role can change behaviour platform-wide.
- **Release 1 → full vision:** R1 already lets them configure the decision-making live. The full vision
  adds governing the live system connections and the AI models themselves.

### 🤝 The Supplier — "I'm the external partner"
**Effort level: Low-to-medium.** *Outside the organisation, in their own private portal.*

- **A day in their life:** Engages with us from the outside — gets onboarded, responds to sourcing
  opportunities, submits invoices, and exchanges messages and documents.
- **What they do:** Uses a dedicated supplier portal (separate from everything internal) to manage their
  profile, onboarding, sourcing responses, invoices, and documents.
- **What they care about:** Easy onboarding, getting paid, clear communication.
- **Training needed:** Light — self-service by design.
- **Release 1 → full vision:** R1 is self-service; the full vision adds richer two-way collaboration and
  status updates. Their sensitive details (e.g. bank information) stay protected and visible only to
  authorised internal users.

---

## What changes from Release 1 to the full vision

| | **Release 1 (today's scope)** | **Full vision (end state)** |
|---|---|---|
| **What the platform does** | Understands the need, recommends the right path, and routes it — people then act in the connected systems. | Also *executes* the steps directly in the connected systems. |
| **Requestor** | Guided, simple. | Even more automatic; many needs self-complete. |
| **Manager / Admin** | Decide, configure, govern the decisioning. | Also run live execution and govern the integrations + AI. |
| **Ops / Vendor Mgr** | Monitor and validate manually where needed. | More is automated and self-healing. |
| **Supplier** | Self-service portal. | Deeper, integrated two-way collaboration. |

---

## The one design principle

> **Simple for the many, powerful for the few.**
> Make it effortless for occasional users (Requestors, Suppliers) and give depth and control to the
> daily professionals (Managers, Administrators). Most users should never feel the system's complexity —
> it should feel like it's doing the work *for* them.
