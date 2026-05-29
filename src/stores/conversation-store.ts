import { create } from 'zustand';
import { supabase } from '@/lib/supabase-client';
import type { ChatMessageData } from '@/data/types';

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

function rowToConversation(row: Record<string, unknown>): Conversation {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    title: row.title as string,
    messages: (row.messages as ChatMessageData[]) ?? [],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export const useConversationStore = create<ConversationStore>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  isLoading: false,

  loadConversations: async (userId: string) => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('assistant_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Failed to load conversations:', error.message);
      set({ isLoading: false });
      return;
    }

    const conversations = (data ?? []).map(rowToConversation);
    const activeConversationId =
      get().activeConversationId ?? conversations[0]?.id ?? null;

    set({ conversations, activeConversationId, isLoading: false });
  },

  createConversation: async (userId: string) => {
    const { data, error } = await supabase
      .from('assistant_conversations')
      .insert({ user_id: userId, title: 'New conversation', messages: [] })
      .select('id, created_at, updated_at')
      .single();

    if (error || !data) {
      console.error('Failed to create conversation:', error?.message);
      return '';
    }

    const id = data.id as string;
    const newConv: Conversation = {
      id,
      userId,
      title: 'New conversation',
      messages: [],
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };

    set((state) => ({
      conversations: [newConv, ...state.conversations],
      activeConversationId: id,
    }));

    return id;
  },

  setActive: (id: string) => {
    set({ activeConversationId: id });
  },

  addMessage: async (conversationId: string, message: ChatMessageData, userId: string) => {
    const now = new Date().toISOString();

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

    await supabase
      .from('assistant_conversations')
      .update({ messages: conv.messages, updated_at: now })
      .eq('id', conversationId)
      .eq('user_id', userId);
  },

  setTitle: async (conversationId: string, title: string) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, title } : c
      ),
    }));

    await supabase
      .from('assistant_conversations')
      .update({ title })
      .eq('id', conversationId);
  },

  deleteConversation: async (id: string) => {
    set((state) => {
      const conversations = state.conversations.filter((c) => c.id !== id);
      const activeConversationId =
        state.activeConversationId === id
          ? (conversations[0]?.id ?? null)
          : state.activeConversationId;
      return { conversations, activeConversationId };
    });

    await supabase.from('assistant_conversations').delete().eq('id', id);
  },

  getActive: () => {
    const { conversations, activeConversationId } = get();
    return conversations.find((c) => c.id === activeConversationId) ?? null;
  },
}));
