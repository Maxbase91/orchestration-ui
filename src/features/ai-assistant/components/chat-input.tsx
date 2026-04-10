import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
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
    <div className="flex gap-2">
      <input
        type="text"
        className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
        placeholder="Ask anything..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />
      <Button
        size="sm"
        className="h-9 w-9 shrink-0 p-0"
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
      >
        <Send className="size-4" />
      </Button>
    </div>
  );
}
