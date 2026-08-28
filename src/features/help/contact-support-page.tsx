import { useState, useEffect } from 'react';
import { Mail, Clock, Phone, ExternalLink, Sparkles, ArrowRight, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { createTicket, listTickets } from '@/lib/db/tickets';
import { useTicketResponses } from '@/lib/db/hooks/use-tickets';
import { TicketLinksPanel } from '@/features/help/ticket-inbox/ticket-links-panel';
import { ticketLinkTypesForRole } from '@/config/roles';
import type { TicketLinkType } from '@/data/types';
import type { Ticket as TicketRecord } from '@/data/types';
import { TicketPriorityBadge, TicketStatusBadge } from '@/features/help/ticket-inbox/ticket-badges';
import { useAuthStore } from '@/stores/auth-store';
import { openAIChatWithPrompt } from '@/features/ai-assistant/ai-chat-controls';

const faqLinks = [
  { question: 'How do I submit a procurement request?', articleId: 'gs-1' },
  { question: 'How do approvals work?', articleId: 'ra-2' },
  { question: 'How do I onboard a new supplier?', articleId: 'sup-1' },
  { question: 'What are the buying channels?', articleId: 'gs-2' },
];

function AskAIBanner() {
  const [prompt, setPrompt] = useState('');
  const navigate = useNavigate();

  function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;
    openAIChatWithPrompt(trimmed);
    setPrompt('');
  }

  return (
    <Card className="border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100">
          <Sparkles className="size-4 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-900">Try asking the AI assistant first</p>
          <p className="text-xs text-amber-700 mb-3">It answers policy questions, looks up requests, and can take actions — instantly, 24/7.</p>
          <form onSubmit={handleAsk} className="flex gap-2">
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. What is the consulting threshold?"
              className="flex-1 h-8 text-sm bg-white border-amber-200"
            />
            <Button type="submit" size="sm" className="h-8 bg-amber-500 hover:bg-amber-600 shrink-0">
              Ask
            </Button>
          </form>
        </div>
        <button
          onClick={() => navigate('/help/assistant')}
          className="flex shrink-0 items-center gap-1 text-xs text-amber-700 hover:text-amber-900"
        >
          Open Assistant
          <ArrowRight className="size-3" />
        </button>
      </div>
    </Card>
  );
}

/**
 * The agent's reply, as the requester sees it. `useTicketResponses` is called
 * without `includeInternal`, so internal notes are filtered out in the data
 * layer — the requester never receives them, rather than receiving them and
 * having the component decline to render.
 */
function RequesterThread({
  ticketId,
  resolution,
  actor,
  allowedTypes,
}: {
  ticketId: string;
  resolution?: string;
  actor: { id: string; name: string };
  allowedTypes: TicketLinkType[];
}) {
  const { data: responses = [], isLoading } = useTicketResponses(ticketId);

  if (isLoading) return <p className="py-2 text-xs text-muted-foreground">Loading replies…</p>;

  return (
    <div className="space-y-2 py-2">
      {/* The requester can point support at the request/PO/supplier the ticket
          is about — the types are scoped to what their role can already see. */}
      <div className="rounded border bg-gray-50 p-2.5">
        <TicketLinksPanel
          ticketId={ticketId}
          actor={actor}
          allowedTypes={allowedTypes}
          ownRequestsOnlyFor={actor.id}
          readOnly={allowedTypes.length === 0}
        />
      </div>
      {responses.length === 0 && !resolution && (
        <p className="text-xs text-muted-foreground">No replies yet.</p>
      )}
      {responses.map((r) => (
        <div key={r.id} className="rounded border bg-white p-2.5">
          <div className="mb-0.5 flex items-center gap-2">
            <span className="text-xs font-medium text-gray-700">{r.authorName ?? 'Support'}</span>
            <span className="ml-auto text-[11px] text-gray-400">
              {format(parseISO(r.createdAt), 'dd MMM, HH:mm')}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{r.body}</p>
        </div>
      ))}
      {resolution && (
        <div className="rounded border border-green-200 bg-green-50 p-2.5">
          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-green-800">
            Resolution
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{resolution}</p>
        </div>
      )}
    </div>
  );
}

function MyTickets({
  userName,
  isAdmin,
  actor,
  allowedTypes,
}: {
  userName: string;
  isAdmin: boolean;
  actor: { id: string; name: string };
  allowedTypes: TicketLinkType[];
}) {
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      // Entitlement is applied inside listTickets so it can't be widened here.
      const rows = await listTickets(userName, { allTickets: isAdmin, limit: 20 }).catch(() => []);
      setTickets(rows);
      setLoading(false);
    })();
  }, [userName, isAdmin]);

  if (loading) {
    return <p className="text-sm text-muted-foreground py-4">Loading tickets…</p>;
  }

  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <Ticket className="size-8 text-gray-300" />
        <p className="text-sm text-muted-foreground">No tickets yet</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {tickets.map((t) => (
        <div key={t.id} className="py-3">
          <button
            onClick={() => setExpanded((e) => (e === t.id ? null : t.id))}
            className="flex w-full items-start gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="text-xs font-mono text-gray-400">{t.id}</span>
              <TicketStatusBadge status={t.status} />
              {t.priority && <TicketPriorityBadge priority={t.priority} />}
            </div>
            <p className="text-sm text-gray-800 truncate">{t.summary}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {t.category && <span className="mr-2 capitalize">{t.category.replace('-', ' ')}</span>}
              {format(parseISO(t.createdAt), 'dd MMM yyyy, HH:mm')}
              {isAdmin && t.createdBy !== userName && (
                <span className="ml-2 text-gray-500">— {t.createdBy}</span>
              )}
            </p>
          </div>
          </button>
          {expanded === t.id && (
            <RequesterThread
              ticketId={t.id}
              resolution={t.resolution}
              actor={actor}
              allowedTypes={allowedTypes}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function ContactSupportPage() {
  const navigate = useNavigate();
  const { currentUser, currentRole } = useAuthStore();
  const isAdmin = currentRole === 'admin' || currentRole === 'procurement-manager';

  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ticketCount, setTicketCount] = useState(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category || !priority || !subject || !description) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      // ID generation and the insert both live in the ticket module so every
      // intake path shares one sequence — this page used to count rows, which
      // reused an ID whenever a ticket had been deleted.
      const ticket = await createTicket({
        summary: subject,
        context: `Category: ${category}\nPriority: ${priority}\nSubmitted by: ${name} (${email})\n\n${description}`,
        createdBy: currentUser.name,
        category,
        priority,
        source: 'form',
      });

      toast.success(`Ticket ${ticket.id} submitted — we'll get back to you within 4 hours.`);
      setTicketCount((n) => n + 1);
      setCategory('');
      setPriority('');
      setSubject('');
      setDescription('');
    } catch {
      // Keep the form populated so the user doesn't retype everything.
      toast.error('Failed to submit ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contact Support"
        subtitle="Get help from our support team"
      />

      {/* AI banner */}
      <AskAIBanner />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: Contact form */}
        <div className="lg:col-span-3">
          <Card className="p-6">
            <h3 className="mb-4 text-sm font-medium text-gray-700">Submit a support ticket</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                      <SelectItem value="billing">Billing</SelectItem>
                      <SelectItem value="feature-request">Feature Request</SelectItem>
                      <SelectItem value="bug-report">Bug Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief description of your issue"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Please provide as much detail as possible..."
                  rows={5}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit Support Ticket'}
              </Button>
            </form>
          </Card>

          {/* My Tickets */}
          <Card className="mt-4 p-6">
            <h3 className="mb-1 text-sm font-medium text-gray-700">
              {isAdmin ? 'All Tickets' : 'My Tickets'}
            </h3>
            <p className="mb-4 text-xs text-muted-foreground">
              {isAdmin ? 'All submitted support tickets' : 'Tickets you have submitted'}
            </p>
            <MyTickets
              userName={currentUser.name}
              isAdmin={isAdmin}
              actor={{ id: currentUser.id, name: currentUser.name }}
              allowedTypes={ticketLinkTypesForRole(currentRole) as TicketLinkType[]}
              key={ticketCount}
            />
          </Card>
        </div>

        {/* Right: Support info + FAQ */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-6 space-y-4">
            <h3 className="font-medium">Support Information</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Mail className="size-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">support@gp-procurement.com</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="size-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Business Hours</p>
                  <p className="text-sm text-muted-foreground">Mon-Fri, 8:00 AM - 6:00 PM CET</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="size-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Response Time</p>
                  <p className="text-sm text-muted-foreground">Less than 4 hours during business hours</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="size-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Emergency Hotline</p>
                  <p className="text-sm text-muted-foreground">+49 69 123 456 789</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-3">
            <h3 className="font-medium">Frequently Asked Questions</h3>
            <div className="space-y-2">
              {faqLinks.map((faq) => (
                <button
                  key={faq.articleId}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-blue-700 hover:bg-blue-50"
                  onClick={() => navigate('/help/kb')}
                >
                  <ExternalLink className="size-3.5 shrink-0" />
                  {faq.question}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
