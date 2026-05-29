import { useRef, useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isToday, isYesterday, isThisWeek, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PageHeader } from '@/components/shared/page-header';
import { useAuthStore } from '@/stores/auth-store';
import { useConversationStore, type Conversation } from '@/stores/conversation-store';
import { useAssistant } from '@/lib/assistant/useAssistant';
import type { ChatMessageData } from '@/data/types';
import { MessagePane } from '@/features/ai-assistant/components/message-pane';

const WELCOME: ChatMessageData = {
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
        { label: 'Accenture risk status', prompt: 'Show me Accenture risk status' },
        { label: 'Set my delegate', prompt: 'Set my approval delegate' },
        { label: 'Compare bids', prompt: 'I want to compare bids for a sourcing event' },
      ],
    },
  ],
};

// ─── Date grouping ─────────────────────────────────────────────────────────────

type DateGroup = 'Today' | 'Yesterday' | 'This week' | 'Older';

function getDateGroup(updatedAt: string): DateGroup {
  const date = parseISO(updatedAt);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isThisWeek(date)) return 'This week';
  return 'Older';
}

function groupConversations(convs: Conversation[]): Array<{ group: DateGroup; items: Conversation[] }> {
  const order: DateGroup[] = ['Today', 'Yesterday', 'This week', 'Older'];
  const map = new Map<DateGroup, Conversation[]>();

  for (const c of convs) {
    const g = getDateGroup(c.updatedAt);
    const existing = map.get(g) ?? [];
    map.set(g, [...existing, c]);
  }

  return order.filter((g) => map.has(g)).map((g) => ({ group: g, items: map.get(g)! }));
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  const grouped = groupConversations(conversations);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col border-r bg-gray-50/50">
      <div className="p-3">
        <button
          onClick={onNew}
          className="flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
        >
          <Plus className="size-4 shrink-0" />
          New chat
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-2 pb-4">
          {grouped.map(({ group, items }) => (
            <div key={group} className="mb-3">
              <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {group}
              </p>
              {items.map((c) => (
                <button
                  key={c.id}
                  className={cn(
                    'group relative flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                    c.id === activeId
                      ? 'bg-amber-50 text-amber-900 font-medium'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )}
                  onClick={() => onSelect(c.id)}
                  onMouseEnter={() => setHoveredId(c.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <span className="flex-1 truncate pr-6">{c.title}</span>
                  {hoveredId === c.id && (
                    <span
                      className="absolute right-1.5 flex size-5 shrink-0 items-center justify-center rounded text-gray-400 hover:text-red-500"
                      onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                    >
                      <Trash2 className="size-3" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}

          {conversations.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-gray-400">No conversations yet</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AIAssistantPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const {
    conversations,
    activeConversationId,
    loadConversations,
    createConversation,
    setActive,
    deleteConversation,
  } = useConversationStore();

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  const { messages, isTyping, handleSend, handleConfirmAction, handleCancelConfirm } =
    useAssistant(activeConversationId);

  const displayMessages = messages.length === 0 ? [WELCOME] : messages;

  // Bootstrap conversations on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    void (async () => {
      await loadConversations(currentUser.id);
      const { conversations: loaded } = useConversationStore.getState();
      if (loaded.length === 0) {
        await createConversation(currentUser.id);
      }
    })();
  }, [currentUser.id, loadConversations, createConversation]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-slot="scroll-area-viewport"]');
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    }
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  async function submitSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;
    setInput('');
    await handleSend(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submitSend(input);
    }
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 10rem)' }}>
      <PageHeader
        title="AI Assistant"
        subtitle="Ask questions about procurement, requests, suppliers, and more"
      />

      <div className="mt-4 flex flex-1 min-h-0 rounded-lg border overflow-hidden">
        {/* Sidebar */}
        <div className="w-[220px] shrink-0">
          <ConversationSidebar
            conversations={conversations}
            activeId={activeConversationId}
            onSelect={setActive}
            onNew={() => void createConversation(currentUser.id)}
            onDelete={(id) => void deleteConversation(id)}
          />
        </div>

        {/* Main chat area */}
        <div className="flex flex-1 flex-col min-w-0">
          <ScrollArea className="flex-1" ref={scrollRef}>
            <div className="space-y-4 p-6">
              <MessagePane
                messages={displayMessages}
                isTyping={isTyping}
                onSuggestionClick={(text) => void submitSend(text)}
                onLinkClick={(path) => navigate(path)}
                onConfirmAction={handleConfirmAction}
                onCancelConfirm={handleCancelConfirm}
              />
            </div>
          </ScrollArea>

          <div className="border-t p-3">
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
                placeholder="Ask me anything about procurement…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isTyping}
              />
              <Button
                className="h-10 w-10 shrink-0 p-0"
                onClick={() => void submitSend(input)}
                disabled={isTyping || !input.trim()}
              >
                <Sparkles className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
