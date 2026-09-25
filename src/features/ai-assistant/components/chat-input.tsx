// Message composer for the AI assistant panel: single-line input + send button.
// Kept dumb on purpose — send/disable state is owned by the conversation store.
import { useState } from 'react';
import { ArrowUp } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder = 'Ask anything…' }: ChatInputProps) {
  const [value, setValue] = useState('');

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        aria-label="Message the assistant"
        className="flex-1 rounded-full border border-line bg-card-2 px-4 py-2.5 text-sm placeholder:text-ink-3 focus:bg-card focus:border-accent focus:ring-2 focus:ring-accent/10 focus:outline-none transition-colors"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />
      <button
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-solid text-paper shadow-sm hover:bg-accent-solid/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
      >
        <ArrowUp className="size-4" />
      </button>
    </div>
  );
}
