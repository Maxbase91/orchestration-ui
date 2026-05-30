import { Sparkles, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessageData, ConfirmTurn } from '@/data/types';
import { TurnChatAnswer } from './turn-chat-answer';
import { TurnDeepLink } from './turn-deep-link';
import { TurnConfirm } from './turn-confirm';
import { TurnSuggestionChips } from './turn-suggestion-chips';

interface MessagePaneProps {
  messages: ChatMessageData[];
  isTyping: boolean;
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

export function MessagePane({
  messages,
  isTyping,
  onSuggestionClick,
  onLinkClick,
  onConfirmAction,
  onCancelConfirm,
}: MessagePaneProps) {
  return (
    <div className="space-y-5">
      {messages.map((msg, msgIdx) => {
        const isUser = msg.role === 'user';
        return (
          <div
            key={msg.id}
            className={cn('flex gap-2.5 animate-msg-in', isUser ? 'flex-row-reverse' : 'flex-row')}
            style={{ animationDelay: `${msgIdx * 30}ms` }}
          >
            {/* Avatar */}
            <div
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full',
                isUser
                  ? 'bg-gray-700'
                  : 'bg-gradient-to-br from-[#1B2A4A] to-[#2D5F8A]'
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
                renderTurns(msg, onSuggestionClick, onLinkClick, onConfirmAction, onCancelConfirm, isTyping)
              )}
            </div>
          </div>
        );
      })}

      {/* Typing indicator */}
      {isTyping && (
        <div className="flex gap-2.5 animate-msg-in">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1B2A4A] to-[#2D5F8A]">
            <Sparkles className="size-3.5 text-white" />
          </div>
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
