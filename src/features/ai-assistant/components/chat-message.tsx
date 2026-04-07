import { Sparkles, User, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

export interface ChatMessageLink {
  label: string;
  path: string;
}

export interface ChatMessageData {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestions?: string[];
  links?: ChatMessageLink[];
}

interface ChatMessageProps {
  message: ChatMessageData;
  onSuggestionClick?: (text: string) => void;
  onLinkClick?: (path: string) => void;
}

export function ChatMessage({ message, onSuggestionClick, onLinkClick }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-gray-800' : 'bg-amber-100'
        )}
      >
        {isUser ? (
          <User className="size-3.5 text-white" />
        ) : (
          <Sparkles className="size-3.5 text-amber-600" />
        )}
      </div>

      {/* Bubble */}
      <div className={cn('max-w-[85%] space-y-2')}>
        <div
          className={cn(
            'rounded-lg px-3 py-2 text-sm',
            isUser
              ? 'bg-gray-800 text-white'
              : 'bg-blue-50 text-gray-900'
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Action Links */}
        {message.links && message.links.length > 0 && (
          <div className="space-y-1">
            {message.links.map((link) => (
              <button
                key={link.path}
                className="flex w-full items-center gap-2 rounded-md border border-blue-200 bg-white px-3 py-2 text-left text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50"
                onClick={() => onLinkClick?.(link.path)}
              >
                <ArrowRight className="size-3.5 shrink-0" />
                {link.label}
              </button>
            ))}
          </div>
        )}

        {/* Suggestions */}
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {message.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700 transition-colors hover:bg-blue-100"
                onClick={() => onSuggestionClick?.(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <p className={cn('text-[10px] text-muted-foreground', isUser ? 'text-right' : 'text-left')}>
          {format(parseISO(message.timestamp), 'HH:mm')}
        </p>
      </div>
    </div>
  );
}
