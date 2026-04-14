import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Send, User, CheckCircle, Circle, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { suppliers } from '@/data/suppliers';
import { getAICommodityCode } from '@/lib/mock-ai';
import { formatCurrency } from '@/lib/format';

interface StepChatIntakeProps {
  category: string;
  categoryDescription: string;
  data: {
    title: string;
    supplier: string;
    supplierId: string;
    estimatedValue: number;
    currency: string;
    businessJustification: string;
    deliveryDate: string;
    isUrgent: boolean;
    costCentre: string;
    commodityCode: string;
    commodityCodeLabel: string;
  };
  onUpdate: (data: Record<string, unknown>) => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const WELCOME_MESSAGES: Record<string, string> = {
  goods: "I'll help you set up your purchase request. What do you need to buy? Please describe the items or equipment.",
  services: "I'll help you create a service engagement request. What service do you need? Describe the scope briefly.",
  consulting: "Let's set up your consulting engagement. What's the objective of this consulting work?",
  software: "I'll help you with your software/IT request. What software, licence, or system do you need?",
  'contingent-labour': "I'll help you request temporary staff or contractors. What role or skills do you need?",
};

const FIELD_LABELS: { key: string; label: string }[] = [
  { key: 'title', label: 'Description' },
  { key: 'category', label: 'Category' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'estimatedValue', label: 'Estimated Value' },
  { key: 'deliveryDate', label: 'Delivery Timeline' },
  { key: 'costCentre', label: 'Cost Centre' },
  { key: 'businessJustification', label: 'Justification' },
];

const COST_CENTRE_LABELS: Record<string, string> = {
  'CC-1001': 'Marketing',
  'CC-2001': 'IT',
  'CC-3001': 'Operations',
  'CC-4001': 'Finance',
  'CC-5001': 'HR',
};

function buildWelcomeMessage(category: string, data: StepChatIntakeProps['data']): string {
  const parts: string[] = [];

  // Acknowledge what's already known
  if (data.title || data.supplier || data.estimatedValue > 0) {
    parts.push("Great, I've got some details from your initial request:");
    if (data.title) parts.push(`• **${data.title}**`);
    if (data.supplier) parts.push(`• Supplier: ${data.supplier}`);
    if (data.estimatedValue > 0) parts.push(`• Value: €${data.estimatedValue.toLocaleString()}`);
    if (data.businessJustification) parts.push(`\nHere's the description I've drafted:\n"${data.businessJustification}"\n\nWould you like to refine this, or shall I ask you a few questions to make it stronger?`);
    else parts.push('\nLet me ask a few quick questions to complete your request.');
  } else {
    parts.push(WELCOME_MESSAGES[category] ?? WELCOME_MESSAGES.goods);
  }

  return parts.join('\n');
}

export function StepChatIntake({ category, categoryDescription, data, onUpdate }: StepChatIntakeProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: buildWelcomeMessage(category, data) },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Count filled fields
  const filledCount = FIELD_LABELS.filter(({ key }) => {
    if (key === 'category') return true;
    if (key === 'estimatedValue') return data.estimatedValue > 0;
    return !!(data as Record<string, unknown>)[key];
  }).length;

  const getFieldValue = (key: string): string => {
    if (key === 'category') return categoryDescription;
    if (key === 'estimatedValue') return data.estimatedValue > 0 ? formatCurrency(data.estimatedValue) : '';
    if (key === 'costCentre') return data.costCentre ? `${data.costCentre} ${COST_CENTRE_LABELS[data.costCentre] ?? ''}` : '';
    return String((data as Record<string, unknown>)[key] ?? '');
  };

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isTyping) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInputValue('');
    setIsTyping(true);
    setError(false);

    try {
      const response = await fetch('/api/chat-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
          category,
          extractedSoFar: {
            title: data.title || undefined,
            supplier: data.supplier || undefined,
            estimatedValue: data.estimatedValue || undefined,
            deliveryDate: data.deliveryDate || undefined,
            businessJustification: data.businessJustification || undefined,
            costCentre: data.costCentre || undefined,
          },
        }),
      });

      if (!response.ok) throw new Error('API error');

      const result = await response.json();

      // Merge extracted data
      if (result.extracted) {
        const updates: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(result.extracted)) {
          if (value !== undefined && value !== null && value !== '' && value !== 0) {
            updates[key] = value;
          }
        }

        // Match supplier against directory
        if (updates.supplier && typeof updates.supplier === 'string') {
          const matched = suppliers.find((s) =>
            s.name.toLowerCase().includes((updates.supplier as string).toLowerCase()) ||
            (updates.supplier as string).toLowerCase().includes(s.name.toLowerCase())
          );
          if (matched) {
            updates.supplierId = matched.id;
            updates.supplier = matched.name;
          }
        }

        // Auto-derive commodity code from title/description
        if (updates.title && typeof updates.title === 'string') {
          const commodity = getAICommodityCode(updates.title);
          if (commodity) {
            updates.commodityCode = commodity.code;
            updates.commodityCodeLabel = commodity.label;
          }
        }

        onUpdate(updates);
      }

      // Add assistant response
      if (result.nextQuestion) {
        setMessages((prev) => [...prev, { role: 'assistant', content: result.nextQuestion }]);
      }

      if (result.complete) {
        setIsComplete(true);
        setSummary(result.summary ?? '');
        if (result.nextQuestion) {
          // LLM sent a completion message as nextQuestion
        } else {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: result.summary ?? 'All details captured. You can proceed to validation.' },
          ]);
        }
      }
    } catch {
      setError(true);
      toast.error('Failed to connect to AI. You can continue typing or switch to form mode.');
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "I'm having trouble connecting. Could you try again, or click 'Next' to proceed with what we have so far?" },
      ]);
    } finally {
      setIsTyping(false);
    }
  }, [inputValue, isTyping, messages, category, data, onUpdate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 min-h-[400px]">
      {/* Chat Area (3/5) */}
      <div className="lg:col-span-3 flex flex-col rounded-lg border border-gray-200 bg-white overflow-hidden">
        {/* Chat Header */}
        <div className="shrink-0 border-b px-4 py-3 flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-full bg-blue-100">
            <Sparkles className="size-3.5 text-[#2D5F8A]" />
          </div>
          <span className="text-sm font-semibold text-gray-900">Procurement Assistant</span>
          <Badge variant="outline" className="text-[10px]">{categoryDescription}</Badge>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={cn('flex gap-2', msg.role === 'user' ? 'flex-row-reverse' : '')}>
              <div className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full',
                msg.role === 'user' ? 'bg-[#1B2A4A]' : 'bg-blue-100'
              )}>
                {msg.role === 'user'
                  ? <User className="size-3.5 text-white" />
                  : <Sparkles className="size-3.5 text-[#2D5F8A]" />
                }
              </div>
              <div className={cn(
                'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                msg.role === 'user' ? 'bg-[#1B2A4A] text-white' : 'bg-blue-50 text-gray-900'
              )}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-100">
                <Sparkles className="size-3.5 text-[#2D5F8A]" />
              </div>
              <div className="rounded-lg bg-blue-50 px-3 py-2">
                <div className="flex gap-1">
                  <span className="size-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
                  <span className="size-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
                  <span className="size-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {/* Complete banner */}
          {isComplete && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3">
              <CheckCircle className="size-5 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800">Request details captured</p>
                {summary && <p className="text-xs text-green-600 mt-0.5">{summary}</p>}
                <p className="text-xs text-green-600 mt-1">Click <strong>Next</strong> to proceed to validation.</p>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
              <AlertTriangle className="size-4 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700">Connection issue. Try sending your message again.</p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 border-t p-3 flex gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isComplete ? 'Add more details or click Next...' : 'Type your answer...'}
            disabled={isTyping}
            className="flex-1"
          />
          <Button size="sm" onClick={handleSend} disabled={isTyping || !inputValue.trim()}>
            {isTyping ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </div>

      {/* Summary Card (2/5) */}
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4 sticky top-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-[#2D5F8A]" />
            <h3 className="text-sm font-semibold text-gray-900">Request Summary</h3>
          </div>

          {/* Progress */}
          <div>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>{filledCount} of {FIELD_LABELS.length} fields captured</span>
              <span>{Math.round((filledCount / FIELD_LABELS.length) * 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#2D5F8A] transition-all duration-500"
                style={{ width: `${(filledCount / FIELD_LABELS.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-2.5">
            {FIELD_LABELS.map(({ key, label }) => {
              const value = getFieldValue(key);
              const filled = !!value;
              return (
                <div key={key} className="flex items-start gap-2">
                  {filled ? (
                    <CheckCircle className="size-4 text-green-500 mt-0.5 shrink-0" />
                  ) : (
                    <Circle className="size-4 text-gray-300 mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">{label}</p>
                    <p className={cn('text-sm truncate', filled ? 'text-gray-900' : 'text-gray-300 italic')}>
                      {filled ? value : 'Pending...'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Commodity Code (auto-derived) */}
          {data.commodityCode && (
            <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2">
              <p className="text-[10px] font-medium text-blue-600 uppercase tracking-wider">Auto-derived</p>
              <p className="text-xs text-blue-800 mt-0.5">
                Commodity: {data.commodityCode} — {data.commodityCodeLabel}
              </p>
            </div>
          )}

          {/* Supplier match */}
          {data.supplierId && (
            <div className="rounded-md bg-green-50 border border-green-100 px-3 py-2">
              <p className="text-[10px] font-medium text-green-600 uppercase tracking-wider">Supplier Matched</p>
              <p className="text-xs text-green-800 mt-0.5">
                {data.supplier} found in supplier directory
              </p>
            </div>
          )}

          {/* Ready indicator */}
          {isComplete && (
            <div className="rounded-md bg-green-50 border border-green-200 p-3 text-center">
              <CheckCircle className="size-5 text-green-600 mx-auto mb-1" />
              <p className="text-sm font-medium text-green-800">Ready for validation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
