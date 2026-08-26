// References from a ticket to the objects it is about — requests, POs,
// suppliers, contracts, invoices.
//
// The point is that whoever picks the ticket up can see the context without
// hunting: the requester writes "the Bosch PO is wrong", and the agent needs the
// PO in one click. Many-to-many because a ticket is routinely about a PO *and*
// the supplier behind it.
//
// The picker is a type + searchable object list rather than a free-text id box:
// a mistyped id produces a link that looks real and goes nowhere.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAddTicketLink, useRemoveTicketLink, useTicketLinks } from '@/lib/db/hooks/use-tickets';
import { useRequests } from '@/lib/db/hooks/use-requests';
import { usePurchaseOrders } from '@/lib/db/hooks/use-purchase-orders';
import { useSuppliers } from '@/lib/db/hooks/use-suppliers';
import { useContracts } from '@/lib/db/hooks/use-contracts';
import { useInvoices } from '@/lib/db/hooks/use-invoices';
import { TICKET_LINK_META, TICKET_LINK_TYPES, type TicketLinkType } from '@/data/types';

interface TicketLinksPanelProps {
  ticketId: string;
  actor: { id: string; name: string };
  /**
   * Types this user may link. Defaults to everything (the agent view); the
   * requester view passes their role's subset so the picker can't be used to
   * enumerate objects the role has no access to.
   */
  allowedTypes?: readonly TicketLinkType[];
  /** Restrict requests to ones the user raised — the requester view. */
  ownRequestsOnlyFor?: string;
  /** Hide the panel entirely when the user may link nothing. */
  readOnly?: boolean;
}

interface Candidate {
  id: string;
  label: string;
}

export function TicketLinksPanel({
  ticketId,
  actor,
  allowedTypes = TICKET_LINK_TYPES,
  ownRequestsOnlyFor,
  readOnly = false,
}: TicketLinksPanelProps) {
  const { data: links = [] } = useTicketLinks(ticketId);
  const addLink = useAddTicketLink();
  const removeLink = useRemoveTicketLink();

  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<TicketLinkType>(allowedTypes[0] ?? 'purchase-request');
  const [search, setSearch] = useState('');

  const { data: requests = [] } = useRequests();
  const { data: orders = [] } = usePurchaseOrders();
  const { data: suppliers = [] } = useSuppliers();
  const { data: contracts = [] } = useContracts();
  const { data: invoices = [] } = useInvoices();

  // One shape for the picker regardless of object kind, so the search and the
  // render below don't branch per type.
  const candidates = useMemo<Candidate[]>(() => {
    switch (type) {
      case 'purchase-request':
        return requests
          .filter((r) => !ownRequestsOnlyFor || r.requestorId === ownRequestsOnlyFor)
          .map((r) => ({ id: r.id, label: r.title }));
      case 'purchase-order':
        return orders.map((o) => ({ id: o.id, label: `${o.supplierName} — ${o.status}` }));
      case 'supplier':
        return suppliers.map((s) => ({ id: s.id, label: s.name }));
      case 'contract':
        return contracts.map((c) => ({ id: c.id, label: c.title }));
      case 'invoice':
        return invoices.map((i) => ({ id: i.id, label: `${i.supplierName} — ${i.currency} ${i.amount}` }));
      default:
        return [];
    }
  }, [type, requests, orders, suppliers, contracts, invoices, ownRequestsOnlyFor]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const linked = new Set(links.filter((l) => l.objectType === type).map((l) => l.objectId));
    return candidates
      .filter((c) => !linked.has(c.id))
      .filter((c) => !q || `${c.id} ${c.label}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [candidates, search, links, type]);

  async function handleAdd(candidate: Candidate) {
    try {
      await addLink.mutateAsync({
        ticketId,
        objectType: type,
        objectId: candidate.id,
        label: candidate.label,
        actor,
      });
      setSearch('');
      setAdding(false);
      toast.success(`Linked ${candidate.id}`);
    } catch {
      toast.error('Could not add the link. Please try again.');
    }
  }

  async function handleRemove(linkId: string, description: string) {
    try {
      await removeLink.mutateAsync({ linkId, ctx: { ticketId, actor, description } });
      toast.success('Link removed');
    } catch {
      toast.error('Could not remove the link.');
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          References
        </p>
        {!readOnly && allowedTypes.length > 0 && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => setAdding((a) => !a)}>
            <Plus className="mr-1 size-3" />
            {adding ? 'Cancel' : 'Link'}
          </Button>
        )}
      </div>

      {links.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">
          {readOnly || allowedTypes.length === 0
            ? 'Nothing linked.'
            : 'Nothing linked yet — add the request, PO or supplier this is about.'}
        </p>
      )}

      {links.length > 0 && (
        <div className="mb-2 space-y-1.5">
          {links.map((l) => {
            const meta = TICKET_LINK_META[l.objectType];
            return (
              <div key={l.id} className="flex items-center gap-2 rounded border bg-white px-2.5 py-1.5">
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600">
                  {meta?.label ?? l.objectType}
                </span>
                <Link
                  to={meta?.path(l.objectId) ?? '#'}
                  className="inline-flex min-w-0 items-center gap-1 text-sm text-blue-600 hover:underline"
                >
                  <span className="font-mono text-xs">{l.objectId}</span>
                  {l.label && <span className="truncate text-gray-600">— {l.label}</span>}
                  <ExternalLink className="size-3 shrink-0" />
                </Link>
                {!readOnly && (
                <button
                  onClick={() => handleRemove(l.id, `${l.objectType} ${l.objectId}`)}
                  aria-label={`Remove link to ${l.objectId}`}
                  className="ml-auto rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <X className="size-3.5" />
                </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {adding && (
        <div className="space-y-2 rounded border bg-gray-50 p-2.5">
          <div className="flex gap-2">
            <Select value={type} onValueChange={(v) => { setType(v as TicketLinkType); setSearch(''); }}>
              <SelectTrigger className="h-8 w-[150px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowedTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TICKET_LINK_META[t].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by id or name…"
              className="h-8 flex-1 bg-white"
            />
          </div>
          {matches.length === 0 ? (
            <p className="px-1 text-xs text-muted-foreground">
              {search ? 'No matches' : 'Start typing to search'}
            </p>
          ) : (
            <div className="divide-y rounded border bg-white">
              {matches.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleAdd(c)}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                >
                  <span className="font-mono text-xs text-gray-400">{c.id}</span>
                  <span className="truncate text-gray-700">{c.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
