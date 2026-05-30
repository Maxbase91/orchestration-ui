import { useState, useMemo } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useConversationStore } from '@/stores/conversation-store';
import { provider } from './index';
import type { ConfirmTurn, ChatMessageData, ChatAnswerTurn } from '@/data/types';

const FALLBACK_TURN: ChatAnswerTurn = {
  type: 'chat-answer',
  content: "I couldn't generate a response — please try again.",
};

function turnsToText(turns: ChatMessageData['turns']): string {
  if (!turns) return '';
  return turns
    .filter((t): t is ChatAnswerTurn => t.type === 'chat-answer')
    .map((t) => t.content)
    .join('\n');
}

export function useAssistant(conversationId: string | null) {
  const { currentRole, currentUser } = useAuthStore();
  const { conversations, addMessage, setTitle, createConversation } = useConversationStore();
  const [isTyping, setIsTyping] = useState(false);

  const conversation = useMemo(
    () => conversations.find((c) => c.id === conversationId) ?? null,
    [conversations, conversationId]
  );
  const messages = conversation?.messages ?? [];

  const ctx = useMemo(
    () => ({ role: currentRole, currentUser: { id: currentUser.id, name: currentUser.name } }),
    [currentRole, currentUser.id, currentUser.name]
  );

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    // Auto-create a conversation if none is active yet (race condition on first open).
    let activeId = conversationId;
    if (!activeId) {
      activeId = await createConversation(currentUser.id);
      if (!activeId) return; // creation failed — Supabase error already logged
    }

    const userMessage: ChatMessageData = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    await addMessage(activeId, userMessage, currentUser.id);

    if (conversation && conversation.title === 'New conversation' && messages.length === 0) {
      await setTitle(activeId, trimmed.slice(0, 50));
    }

    setIsTyping(true);
    try {
      const history = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.role === 'assistant' && m.turns ? turnsToText(m.turns) : m.content,
      }));

      const rawTurns = await provider.respond(history, ctx);
      const turns = rawTurns.length > 0 ? rawTurns : [FALLBACK_TURN];

      const assistantMessage: ChatMessageData = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        turns,
      };

      await addMessage(activeId, assistantMessage, currentUser.id);
    } finally {
      setIsTyping(false);
    }
  }

  async function handleConfirmAction(turn: ConfirmTurn) {
    const activeId = conversationId;
    if (!activeId) return;
    setIsTyping(true);
    try {
      const rawTurns = await provider.executeAction(turn, ctx);
      const resultTurns = rawTurns.length > 0 ? rawTurns : [FALLBACK_TURN];
      const resultMessage: ChatMessageData = {
        id: `msg-${Date.now()}-result`,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        turns: resultTurns,
      };
      await addMessage(activeId, resultMessage, currentUser.id);
    } finally {
      setIsTyping(false);
    }
  }

  async function handleCancelConfirm() {
    const activeId = conversationId;
    if (!activeId) return;
    const cancelMessage: ChatMessageData = {
      id: `msg-${Date.now()}-cancel`,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      turns: [{ type: 'chat-answer', content: 'No problem — action cancelled. Let me know if you need anything else.' }],
    };
    await addMessage(activeId, cancelMessage, currentUser.id);
  }

  return { messages, isTyping, handleSend, handleConfirmAction, handleCancelConfirm };
}
