import { useState } from 'react';
import { Send, Search, Plus, Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/page-header';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  sender: string;
  senderInitials: string;
  content: string;
  timestamp: string;
  isInternal: boolean;
}

interface Thread {
  id: string;
  supplierName: string;
  subject: string;
  lastMessage: string;
  lastTimestamp: string;
  unread: boolean;
  relatedTo?: string;
  messages: Message[];
}

const threads: Thread[] = [
  {
    id: 'thread-1',
    supplierName: 'Accenture',
    subject: 'Contract Renewal Discussion',
    lastMessage: 'Tuesday works. Let us set up a 1-hour slot at 2pm CET.',
    lastTimestamp: '2025-01-10 14:30',
    unread: true,
    relatedTo: 'CON-001',
    messages: [
      {
        id: 'm1',
        sender: 'James Chen',
        senderInitials: 'JC',
        content: 'Hi Patrick, the IT Strategy Advisory contract (CON-001) is up for renewal later this year. Can we schedule a call to discuss terms?',
        timestamp: '2025-01-08 10:15',
        isInternal: true,
      },
      {
        id: 'm2',
        sender: 'Patrick Sullivan (Accenture)',
        senderInitials: 'PS',
        content: 'Hi James, absolutely. We have been preparing an updated proposal with some enhanced scope items. Would next Tuesday work?',
        timestamp: '2025-01-09 09:30',
        isInternal: false,
      },
      {
        id: 'm3',
        sender: 'James Chen',
        senderInitials: 'JC',
        content: 'Tuesday works. Let us set up a 1-hour slot at 2pm CET. I will send a calendar invite.',
        timestamp: '2025-01-10 14:30',
        isInternal: true,
      },
    ],
  },
  {
    id: 'thread-2',
    supplierName: 'Accenture',
    subject: 'Compliance Documentation Update',
    lastMessage: 'We expect the updated certificate within 10 business days.',
    lastTimestamp: '2025-01-07 11:00',
    unread: false,
    messages: [
      {
        id: 'm4',
        sender: 'Anna Kowalski',
        senderInitials: 'AK',
        content: 'Hi Patrick, we noticed your ISO 27001 certificate is approaching renewal. Could you please upload the renewed version once available?',
        timestamp: '2025-01-05 16:00',
        isInternal: true,
      },
      {
        id: 'm5',
        sender: 'Patrick Sullivan (Accenture)',
        senderInitials: 'PS',
        content: 'Thanks for the reminder, Anna. The audit was completed last week and we expect the updated certificate within 10 business days. I will upload it as soon as we receive it.',
        timestamp: '2025-01-07 11:00',
        isInternal: false,
      },
    ],
  },
  {
    id: 'thread-3',
    supplierName: 'Accenture',
    subject: 'Invoice INV-011 Query',
    lastMessage: 'I will send the email approval chain and work order for your records.',
    lastTimestamp: '2025-01-06 09:45',
    unread: false,
    relatedTo: 'INV-011',
    messages: [
      {
        id: 'm6',
        sender: 'Michael Torres',
        senderInitials: 'MT',
        content: 'Hi Patrick, invoice INV-011 for €85,000 was flagged as unmatched. Could you provide a reference PO number or supporting documentation?',
        timestamp: '2025-01-04 14:20',
        isInternal: true,
      },
      {
        id: 'm7',
        sender: 'Patrick Sullivan (Accenture)',
        senderInitials: 'PS',
        content: 'Hi Michael, apologies for the confusion. This was for ad-hoc advisory work approved verbally. I will send the email approval chain and work order for your records.',
        timestamp: '2025-01-06 09:45',
        isInternal: false,
      },
    ],
  },
  {
    id: 'thread-4',
    supplierName: 'SAP SE',
    subject: 'License Renewal Pricing',
    lastMessage: 'We can offer a 5% discount for a 3-year commitment.',
    lastTimestamp: '2025-01-05 16:20',
    unread: true,
    relatedTo: 'REQ-2024-0003',
    messages: [
      {
        id: 'm8',
        sender: 'James Chen',
        senderInitials: 'JC',
        content: 'Hi Thomas, we are planning the SAP license renewal for 2025. Could you share updated pricing for our current tier?',
        timestamp: '2025-01-03 10:00',
        isInternal: true,
      },
      {
        id: 'm9',
        sender: 'Thomas Weber (SAP SE)',
        senderInitials: 'TW',
        content: 'Hi James, thanks for reaching out. I have attached the updated pricing schedule. We can offer a 5% discount for a 3-year commitment. Happy to discuss further.',
        timestamp: '2025-01-05 16:20',
        isInternal: false,
      },
    ],
  },
  {
    id: 'thread-5',
    supplierName: 'Deloitte',
    subject: 'TPRA Questionnaire Submission',
    lastMessage: 'Questionnaire submitted. Please review at your convenience.',
    lastTimestamp: '2025-01-04 12:00',
    unread: false,
    messages: [
      {
        id: 'm10',
        sender: 'Anna Kowalski',
        senderInitials: 'AK',
        content: 'Hi Sarah, as part of the annual TPRA refresh, we require Deloitte to complete the updated risk questionnaire. The deadline is January 31.',
        timestamp: '2025-01-02 09:00',
        isInternal: true,
      },
      {
        id: 'm11',
        sender: 'Sarah Collins (Deloitte)',
        senderInitials: 'SC',
        content: 'Hi Anna, questionnaire submitted. Please review at your convenience. Let us know if you need any additional documentation.',
        timestamp: '2025-01-04 12:00',
        isInternal: false,
      },
    ],
  },
  {
    id: 'thread-6',
    supplierName: 'Capgemini',
    subject: 'Onboarding Status Update',
    lastMessage: 'Bank verification is pending. We have submitted the DUNS details.',
    lastTimestamp: '2025-01-03 15:30',
    unread: false,
    messages: [
      {
        id: 'm12',
        sender: 'Michael Torres',
        senderInitials: 'MT',
        content: 'Hi Capgemini team, your onboarding is at Step 3 (Bank Verification). Could you confirm the DUNS number and submit bank details?',
        timestamp: '2025-01-02 11:00',
        isInternal: true,
      },
      {
        id: 'm13',
        sender: 'Marie Dupont (Capgemini)',
        senderInitials: 'MD',
        content: 'Hi Michael, bank verification is pending. We have submitted the DUNS details. The bank confirmation letter should arrive within 3 business days.',
        timestamp: '2025-01-03 15:30',
        isInternal: false,
      },
    ],
  },
];

export function SupplierMessagesPage() {
  const [selectedThread, setSelectedThread] = useState<string>(threads[0].id);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [localThreads, setLocalThreads] = useState(threads);

  const activeThread = localThreads.find((t) => t.id === selectedThread);

  const filteredThreads = searchQuery
    ? localThreads.filter(
        (t) =>
          t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.supplierName.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : localThreads;

  const unreadCount = localThreads.filter((t) => t.unread).length;

  const handleSend = () => {
    if (!messageInput.trim() || !activeThread) return;
    const newMessage: Message = {
      id: `m-${Date.now()}`,
      sender: 'James Chen',
      senderInitials: 'JC',
      content: messageInput,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      isInternal: true,
    };
    setLocalThreads((prev) =>
      prev.map((t) =>
        t.id === activeThread.id
          ? {
              ...t,
              messages: [...t.messages, newMessage],
              lastMessage: messageInput,
              lastTimestamp: newMessage.timestamp,
            }
          : t,
      ),
    );
    setMessageInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Messages"
        subtitle={`${unreadCount} unread conversation${unreadCount !== 1 ? 's' : ''}`}
        actions={
          <Button size="sm">
            <Plus className="size-4 mr-1" />
            New Message
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3" style={{ height: 'calc(100vh - 220px)' }}>
        {/* Thread list */}
        <div className="flex flex-col gap-2 lg:col-span-1 min-h-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {filteredThreads.map((thread) => (
              <Card
                key={thread.id}
                className={cn(
                  'cursor-pointer py-3 transition-colors',
                  selectedThread === thread.id
                    ? 'border-blue-300 bg-blue-50/50'
                    : 'hover:bg-gray-50',
                )}
                onClick={() => {
                  setSelectedThread(thread.id);
                  setLocalThreads((prev) =>
                    prev.map((t) =>
                      t.id === thread.id ? { ...t, unread: false } : t,
                    ),
                  );
                }}
              >
                <CardContent className="py-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="text-xs font-medium text-blue-600 truncate">
                          {thread.supplierName}
                        </span>
                        {thread.relatedTo && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {thread.relatedTo}
                          </Badge>
                        )}
                      </div>
                      <p
                        className={cn(
                          'mt-1 text-sm truncate',
                          thread.unread
                            ? 'font-semibold text-gray-900'
                            : 'font-medium text-gray-700',
                        )}
                      >
                        {thread.subject}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground truncate">
                        {thread.lastMessage}
                      </p>
                    </div>
                    {thread.unread && (
                      <span className="mt-1 size-2 shrink-0 rounded-full bg-blue-500" />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {thread.lastTimestamp}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Message view */}
        <Card className="py-0 lg:col-span-2 flex flex-col min-h-0">
          {activeThread ? (
            <>
              {/* Thread header */}
              <div className="shrink-0 border-b px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">
                      {activeThread.subject}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      with {activeThread.supplierName}
                      {activeThread.relatedTo && (
                        <span className="ml-2 text-blue-600">
                          #{activeThread.relatedTo}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {activeThread.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex gap-3',
                      msg.isInternal ? '' : 'flex-row-reverse',
                    )}
                  >
                    <div
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white',
                        msg.isInternal ? 'bg-[#1B2A4A]' : 'bg-amber-500',
                      )}
                    >
                      {msg.senderInitials}
                    </div>
                    <div
                      className={cn(
                        'max-w-[75%] rounded-lg p-3',
                        msg.isInternal ? 'bg-blue-50' : 'bg-gray-50',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-900">
                          {msg.sender}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {msg.timestamp}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-700">{msg.content}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply input */}
              <div className="shrink-0 border-t p-4">
                <div className="flex gap-2">
                  <Input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message ${activeThread.supplierName}...`}
                    className="h-9"
                  />
                  <Button size="sm" className="h-9" onClick={handleSend}>
                    <Send className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Select a conversation to view messages.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
