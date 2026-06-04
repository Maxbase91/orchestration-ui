import { useState, useMemo } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useConversationStore } from '@/stores/conversation-store';
import { provider } from './index';
import type { ConfirmTurn, ChatMessageData, ChatAnswerTurn, AssistantTurn } from '@/data/types';

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

const isGroqProvider = import.meta.env.VITE_ASSISTANT_PROVIDER === 'groq';

// Fetch /api/chat via SSE and return turns. Calls onToken for each streamed text chunk.
// Aborts and returns a graceful fallback if no done event arrives within 40s.
async function fetchSSE(
  messages: Array<{ role: string; content: string }>,
  ctx: { role: string; currentUser: { id: string; name: string } },
  onToken: (chunk: string) => void,
): Promise<AssistantTurn[]> {
  const controller = new AbortController();
  const watchdog = setTimeout(() => controller.abort(), 40000);

  let resp: Response;
  try {
    resp = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({ messages, context: ctx }),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(watchdog);
    const isAbort = err instanceof Error && err.name === 'AbortError';
    if (isAbort) return [{ type: 'chat-answer', content: "That's taking too long — please try again in a moment." }];
    throw err;
  }

  if (!resp.ok || !resp.body) {
    clearTimeout(watchdog);
    throw new Error(`api/chat ${resp.status}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let accumulatedText = '';
  let structuralTurns: AssistantTurn[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      const events = buf.split('\n\n');
      buf = events.pop() ?? '';

      for (const event of events) {
        const dataLine = event.trim();
        if (!dataLine.startsWith('data: ')) continue;
        try {
          const payload = JSON.parse(dataLine.slice(6)) as {
            t: 'tok' | 'done' | 'error';
            c?: string;
            turns?: AssistantTurn[];
            msg?: string;
          };

          if (payload.t === 'tok' && payload.c) {
            accumulatedText += payload.c;
            onToken(payload.c);
          } else if (payload.t === 'done') {
            structuralTurns = payload.turns ?? [];
          }
        } catch { /* ignore malformed events */ }
      }
    }
  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    if (isAbort) {
      return [{ type: 'chat-answer', content: "That's taking too long — please try again in a moment." }];
    }
    throw err;
  } finally {
    clearTimeout(watchdog);
    reader.releaseLock();
  }

  // Sanitise accumulated text: strip any leaked tool-call syntax before rendering.
  const TOOL_LEAK_RE = /(?:tool_calls\.)?(?:search_knowledge|lookup_object|filter_objects|propose_action|create_ticket|start_demand|remember_preference)\s*[:(]/i;
  const cleanedText = accumulatedText
    .replace(/^(?:tool_calls\.)?\b(?:search_knowledge|lookup_object|filter_objects|propose_action|create_ticket|start_demand|remember_preference)\b\s*[:(][^\n]*/gim, '')
    .trim();

  const turns: AssistantTurn[] = [];
  if (cleanedText && !TOOL_LEAK_RE.test(cleanedText)) {
    turns.push({ type: 'chat-answer', content: cleanedText });
  }
  turns.push(...structuralTurns);
  return turns.length > 0 ? turns : [FALLBACK_TURN];
}

export function useAssistant(conversationId: string | null) {
  const { currentRole, currentUser } = useAuthStore();
  const { conversations, addMessage, setTitle, createConversation } = useConversationStore();
  const [isTyping, setIsTyping] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

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

    let activeId = conversationId;
    if (!activeId) {
      activeId = await createConversation(currentUser.id);
      if (!activeId) return;
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
    setStreamingContent('');

    try {
      const history = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.role === 'assistant' && m.turns ? turnsToText(m.turns) : m.content,
      }));

      let turns: AssistantTurn[];

      if (isGroqProvider) {
        let firstToken = true;
        try {
          turns = await fetchSSE(history, ctx, (chunk) => {
            if (firstToken) {
              setIsTyping(false);
              firstToken = false;
            }
            setStreamingContent((prev) => prev + chunk);
          });
        } catch (e) {
          console.warn('SSE failed, falling back to mock:', e);
          const rawTurns = await provider.respond(history, ctx);
          turns = rawTurns.length > 0 ? rawTurns : [FALLBACK_TURN];
        }
      } else {
        const rawTurns = await provider.respond(history, ctx);
        turns = rawTurns.length > 0 ? rawTurns : [FALLBACK_TURN];
      }

      const assistantMessage: ChatMessageData = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        turns,
      };

      setStreamingContent('');
      await addMessage(activeId, assistantMessage, currentUser.id);
    } finally {
      setIsTyping(false);
      setStreamingContent('');
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

  return { messages, isTyping, streamingContent, handleSend, handleConfirmAction, handleCancelConfirm };
}
