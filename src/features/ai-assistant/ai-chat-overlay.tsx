import { useRef, useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Plus, ChevronDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
        <button className="flex min-w-0 flex-1 items-center gap-1 rounded px-1.5 py-0.5 text-sm font-medium hover:bg-gray-100">
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
  const initialized = useRef(false);

  const { messages, isTyping, handleSend, handleConfirmAction, handleCancelConfirm } =
    useAssistant(activeConversationId);

  const displayMessages = messages.length === 0 ? [WELCOME_MESSAGE] : messages;

  // Load or create a conversation when the overlay opens for the first time.
  useEffect(() => {
    if (!open || initialized.current) return;
    initialized.current = true;

    void (async () => {
      await loadConversations(currentUser.id);
      const { conversations: loaded } = useConversationStore.getState();
      if (loaded.length === 0) {
        await createConversation(currentUser.id);
      }
    })();
  }, [open, currentUser.id, loadConversations, createConversation]);

  // Open via global event (e.g., from top-nav button)
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-ai-chat', handler);
    return () => window.removeEventListener('open-ai-chat', handler);
  }, []);

  // Open with a pre-filled prompt (from the support page AI banner)
  useEffect(() => {
    const handler = (e: Event) => {
      const prompt = (e as CustomEvent<string>).detail;
      setOpen(true);
      if (prompt) {
        // Slight delay so the overlay finishes mounting before sending
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
      {!open && (
        <Button
          className="fixed bottom-6 right-6 z-50 size-14 rounded-full bg-amber-500 p-0 shadow-lg hover:bg-amber-600"
          onClick={() => setOpen(true)}
        >
          <Sparkles className="size-6 text-white" />
        </Button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-[400px] flex-col gap-0 p-0 sm:max-w-[400px]">
          {/* Header */}
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Sparkles className="size-4 shrink-0 text-amber-500" />
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
            <button
              className="flex size-6 shrink-0 items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-100"
              title="New conversation"
              onClick={() => void handleNewConversation()}
            >
              <Plus className="size-3.5" />
            </button>
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

          <div className="border-t p-2.5">
            <ChatInput onSend={(t) => void handleSend(t)} disabled={isTyping} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
