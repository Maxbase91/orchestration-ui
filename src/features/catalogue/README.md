# Catalogue — Door 2

`/catalogue` is where catalogue items are ordered, without a request: the
second door of the Intake Prototype.

- **The page** (`catalogue-page.tsx`): the catalogues are the ones the items
  belong to; a search spans them all; each item shows its price, agreement and
  lead time. The **basket** (`stores/catalogue-basket-store.ts`, per person, in
  the browser until placed) shows the total, deliver to and charged to (the
  requester's profile first, from `delivery_locations` and `cost_centres`), asks
  what it is for (the governed checkout requires a purpose), and says what will
  happen — from the same decision the server makes, so a lapsed supplier risk
  assessment reads as a risk review even under the auto-approval threshold.
- **Placing it**: `lib/procurement/catalogue-basket.ts` plans one order per
  supplier and contract, and the governed checkout's basket mode writes them in
  one transaction, all or none, **approved on the basket total** it computes from
  its own prices — so splitting a basket cannot dodge the threshold (ADR-0009).
- **The item page** (`/catalogue/items/:id`) shows an item and adds it to the
  basket. Everything else that offers a catalogue item adds to the basket too:
  the Home box, the assistant, and intake's catalogue match (`/catalogue?add=ID`).

Until 2026-09-25 there were three ways to order: a one-item checkout on the item
page run through the intake wizard, a catalogue step inside the wizard, and a
one-line basket inside the Home box. They are gone. No upstream purchasing
system is written by this feature.
