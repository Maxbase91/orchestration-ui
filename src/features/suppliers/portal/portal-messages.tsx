import { useState } from 'react';
import { Send } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  sender: string;
  senderInitials: string;
  content: string;
  timestamp: string;
  isSupplier: boolean;
}

interface Thread {
  id: string;
  subject: string;
  lastMessage: string;
  lastTimestamp: string;
  unread: boolean;
  messages: Message[];
}

const threads: Thread[] = [
  {
    id: 'thread-1',
    subject: 'Contract Renewal Discussion',
    lastMessage: 'We would like to discuss the renewal terms for CON-001.',
    lastTimestamp: '2025-01-10 14:30',
    unread: true,
    messages: [
      {
        id: 'm1',
        sender: 'Marcus Johnson',
        senderInitials: 'MJ',
        content: 'Hi Patrick, the IT Strategy Advisory contract (CON-001) is up for renewal later this year. Can we schedule a call to discuss terms?',
        timestamp: '2025-01-08 10:15',
        isSupplier: false,
      },
      {
        id: 'm2',
        sender: 'Patrick Sullivan',
        senderInitials: 'PS',
        content: 'Hi Marcus, absolutely. We have been preparing an updated proposal with some enhanced scope items. Would next Tuesday work?',
        timestamp: '2025-01-09 09:30',
        isSupplier: true,
      },
      {
        id: 'm3',
        sender: 'Marcus Johnson',
        senderInitials: 'MJ',
        content: 'Tuesday works. Let us set up a 1-hour slot at 2pm CET. I will send a calendar invite.',
        timestamp: '2025-01-10 14:30',
        isSupplier: false,
      },
    ],
  },
  {
    id: 'thread-2',
    subject: 'Compliance Documentation Update',
    lastMessage: 'Please upload the updated ISO 27001 certificate.',
    lastTimestamp: '2025-01-07 11:00',
    unread: false,
    messages: [
      {
        id: 'm4',
        sender: 'Lisa Nakamura',
        senderInitials: 'LN',
        content: 'Hi, we noticed your ISO 27001 certificate is approaching renewal. Could you please upload the renewed version once available?',
        timestamp: '2025-01-05 16:00',
        isSupplier: false,
      },
      {
        id: 'm5',
        sender: 'Patrick Sullivan',
        senderInitials: 'PS',
        content: 'Thanks for the reminder, Lisa. The audit was completed last week and we expect the updated certificate within 10 business days. I will upload it as soon as we receive it.',
        timestamp: '2025-01-07 11:00',
        isSupplier: true,
      },
    ],
  },
  {
    id: 'thread-3',
    subject: 'Invoice INV-011 Query',
    lastMessage: 'We are looking into the disputed invoice.',
    lastTimestamp: '2025-01-06 09:45',
    unread: false,
    messages: [
      {
        id: 'm6',
        sender: 'Anna Muller',
        senderInitials: 'AM',
        content: 'Hi Patrick, invoice INV-011 for EUR 85,000 was flagged as unmatched. Could you provide a reference PO number or supporting documentation?',
        timestamp: '2025-01-04 14:20',
        isSupplier: false,
      },
      {
        id: 'm7',
        sender: 'Patrick Sullivan',
        senderInitials: 'PS',
        content: 'Hi Anna, apologies for the confusion. This was for ad-hoc advisory work approved verbally. I will send the email approval chain and work order for your records.',
        timestamp: '2025-01-06 09:45',
        isSupplier: true,
      },
    ],
  },
  {
    id: 'thread-4',
    subject: 'New Sourcing Event - IT Strategy 2025',
    lastMessage: 'Invitation to participate in the upcoming RFP.',
    lastTimestamp: '2025-01-03 08:00',
    unread: false,
    messages: [
      {
        id: 'm8',
        sender: 'Marcus Johnson',
        senderInitials: 'MJ',
        content: 'Dear Accenture team, you are invited to participate in our IT Strategy Advisory Services 2025 sourcing event. Please review the requirements in the Sourcing tab and submit your response by March 15.',
        timestamp: '2025-01-03 08:00',
        isSupplier: false,
      },
    ],
  },
];

export function PortalMessages() {
  const [selectedThread, setSelectedThread] = useState<string>(threads[0].id);
  const [messageInput, setMessageInput] = useState('');

  const activeThread = threads.find((t) => t.id === selectedThread);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Messages</h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Thread List */}
        <div className="space-y-2 lg:col-span-1">
          {threads.map((thread) => (
            <Card
              key={thread.id}
              className={cn(
                'cursor-pointer py-3 transition-colors',
                selectedThread === thread.id
                  ? 'border-blue-300 bg-blue-50/50'
                  : 'hover:bg-gray-50',
              )}
              onClick={() => setSelectedThread(thread.id)}
            >
              <CardContent className="py-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={cn(
                      'text-sm truncate',
                      thread.unread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700',
                    )}>
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
                <p className="mt-1 text-xs text-muted-foreground">{thread.lastTimestamp}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Message View */}
        <Card className="py-4 lg:col-span-2">
          <CardContent>
            {activeThread ? (
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-gray-900 border-b pb-3">
                  {activeThread.subject}
                </h2>

                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                  {activeThread.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        'flex gap-3',
                        msg.isSupplier ? 'flex-row-reverse' : '',
                      )}
                    >
                      <div className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white',
                        msg.isSupplier ? 'bg-amber-500' : 'bg-[#1B2A4A]',
                      )}>
                        {msg.senderInitials}
                      </div>
                      <div className={cn(
                        'max-w-[75%] rounded-lg p-3',
                        msg.isSupplier ? 'bg-amber-50' : 'bg-gray-50',
                      )}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-900">{msg.sender}</span>
                          <span className="text-xs text-muted-foreground">{msg.timestamp}</span>
                        </div>
                        <p className="mt-1 text-sm text-gray-700">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Reply input */}
                <div className="flex gap-2 border-t pt-3">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Type a message..."
                    className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  />
                  <Button size="sm" className="h-9">
                    <Send className="size-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Select a conversation to view messages.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
