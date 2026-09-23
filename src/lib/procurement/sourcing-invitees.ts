// Who is invited when a sourcing event is created from a request.
//
// Three sources, one list: the supplier the requester named (the determination
// screened against them), the shortlist they added (request_supplier_candidates,
// captured at submission), and every PREFERRED supplier for the request's
// category (category_preferred_suppliers, /admin/categories). The last was not
// there: a category's preferred suppliers were only ever a soft check on the
// named supplier, so an event could go out without the suppliers the category
// had already agreed to prefer.
//
// Pure, so the rule is tested without a browser; relative imports for node.

export interface Invitee {
  id: string;
  name: string;
  /** Why this supplier is on the list — shown to the buyer, and in the audit. */
  reason: 'named' | 'shortlist' | 'preferred';
}

export function sourcingInvitees(input: {
  namedSupplierId?: string | null;
  shortlistIds: readonly string[];
  preferredIds: readonly string[];
  lookup: (id: string | undefined) => { id: string; name: string } | undefined;
}): Invitee[] {
  const out = new Map<string, Invitee>();
  const add = (id: string | null | undefined, reason: Invitee['reason']) => {
    const supplier = input.lookup(id ?? undefined);
    // The first reason wins: a preferred supplier the requester also named is
    // "named", which is the stronger statement.
    if (supplier && !out.has(supplier.id)) out.set(supplier.id, { id: supplier.id, name: supplier.name, reason });
  };
  add(input.namedSupplierId, 'named');
  for (const id of input.shortlistIds) add(id, 'shortlist');
  for (const id of input.preferredIds) add(id, 'preferred');
  return [...out.values()];
}
