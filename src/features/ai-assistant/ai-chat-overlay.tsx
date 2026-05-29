import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuthStore } from '@/stores/auth-store';
import { mockProvider } from '@/lib/assistant/mockProvider';
import type { ConfirmTurn } from '@/data/types';
import { ChatMessage, type ChatMessageData } from './components/chat-message';
import { ChatInput } from './components/chat-input';

const WELCOME_MESSAGE: ChatMessageData = {
  id: 'welcome',
  role: 'assistant',
  content: '',
  timestamp: new Date().toISOString(),
  turns: [
    {
      type: 'chat-answer',
      content: 'Hi! I can help you with procurement policies, request status, supplier risk, actions, and raising new demands.',
    },
    {
      type: 'suggestion-chips',
      chips: [
        { label: 'Check a policy', prompt: 'What is the consulting threshold?' },
        { label: 'Find a supplier', prompt: 'Show me Accenture risk status' },
        { label: 'Raise a demand', prompt: 'I want to buy something' },
        { label: 'Compare bids', prompt: 'I want to compare bids' },
      ],
    },
  ],
};

export function openAIChat() {
  window.dispatchEvent(new CustomEvent('open-ai-chat'));
}

export function AIChatOverlay() {
  const navigate = useNavigate();
  const { currentRole, currentUser } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageData[]>([WELCOME_MESSAGE]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-ai-chat', handler);
    return () => window.removeEventListener('open-ai-chat', handler);
  }, []);

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

    const userMessage: ChatMessageData = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      history.push({ role: 'user', content: trimmed });

      const turns = await mockProvider.respond(history, {
        role: currentRole,
        currentUser: { id: currentUser.id, name: currentUser.name },
      });

      const assistantMessage: ChatMessageData = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        turns,
      };
      setMessages((prev) => [...prev, assistantMessage]);
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
      const resultMessage: ChatMessageData = {
        id: `msg-${Date.now()}-result`,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        turns: resultTurns,
      };
      setMessages((prev) => [...prev, resultMessage]);
    } finally {
      setIsTyping(false);
    }
  }

  function handleCancelConfirm() {
    const cancelMessage: ChatMessageData = {
      id: `msg-${Date.now()}-cancel`,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      turns: [{ type: 'chat-answer', content: 'No problem — action cancelled. Let me know if you need anything else.' }],
    };
    setMessages((prev) => [...prev, cancelMessage]);
  }

  function handleLinkClick(path: string) {
    setOpen(false);
    navigate(path);
  }

  return (
    <>
      {!open && (
        <Button
          className="fixed bottom-6 right-6 z-50 size-14 rounded-full bg-amber-500 p-0 shadow-lg hover:bg-amber-600"
          onClick={() => setOpen(true)}
        >
          <Sparkles className="size-6 text-white" />
        </Button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-[360px] flex-col gap-0 p-0 sm:max-w-[360px]">
          <SheetHeader className="border-b px-4 py-2.5">
            <SheetTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="size-4 text-amber-500" />
              Procurement Assistant
            </SheetTitle>
            <SheetDescription className="sr-only">
              Ask questions about procurement
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 overflow-hidden" ref={scrollRef}>
            <div className="space-y-4 p-4">
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  onSuggestionClick={handleSend}
                  onLinkClick={handleLinkClick}
                  onConfirmAction={handleConfirmAction}
                  onCancelConfirm={handleCancelConfirm}
                  isProcessing={isTyping}
                />
              ))}
              {isTyping && (
                <div className="flex gap-2">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-100">
                    <Sparkles className="size-3 text-amber-600" />
                  </div>
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <div className="flex gap-1">
                      <span className="size-1.5 animate-bounce rounded-full bg-gray-300" style={{ animationDelay: '0ms' }} />
                      <span className="size-1.5 animate-bounce rounded-full bg-gray-300" style={{ animationDelay: '150ms' }} />
                      <span className="size-1.5 animate-bounce rounded-full bg-gray-300" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="border-t p-2.5">
            <ChatInput onSend={handleSend} disabled={isTyping} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
