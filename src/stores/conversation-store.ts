// AI-assistant conversation history: per-user threads persisted to the database
// (assistant_conversations), with an in-memory list + active-thread pointer for
// the chat UI. Not persisted via zustand/persist — the source of truth is the
// table, reloaded per user via loadConversations.
import { create } from 'zustand';
import {
  createConversation as dbCreateConversation,
  deleteConversation as dbDeleteConversation,
  listConversations,
  renameConversation,
  saveConversationMessages,
} from '@/lib/db/assistant-conversations';
import type { ChatMessageData } from '@/data/types';
import { NEW_CONVERSATION_TITLE } from '@/lib/assistant/conversation-title';

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  messages: ChatMessageData[];
  createdAt: string;
  updatedAt: string;
}

interface ConversationStore {
  conversations: Conversation[];
  activeConversationId: string | null;
  isLoading: boolean;
  loadConversations: (userId: string) => Promise<void>;
  createConversation: (userId: string) => Promise<string>;
  setActive: (id: string) => void;
  addMessage: (conversationId: string, message: ChatMessageData, userId: string) => Promise<void>;
  setTitle: (conversationId: string, title: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  getActive: () => Conversation | null;
}

export const useConversationStore = create<ConversationStore>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  isLoading: false,

  loadConversations: async (userId: string) => {
    set({ isLoading: true });
    let conversations: Conversation[];
    try {
      conversations = await listConversations(userId);
    } catch (error) {
      console.error('Failed to load conversations:', error instanceof Error ? error.message : error);
      set({ isLoading: false });
      return;
    }
    // Keep whatever thread is already active (e.g. the one just created); only
    // default to the most recent thread on a fresh load.
    const activeConversationId =
      get().activeConversationId ?? conversations[0]?.id ?? null;

    set({ conversations, activeConversationId, isLoading: false });
  },

  createConversation: async (userId: string) => {
    let created: Awaited<ReturnType<typeof dbCreateConversation>>;
    try {
      created = await dbCreateConversation(userId);
    } catch (error) {
      console.error('Failed to create conversation:', error instanceof Error ? error.message : error);
      return '';
    }

    const newConv: Conversation = {
      id: created.id,
      userId,
      title: NEW_CONVERSATION_TITLE,
      messages: [],
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };

    set((state) => ({
      conversations: [newConv, ...state.conversations],
      activeConversationId: created.id,
    }));

    return created.id;
  },

  setActive: (id: string) => {
    set({ activeConversationId: id });
  },

  addMessage: async (conversationId: string, message: ChatMessageData, userId: string) => {
    const now = new Date().toISOString();

    // Update local state first so the message renders immediately, then
    // persist; the list re-sorts so the most-recently-active thread stays on top.
    set((state) => {
      const conversations = state.conversations
        .map((c) => {
          if (c.id !== conversationId) return c;
          return { ...c, messages: [...c.messages, message], updatedAt: now };
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return { conversations };
    });

    const conv = get().conversations.find((c) => c.id === conversationId);
    if (!conv) return;

    await saveConversationMessages(conversationId, userId, conv.messages, now);
  },

  setTitle: async (conversationId: string, title: string) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, title } : c
      ),
    }));

    // Scope the write to the thread's owner. The store already knows it, and
    // the title update was the one conversation write that filtered on id
    // alone.
    const owner = get().conversations.find((c) => c.id === conversationId)?.userId;
    if (owner) await renameConversation(conversationId, owner, title);
  },

  deleteConversation: async (id: string) => {
    const owner = get().conversations.find((c) => c.id === id)?.userId;
    set((state) => {
      const conversations = state.conversations.filter((c) => c.id !== id);
      const activeConversationId =
        state.activeConversationId === id
          ? (conversations[0]?.id ?? null)
          : state.activeConversationId;
      return { conversations, activeConversationId };
    });

    if (owner) await dbDeleteConversation(id, owner);
  },

  getActive: () => {
    const { conversations, activeConversationId } = get();
    return conversations.find((c) => c.id === activeConversationId) ?? null;
  },
}));
