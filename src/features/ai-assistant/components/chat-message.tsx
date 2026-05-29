import { Sparkles, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AssistantTurn, ConfirmTurn } from '@/data/types';
import { TurnChatAnswer } from './turn-chat-answer';
import { TurnDeepLink } from './turn-deep-link';
import { TurnConfirm } from './turn-confirm';
import { TurnSuggestionChips } from './turn-suggestion-chips';

export interface ChatMessageLink {
  label: string;
  path: string;
}

export interface ChatMessageData {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  // New turn-based rendering — when present, replaces content/suggestions/links.
  turns?: AssistantTurn[];
  // Legacy fields kept for backward compat
  suggestions?: string[];
  links?: ChatMessageLink[];
}

interface ChatMessageProps {
  message: ChatMessageData;
  onSuggestionClick?: (text: string) => void;
  onLinkClick?: (path: string) => void;
  onConfirmAction?: (turn: ConfirmTurn) => void;
  onCancelConfirm?: () => void;
  isProcessing?: boolean;
}

export function ChatMessage({
  message,
  onSuggestionClick,
  onLinkClick,
  onConfirmAction,
  onCancelConfirm,
  isProcessing,
}: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
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

      <div className={cn('max-w-[85%] space-y-1.5')}>
        {/* Turn-based rendering */}
        {!isUser && message.turns && message.turns.length > 0 ? (
          <div className="space-y-2">
            {message.turns.map((turn, i) => {
              switch (turn.type) {
                case 'chat-answer':
                  return <TurnChatAnswer key={i} turn={turn} />;
                case 'deep-link':
                  return (
                    <TurnDeepLink
                      key={i}
                      turn={turn}
                      onNavigate={(path) => onLinkClick?.(path)}
                    />
                  );
                case 'confirm':
                  return (
                    <TurnConfirm
                      key={i}
                      turn={turn}
                      onConfirm={(t) => onConfirmAction?.(t)}
                      onCancel={() => onCancelConfirm?.()}
                      disabled={isProcessing}
                    />
                  );
                case 'suggestion-chips':
                  return (
                    <TurnSuggestionChips
                      key={i}
                      turn={turn}
                      onChipClick={(prompt) => onSuggestionClick?.(prompt)}
                    />
                  );
                default:
                  return null;
              }
            })}
          </div>
        ) : (
          <>
            {/* Legacy plain-text rendering */}
            <div
              className={cn(
                'rounded-lg px-3 py-2 text-[13px] leading-relaxed',
                isUser ? 'bg-gray-800 text-white' : 'bg-gray-50 text-gray-800'
              )}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>

            {message.links && message.links.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {message.links.slice(0, 3).map((link) => (
                  <button
                    key={link.path + link.label}
                    className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                    onClick={() => onLinkClick?.(link.path)}
                  >
                    {link.label}
                  </button>
                ))}
              </div>
            )}

            {message.suggestions && message.suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {message.suggestions.slice(0, 3).map((suggestion) => (
                  <button
                    key={suggestion}
                    className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-600 hover:bg-gray-100 transition-colors"
                    onClick={() => onSuggestionClick?.(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
