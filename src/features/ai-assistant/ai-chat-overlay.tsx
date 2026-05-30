import { useRef, useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Plus, ChevronDown, Trash2, X } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuthStore } from '@/stores/auth-store';
import { useConversationStore } from '@/stores/conversation-store';
import { useAssistant } from '@/lib/assistant/useAssistant';
import type { ChatMessageData } from '@/data/types';
import { MessagePane } from './components/message-pane';
import { ChatInput } from './components/chat-input';

const WELCOME_MESSAGE: ChatMessageData = {
  id: 'welcome',
  role: 'assistant',
  content: '',
  timestamp: new Date().toISOString(),
  turns: [
    {
      type: 'chat-answer',
      content: 'Hi! Ask me about procurement policies, look up a request, supplier or contract, raise a new demand, or take an action.',
    },
  ],
};

export function openAIChat() {
  window.dispatchEvent(new CustomEvent('open-ai-chat'));
}

export function openAIChatWithPrompt(prompt: string) {
  window.dispatchEvent(new CustomEvent('open-ai-chat-with-prompt', { detail: prompt }));
}

function ConversationDropdown({
  activeTitle,
  conversations,
  onSelect,
  onDelete,
}: {
  activeTitle: string;
  conversations: Array<{ id: string; title: string }>;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex min-w-0 flex-1 items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-medium text-gray-800 hover:bg-gray-100 transition-colors">
          <span className="truncate max-w-[160px]">{activeTitle}</span>
          <ChevronDown className="size-3.5 shrink-0 text-gray-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {conversations.map((c, idx) => (
          <div key={c.id}>
            {idx > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              className="flex items-center justify-between gap-2 pr-1"
              onSelect={() => onSelect(c.id)}
            >
              <span className="truncate text-xs">{c.title}</span>
              <button
                className="shrink-0 rounded p-0.5 text-gray-400 hover:text-red-500"
                onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
              >
                <Trash2 className="size-3" />
              </button>
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AIChatOverlay() {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const {
    conversations,
    activeConversationId,
    isLoading,
    loadConversations,
    createConversation,
    setActive,
    deleteConversation,
  } = useConversationStore();

  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, isTyping, handleSend, handleConfirmAction, handleCancelConfirm } =
    useAssistant(activeConversationId);

  const displayMessages = messages.length === 0 ? [WELCOME_MESSAGE] : messages;

  // Every time the overlay opens: load conversations for the dropdown but always
  // start as a fresh chat (activeConversationId = null). The first message will
  // auto-create a new conversation via useAssistant.handleSend.
  useEffect(() => {
    if (!open) return;
    void (async () => {
      await loadConversations(currentUser.id);
      useConversationStore.setState({ activeConversationId: null });
    })();
  }, [open, currentUser.id, loadConversations]);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-ai-chat', handler);
    return () => window.removeEventListener('open-ai-chat', handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const prompt = (e as CustomEvent<string>).detail;
      setOpen(true);
      if (prompt) {
        setTimeout(() => void handleSend(prompt), 300);
      }
    };
    window.addEventListener('open-ai-chat-with-prompt', handler);
    return () => window.removeEventListener('open-ai-chat-with-prompt', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-slot="scroll-area-viewport"]');
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    }
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  async function handleNewConversation() {
    await createConversation(currentUser.id);
  }

  const activeConv = conversations.find((c) => c.id === activeConversationId);
  const activeTitle = activeConv?.title ?? 'New conversation';

  return (
    <>
      {/* Floating trigger button */}
      {!open && (
        <button
          className="fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full bg-[#1B2A4A] text-white shadow-lg shadow-gray-900/20 hover:bg-[#273957] hover:scale-105 transition-all duration-200"
          onClick={() => setOpen(true)}
          aria-label="Open AI assistant"
        >
          <Sparkles className="size-6" />
        </button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-[420px] flex-col gap-0 p-0 sm:max-w-[420px] bg-gray-50/50">
          {/* Header */}
          <div className="flex items-center gap-2 bg-white border-b border-gray-100 px-4 py-3">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1B2A4A] to-[#2D5F8A]">
              <Sparkles className="size-3.5 text-white" />
            </div>
            {isLoading ? (
              <span className="flex-1 text-sm text-gray-400">Loading…</span>
            ) : (
              <ConversationDropdown
                activeTitle={activeTitle}
                conversations={conversations}
                onSelect={setActive}
                onDelete={(id) => void deleteConversation(id)}
              />
            )}
            <div className="flex items-center gap-1 ml-auto shrink-0">
              <button
                className="flex size-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                title="New conversation"
                onClick={() => void handleNewConversation()}
              >
                <Plus className="size-4" />
              </button>
              <button
                className="flex size-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                title="Close"
                onClick={() => setOpen(false)}
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <SheetDescription className="sr-only">
            Ask questions about procurement
          </SheetDescription>

          <ScrollArea className="flex-1 overflow-hidden" ref={scrollRef}>
            <div className="space-y-4 p-4">
              <MessagePane
                messages={displayMessages}
                isTyping={isTyping}
                onSuggestionClick={handleSend}
                onLinkClick={(path) => { setOpen(false); navigate(path); }}
                onConfirmAction={handleConfirmAction}
                onCancelConfirm={handleCancelConfirm}
              />
            </div>
          </ScrollArea>

          {/* Input area */}
          <div className="bg-white border-t border-gray-100 px-3 py-3 shadow-[0_-1px_8px_rgba(0,0,0,0.04)]">
            <ChatInput onSend={(t) => void handleSend(t)} disabled={isTyping} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
