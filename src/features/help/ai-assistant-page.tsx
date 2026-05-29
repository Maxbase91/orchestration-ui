import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, User, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PageHeader } from '@/components/shared/page-header';
import { useAuthStore } from '@/stores/auth-store';
import { mockProvider } from '@/lib/assistant/mockProvider';
import type { AssistantTurn, ConfirmTurn } from '@/data/types';
import { TurnChatAnswer } from '@/features/ai-assistant/components/turn-chat-answer';
import { TurnDeepLink } from '@/features/ai-assistant/components/turn-deep-link';
import { TurnConfirm } from '@/features/ai-assistant/components/turn-confirm';
import { TurnSuggestionChips } from '@/features/ai-assistant/components/turn-suggestion-chips';

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  turns?: AssistantTurn[];
}

const WELCOME: ChatMsg = {
  id: 'welcome',
  role: 'assistant',
  content: '',
  timestamp: new Date().toISOString(),
  turns: [
    {
      type: 'chat-answer',
      content: `Hello! I'm your procurement assistant. I can help you with:
- Procurement policies, thresholds, and KOPs
- Status lookups for requests, suppliers, contracts, POs, and invoices
- Taking actions (delegate approvals, add watchers, escalate payments)
- Raising new procurement demands
- Connecting you with the right team when needed

What can I help you with today?`,
    },
    {
      type: 'suggestion-chips',
      chips: [
        { label: 'Consulting threshold', prompt: 'What is the consulting threshold policy?' },
        { label: 'Acme risk status', prompt: 'Show me Accenture risk status' },
        { label: 'Set my delegate', prompt: 'Set my approval delegate' },
        { label: 'Compare bids', prompt: 'I want to compare bids for a sourcing event' },
      ],
    },
  ],
};

const quickActions = [
  'What is the consulting threshold?',
  'Show me Accenture risk status',
  'I want to buy something',
  'Compare bids',
  'Contract renewals',
  'Spend analytics',
];

export function AIAssistantPage() {
  const navigate = useNavigate();
  const { currentRole, currentUser } = useAuthStore();
  const [messages, setMessages] = useState<ChatMsg[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-slot="scroll-area-viewport"]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    const userMsg: ChatMsg = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      history.push({ role: 'user', content: trimmed });

      const turns = await mockProvider.respond(history, {
        role: currentRole,
        currentUser: { id: currentUser.id, name: currentUser.name },
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-ai`,
          role: 'assistant',
          content: '',
          timestamp: new Date().toISOString(),
          turns,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

  async function handleConfirmAction(turn: ConfirmTurn) {
    setIsTyping(true);
    try {
      const resultTurns = await mockProvider.executeAction(turn, {
        role: currentRole,
        currentUser: { id: currentUser.id, name: currentUser.name },
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-result`,
          role: 'assistant',
          content: '',
          timestamp: new Date().toISOString(),
          turns: resultTurns,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

  function handleCancelConfirm() {
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}-cancel`,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        turns: [{ type: 'chat-answer', content: 'No problem — action cancelled.' }],
      },
    ]);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  }

  function renderTurns(turns: AssistantTurn[], msgId: string) {
    return (
      <div className="space-y-2">
        {turns.map((turn, i) => {
          switch (turn.type) {
            case 'chat-answer':
              return <TurnChatAnswer key={`${msgId}-${i}`} turn={turn} />;
            case 'deep-link':
              return (
                <TurnDeepLink
                  key={`${msgId}-${i}`}
                  turn={turn}
                  onNavigate={(path) => navigate(path)}
                />
              );
            case 'confirm':
              return (
                <TurnConfirm
                  key={`${msgId}-${i}`}
                  turn={turn}
                  onConfirm={handleConfirmAction}
                  onCancel={handleCancelConfirm}
                  disabled={isTyping}
                />
              );
            case 'suggestion-chips':
              return (
                <TurnSuggestionChips
                  key={`${msgId}-${i}`}
                  turn={turn}
                  onChipClick={handleSend}
                />
              );
            default:
              return null;
          }
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      <PageHeader
        title="AI Assistant"
        subtitle="Ask questions about procurement, requests, suppliers, and more"
      />

      <ScrollArea className="mt-4 flex-1 rounded-lg border" ref={scrollRef}>
        <div className="space-y-4 p-6">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
              >
                <div
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full',
                    isUser ? 'bg-gray-800' : 'bg-amber-100'
                  )}
                >
                  {isUser ? (
                    <User className="size-4 text-white" />
                  ) : (
                    <Sparkles className="size-4 text-amber-600" />
                  )}
                </div>
                <div className="max-w-[75%] space-y-2">
                  {isUser ? (
                    <div className="rounded-lg bg-gray-800 px-4 py-3 text-sm text-white">
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ) : msg.turns && msg.turns.length > 0 ? (
                    renderTurns(msg.turns, msg.id)
                  ) : (
                    <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-gray-900">
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  )}
                  <p
                    className={cn(
                      'text-[10px] text-muted-foreground',
                      isUser ? 'text-right' : 'text-left'
                    )}
                  >
                    {format(parseISO(msg.timestamp), 'HH:mm')}
                  </p>
                </div>
              </div>
            );
          })}
          {isTyping && (
            <div className="flex gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <Sparkles className="size-4 text-amber-600" />
              </div>
              <div className="rounded-lg bg-blue-50 px-4 py-3">
                <div className="flex gap-1">
                  <span className="size-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
                  <span className="size-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
                  <span className="size-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {quickActions.map((text) => (
            <button
              key={text}
              className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              onClick={() => handleSend(text)}
            >
              {text}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
            placeholder="Ask me anything about procurement..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isTyping}
          />
          <Button
            className="h-10 w-10 shrink-0 p-0"
            onClick={() => handleSend(input)}
            disabled={isTyping || !input.trim()}
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
