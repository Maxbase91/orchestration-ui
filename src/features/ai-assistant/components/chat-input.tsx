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
        className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm placeholder:text-gray-400 focus:bg-white focus:border-[#2D5F8A] focus:ring-2 focus:ring-[#2D5F8A]/10 focus:outline-none transition-colors"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />
      <button
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1B2A4A] text-white shadow-sm hover:bg-[#273957] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
      >
        <ArrowUp className="size-4" />
      </button>
    </div>
  );
}
