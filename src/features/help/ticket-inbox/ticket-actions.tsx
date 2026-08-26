// Working actions on a ticket: assign, forward, status, reply.
//
// Forwarding is reassignment plus a mandatory handover note, not a separate
// concept — one ownership model rather than two. The note is written as an
// internal response so the reasoning stays on the thread where the next agent
// reads it, rather than vanishing into an audit row nobody opens.

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Lock, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useAddTicketResponse,
  useAssignTicket,
  useSetTicketStatus,
} from '@/lib/db/hooks/use-tickets';
import { useUsers } from '@/lib/db/hooks/use-users';
import { internalRoles } from '@/config/roles';
import type { Role } from '@/config/roles';
import type { Ticket, TicketStatus } from '@/data/types';

const UNASSIGNED = '__unassigned__';

/** Statuses an agent can set. Terminal states are reachable, and reversible. */
const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'waiting-on-user', label: 'Waiting on user' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface TicketActionsProps {
  ticket: Ticket;
  actor: { id: string; name: string };
}

export function TicketActions({ ticket, actor }: TicketActionsProps) {
  const { data: users = [] } = useUsers();
  const assign = useAssignTicket();
  const setStatus = useSetTicketStatus();
  const addResponse = useAddTicketResponse();

  const [reply, setReply] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<TicketStatus | null>(null);
  const [resolution, setResolution] = useState('');

  // Only internal staff can own a ticket — an external supplier must never
  // appear in the picker. Out-of-office users are shown but labelled, so the
  // assigner can see they are picking someone who is away.
  const assignable = useMemo(
    () => users.filter((u) => internalRoles.includes(u.role as Role)),
    [users],
  );

  async function handleAssign(value: string) {
    const owner = value === UNASSIGNED ? null : assignable.find((u) => u.id === value);
    if (value !== UNASSIGNED && !owner) return;
    try {
      await assign.mutateAsync({
        id: ticket.id,
        owner: owner ? { id: owner.id, name: owner.name } : null,
        actor,
      });
      toast.success(owner ? `Assigned to ${owner.name}` : 'Returned to the unassigned queue');
    } catch {
      toast.error('Could not change the owner. Please try again.');
    }
  }

  async function handleStatus(next: TicketStatus) {
    // Resolving needs a note, so it becomes a two-step rather than firing blind.
    if (next === 'resolved') {
      setPendingStatus('resolved');
      return;
    }
    try {
      await setStatus.mutateAsync({ id: ticket.id, status: next, actor });
      toast.success(`Status set to ${next.replace(/-/g, ' ')}`);
    } catch {
      toast.error('Could not change the status.');
    }
  }

  async function handleResolve() {
    if (!resolution.trim()) {
      toast.error('Add a resolution note so the requester knows what happened.');
      return;
    }
    try {
      await setStatus.mutateAsync({
        id: ticket.id,
        status: 'resolved',
        resolution: resolution.trim(),
        actor,
      });
      setResolution('');
      setPendingStatus(null);
      toast.success('Ticket resolved');
    } catch {
      toast.error('Could not resolve the ticket.');
    }
  }

  async function handleReply() {
    if (!reply.trim()) return;
    try {
      await addResponse.mutateAsync({
        ticketId: ticket.id,
        body: reply.trim(),
        authorId: actor.id,
        authorName: actor.name,
        isInternal,
      });
      setReply('');
      toast.success(isInternal ? 'Internal note added' : 'Reply sent to the requester');
    } catch {
      toast.error('Could not post. Please try again.');
    }
  }

  const busy = assign.isPending || setStatus.isPending || addResponse.isPending;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Owner
          </label>
          <Select value={ticket.ownerId ?? UNASSIGNED} onValueChange={handleAssign} disabled={busy}>
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              {actor.id && !assignable.some((u) => u.id === actor.id) && (
                <SelectItem value={actor.id}>{actor.name} (me)</SelectItem>
              )}
              {assignable.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                  {u.id === actor.id ? ' (me)' : ''}
                  {u.isOOO ? ' — out of office' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Status
          </label>
          <Select
            value={ticket.status}
            onValueChange={(v) => handleStatus(v as TicketStatus)}
            disabled={busy}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {pendingStatus === 'resolved' && (
        <div className="space-y-2 rounded border border-green-200 bg-green-50 p-3">
          <p className="text-xs font-medium text-green-900">
            What resolved it? The requester sees this.
          </p>
          <Textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="e.g. Access rights corrected — the PO is now editable."
            className="min-h-[70px] bg-white text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" className="h-7" onClick={handleResolve} disabled={busy}>
              Resolve ticket
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={() => { setPendingStatus(null); setResolution(''); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            {isInternal ? 'Internal note' : 'Reply to requester'}
          </label>
          <button
            type="button"
            onClick={() => setIsInternal((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
              isInternal
                ? 'bg-amber-100 text-amber-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Lock className="size-2.5" />
            {isInternal ? 'Internal — requester cannot see this' : 'Make internal'}
          </button>
        </div>
        <Textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder={isInternal ? 'Context for whoever picks this up next…' : 'Write back to the requester…'}
          className={`min-h-[80px] text-sm ${isInternal ? 'border-amber-200 bg-amber-50' : ''}`}
        />
        <div className="mt-2 flex justify-end">
          <Button size="sm" className="h-7" onClick={handleReply} disabled={busy || !reply.trim()}>
            <Send className="mr-1 size-3" />
            {isInternal ? 'Add note' : 'Send reply'}
          </Button>
        </div>
      </div>
    </div>
  );
}
