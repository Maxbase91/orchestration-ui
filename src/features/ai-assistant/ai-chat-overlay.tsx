import { useState, useRef, useEffect, useCallback } from 'react';
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
import { getAIResponse } from '@/lib/mock-ai';
import { ChatMessage, type ChatMessageData } from './components/chat-message';
import { ChatInput } from './components/chat-input';

const WELCOME_MESSAGE: ChatMessageData = {
  id: 'welcome',
  role: 'assistant',
  content: `Hello! I'm your procurement assistant. I can help you with:
- Finding requests and their status
- Understanding procurement policies
- Navigating the platform
- Answering questions about suppliers and contracts

What can I help you with?`,
  timestamp: new Date().toISOString(),
};

const FALLBACK_RESPONSE =
  "I'm not sure I understand that question. Could you try rephrasing? I can help with request status, procurement policies, supplier information, spend analytics, and approval workflows.";

export function AIChatOverlay() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageData[]>([WELCOME_MESSAGE]);
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

  function handleSend(text: string) {
    const userMessage: ChatMessageData = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    // Simulate AI response delay
    setTimeout(() => {
      const aiResult = getAIResponse(text, 'chat');

      const assistantMessage: ChatMessageData = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: aiResult?.response ?? FALLBACK_RESPONSE,
        timestamp: new Date().toISOString(),
        suggestions: aiResult?.suggestions,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 800);
  }

  function handleSuggestionClick(text: string) {
    handleSend(text);
  }

  return (
    <>
      {/* Floating action button */}
      {!open && (
        <Button
          className="fixed bottom-6 right-6 z-50 size-14 rounded-full bg-amber-500 p-0 shadow-lg hover:bg-amber-600"
          onClick={() => setOpen(true)}
        >
          <Sparkles className="size-6 text-white" />
        </Button>
      )}

      {/* Chat panel */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-[400px] flex-col gap-0 p-0 sm:max-w-[400px]">
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="flex items-center gap-2 text-base">
              <div className="flex size-7 items-center justify-center rounded-full bg-amber-100">
                <Sparkles className="size-4 text-amber-600" />
              </div>
              AI Assistant
            </SheetTitle>
            <SheetDescription className="sr-only">
              Ask questions about procurement
            </SheetDescription>
          </SheetHeader>

          {/* Messages */}
          <ScrollArea className="flex-1 overflow-hidden" ref={scrollRef}>
            <div className="space-y-4 p-4">
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  onSuggestionClick={handleSuggestionClick}
                />
              ))}
              {isTyping && (
                <div className="flex gap-2">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-100">
                    <Sparkles className="size-3.5 text-amber-600" />
                  </div>
                  <div className="rounded-lg bg-blue-50 px-3 py-2">
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

          {/* Input */}
          <div className="border-t p-3">
            <ChatInput onSend={handleSend} disabled={isTyping} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
