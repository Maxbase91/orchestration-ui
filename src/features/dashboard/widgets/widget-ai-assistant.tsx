import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { openAIChat } from '@/features/ai-assistant/ai-chat-overlay';

const suggestedPrompts = [
  'Summarise my open requests',
  'Which suppliers need attention?',
  'Show bottlenecks',
];

export function WidgetAIAssistant() {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (text?: string) => {
    const _q = text ?? prompt;
    if (_q.trim()) {
      setPrompt('');
    }
    openAIChat();
  };

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="flex gap-2"
      >
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask anything..."
          className="text-sm"
        />
        <Button type="submit" size="icon" variant="ghost">
          <Send className="size-4" />
        </Button>
      </form>
      <div className="flex flex-wrap gap-1.5">
        {suggestedPrompts.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => handleSubmit(p)}
            className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/80 transition-colors text-muted-foreground"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
