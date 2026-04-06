import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, User, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PageHeader } from '@/components/shared/page-header';
import { getAIResponse } from '@/lib/mock-ai';

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestions?: string[];
}

const WELCOME: ChatMsg = {
  id: 'welcome',
  role: 'assistant',
  content: `Hello! I'm your procurement assistant. I can help you with:
- Finding requests and their status
- Understanding procurement policies
- Navigating the platform
- Answering questions about suppliers and contracts

What can I help you with?`,
  timestamp: new Date().toISOString(),
  suggestions: [
    'Where is my request?',
    'How do I buy software?',
    'Show pending approvals',
    'Check supplier risk',
  ],
};

const FALLBACK =
  "I'm not sure I understand that question. Could you try rephrasing? I can help with request status, procurement policies, supplier information, spend analytics, and approval workflows.";

const quickActions = [
  'Where is my request?',
  'How do I buy software?',
  'Show pending approvals',
  'Check supplier risk',
  'Contract renewals',
  'Spend analytics',
];

export function AIAssistantPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector(
        '[data-slot="scroll-area-viewport"]'
      );
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: ChatMsg = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const result = getAIResponse(trimmed, 'chat');
      const assistantMsg: ChatMsg = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: result?.response ?? FALLBACK,
        timestamp: new Date().toISOString(),
        suggestions: result?.suggestions,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsTyping(false);
    }, 800);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      <PageHeader
        title="AI Assistant"
        subtitle="Ask questions about procurement, requests, suppliers, and more"
      />

      {/* Messages area */}
      <ScrollArea className="mt-4 flex-1 rounded-lg border" ref={scrollRef}>
        <div className="space-y-4 p-6">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={cn(
                  'flex gap-3',
                  isUser ? 'flex-row-reverse' : 'flex-row'
                )}
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
                  <div
                    className={cn(
                      'rounded-lg px-4 py-3 text-sm',
                      isUser
                        ? 'bg-gray-800 text-white'
                        : 'bg-blue-50 text-gray-900'
                    )}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {msg.suggestions.map((s) => (
                        <button
                          key={s}
                          className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-100"
                          onClick={() => handleSend(s)}
                        >
                          {s}
                        </button>
                      ))}
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
                  <span
                    className="size-1.5 animate-bounce rounded-full bg-gray-400"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="size-1.5 animate-bounce rounded-full bg-gray-400"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="size-1.5 animate-bounce rounded-full bg-gray-400"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input area */}
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
