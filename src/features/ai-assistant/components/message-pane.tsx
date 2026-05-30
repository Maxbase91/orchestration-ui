import { Sparkles, User, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase-client';
import type { ChatMessageData, ConfirmTurn } from '@/data/types';
import { TurnChatAnswer } from './turn-chat-answer';
import { TurnDeepLink } from './turn-deep-link';
import { TurnConfirm } from './turn-confirm';
import { TurnSuggestionChips } from './turn-suggestion-chips';

interface MessagePaneProps {
  messages: ChatMessageData[];
  isTyping: boolean;
  streamingContent?: string;
  onSuggestionClick: (text: string) => void;
  onLinkClick: (path: string) => void;
  onConfirmAction: (turn: ConfirmTurn) => void;
  onCancelConfirm: () => void;
}

function renderTurns(
  msg: ChatMessageData,
  onSuggestionClick: (t: string) => void,
  onLinkClick: (p: string) => void,
  onConfirmAction: (t: ConfirmTurn) => void,
  onCancelConfirm: () => void,
  isTyping: boolean,
) {
  if (!msg.turns || msg.turns.length === 0) {
    const text = msg.content || "I couldn't generate a response — please try again.";
    return (
      <div className="rounded-[18px] rounded-tl-[4px] bg-white border border-gray-100 shadow-sm px-4 py-3 text-[13.5px] leading-relaxed text-gray-800">
        <p className="whitespace-pre-wrap">{text}</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {msg.turns.map((turn, i) => {
        const delay = { animationDelay: `${i * 80}ms` };
        switch (turn.type) {
          case 'chat-answer':
            return (
              <div key={i} className="animate-msg-in" style={delay}>
                <TurnChatAnswer turn={turn} />
              </div>
            );
          case 'deep-link':
            return (
              <div key={i} className="animate-msg-in" style={delay}>
                <TurnDeepLink turn={turn} onNavigate={onLinkClick} />
              </div>
            );
          case 'confirm':
            return (
              <div key={i} className="animate-msg-in" style={delay}>
                <TurnConfirm
                  turn={turn}
                  onConfirm={onConfirmAction}
                  onCancel={onCancelConfirm}
                  disabled={isTyping}
                />
              </div>
            );
          case 'suggestion-chips':
            return (
              <div key={i} className="animate-msg-in" style={delay}>
                <TurnSuggestionChips turn={turn} onChipClick={onSuggestionClick} />
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

function AssistantAvatar() {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1B2A4A] to-[#2D5F8A]">
      <Sparkles className="size-3.5 text-white" />
    </div>
  );
}

function FeedbackButtons({ messageId }: { messageId: string }) {
  const [voted, setVoted] = useState<'up' | 'down' | null>(null);

  async function handleVote(polarity: 'up' | 'down') {
    if (voted) return;
    setVoted(polarity);
    await supabase.from('chat_feedback').insert({
      message_id: messageId,
      polarity,
      created_at: new Date().toISOString(),
    });
  }

  return (
    <div className="flex items-center gap-1 mt-1 pl-1">
      <button
        onClick={() => void handleVote('up')}
        className={cn(
          'flex size-5 items-center justify-center rounded transition-colors',
          voted === 'up'
            ? 'text-emerald-600'
            : 'text-gray-300 hover:text-gray-500'
        )}
        title="Helpful"
        disabled={!!voted}
      >
        <ThumbsUp className="size-3" />
      </button>
      <button
        onClick={() => void handleVote('down')}
        className={cn(
          'flex size-5 items-center justify-center rounded transition-colors',
          voted === 'down'
            ? 'text-red-500'
            : 'text-gray-300 hover:text-gray-500'
        )}
        title="Not helpful"
        disabled={!!voted}
      >
        <ThumbsDown className="size-3" />
      </button>
    </div>
  );
}

export function MessagePane({
  messages,
  isTyping,
  streamingContent,
  onSuggestionClick,
  onLinkClick,
  onConfirmAction,
  onCancelConfirm,
}: MessagePaneProps) {
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      {messages.map((msg, msgIdx) => {
        const isUser = msg.role === 'user';
        return (
          <div
            key={msg.id}
            className={cn('flex gap-2.5 animate-msg-in', isUser ? 'flex-row-reverse' : 'flex-row')}
            style={{ animationDelay: `${msgIdx * 30}ms` }}
            onMouseEnter={() => !isUser && setHoveredMsgId(msg.id)}
            onMouseLeave={() => setHoveredMsgId(null)}
          >
            {/* Avatar */}
            <div
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full',
                isUser ? 'bg-gray-700' : 'bg-gradient-to-br from-[#1B2A4A] to-[#2D5F8A]'
              )}
            >
              {isUser ? (
                <User className="size-3.5 text-white" />
              ) : (
                <Sparkles className="size-3.5 text-white" />
              )}
            </div>

            {/* Content */}
            <div className={cn('max-w-[85%]', isUser ? 'items-end' : 'items-start')}>
              {isUser ? (
                <div className="rounded-[18px] rounded-br-[4px] bg-[#1B2A4A] px-4 py-2.5 text-[13.5px] leading-relaxed text-white">
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              ) : (
                <>
                  {renderTurns(msg, onSuggestionClick, onLinkClick, onConfirmAction, onCancelConfirm, isTyping)}
                  {hoveredMsgId === msg.id && msg.id !== 'welcome' && (
                    <FeedbackButtons messageId={msg.id} />
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}

      {/* Streaming bubble — shown while tokens are arriving */}
      {streamingContent && (
        <div className="flex gap-2.5 animate-msg-in">
          <AssistantAvatar />
          <div className="max-w-[85%]">
            <div className="rounded-[18px] rounded-tl-[4px] bg-white border border-gray-100 shadow-sm px-4 py-3 text-[13.5px] leading-relaxed text-gray-800">
              <p className="whitespace-pre-wrap">{streamingContent}<span className="inline-block w-0.5 h-[1em] bg-gray-400 ml-0.5 animate-pulse align-middle" /></p>
            </div>
          </div>
        </div>
      )}

      {/* Typing indicator — shown while waiting for first token */}
      {isTyping && !streamingContent && (
        <div className="flex gap-2.5 animate-msg-in">
          <AssistantAvatar />
          <div className="rounded-[18px] rounded-tl-[4px] bg-white border border-gray-100 shadow-sm px-4 py-3">
            <div className="flex gap-1 items-center h-[18px]">
              <span className="size-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
              <span className="size-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
              <span className="size-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
