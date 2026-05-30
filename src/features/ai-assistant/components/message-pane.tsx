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
      <div className="rounded-lg bg-gray-50 px-3 py-2 text-[13px] leading-relaxed text-gray-800">
        <p className="whitespace-pre-wrap">{text}</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {msg.turns.map((turn, i) => {
        switch (turn.type) {
          case 'chat-answer':
            return <TurnChatAnswer key={i} turn={turn} />;
          case 'deep-link':
            return <TurnDeepLink key={i} turn={turn} onNavigate={onLinkClick} />;
          case 'confirm':
            return (
              <TurnConfirm
                key={i}
                turn={turn}
                onConfirm={onConfirmAction}
                onCancel={onCancelConfirm}
                disabled={isTyping}
              />
            );
          case 'suggestion-chips':
            return <TurnSuggestionChips key={i} turn={turn} onChipClick={onSuggestionClick} />;
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
    <div className="space-y-4">
      {messages.map((msg) => {
        const isUser = msg.role === 'user';
        return (
          <div key={msg.id} className={cn('flex gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
            <div
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full',
                isUser ? 'bg-gray-800' : 'bg-amber-100'
              )}
            >
              {isUser ? (
                <User className="size-3 text-white" />
              ) : (
                <Sparkles className="size-3 text-amber-600" />
              )}
            </div>
            <div className="max-w-[85%]">
              {isUser ? (
                <div className="rounded-lg bg-gray-800 px-3 py-2 text-[13px] leading-relaxed text-white">
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              ) : (
                renderTurns(msg, onSuggestionClick, onLinkClick, onConfirmAction, onCancelConfirm, isTyping)
              )}
            </div>
          </div>
        );
      })}

      {isTyping && (
        <div className="flex gap-2">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <Sparkles className="size-3 text-amber-600" />
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <div className="flex gap-1">
              <span className="size-1.5 animate-bounce rounded-full bg-gray-300" style={{ animationDelay: '0ms' }} />
              <span className="size-1.5 animate-bounce rounded-full bg-gray-300" style={{ animationDelay: '150ms' }} />
              <span className="size-1.5 animate-bounce rounded-full bg-gray-300" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
