import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Send, User, CheckCircle, Circle, Loader2, AlertTriangle, FileText, Copy, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useSuppliers } from '@/lib/db/hooks/use-suppliers';
import { getAICommodityCode } from '@/lib/mock-ai';
import { formatCurrency } from '@/lib/format';
import {
  determineNextQuestion,
  isConversationComplete,
  requiredSlotsFilled,
  type DemandConversationContext,
} from '@/lib/procurement/demand-conversation';
import type { ServiceDescription } from './new-request-page';

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
  { key: 'category', label: 'Commodity Code' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'estimatedValue', label: 'Estimated Value' },
  { key: 'deliveryDate', label: 'Delivery Timeline' },
  { key: 'businessJustification', label: 'Justification' },
];

// The service-description components. Examples/guidance live in the chat (the
// assistant asks with a category-specific example) — this panel just tracks
// what's been captured.
const SOW_SECTIONS: { key: string; label: string }[] = [
  { key: 'objective', label: 'Objective' },
  { key: 'scope', label: 'Scope of Work' },
  { key: 'deliverables', label: 'Deliverables' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'resources', label: 'Resources' },
  { key: 'acceptanceCriteria', label: 'Acceptance Criteria' },
  { key: 'pricingModel', label: 'Pricing Model' },
  { key: 'location', label: 'Location' },
  { key: 'dependencies', label: 'Dependencies' },
];


// Build the dynamic-conversation engine context from the request data + the SOW
// captured so far. The engine decides the next question and completeness from
// this — so behaviour is identical whether the LLM is up or we use the fallback.
function buildContext(
  category: string,
  data: StepChatIntakeProps['data'],
  sow: Partial<ServiceDescription>,
): DemandConversationContext {
  return {
    category,
    title: data.title || undefined,
    estimatedValue: data.estimatedValue || undefined,
    deliveryDate: data.deliveryDate || undefined,
    sow: {
      objective: sow.objective, scope: sow.scope, deliverables: sow.deliverables,
      resources: sow.resources, timeline: sow.timeline, acceptanceCriteria: sow.acceptanceCriteria,
      pricingModel: sow.pricingModel, dependencies: sow.dependencies,
    },
  };
}

/**
 * Deterministic fallback used only when the LLM endpoint is unavailable. Writes
 * the user's answer into whichever slot the engine is currently asking for, then
 * asks the engine for the next one — so the same adaptive, carry-forward flow
 * runs offline. Mandatory SOW still holds (completeness = engine agenda empty).
 */
function localFallbackResponse(
  userText: string,
  category: string,
  data: StepChatIntakeProps['data'],
  svcDesc: Partial<ServiceDescription>,
): {
  extracted: Record<string, unknown>;
  sow: Partial<ServiceDescription>;
  nextQuestion: string;
  complete: boolean;
} {
  const extracted: Record<string, unknown> = {};
  const sowUpdate: Partial<ServiceDescription> = {};

  // Which slot is the user answering right now?
  const answering = determineNextQuestion(buildContext(category, data, svcDesc))?.slot;
  if (answering) {
    if (answering.target.kind === 'request') {
      if (answering.target.field === 'estimatedValue') {
        const m = userText.match(/[\d,]+[kK]|\d[\d,.]+/);
        if (m) {
          let val = m[0].replace(/,/g, '');
          if (val.toLowerCase().endsWith('k')) val = String(Number(val.slice(0, -1)) * 1000);
          const num = Number(val);
          if (num > 0) extracted.estimatedValue = num;
        }
      } else {
        extracted[answering.target.field] = userText.slice(0, 200); // title / deliveryDate
      }
    } else {
      sowUpdate[answering.target.field] = userText;
    }
  }

  // Recompute against the just-captured answer to get the next question.
  const nextData = { ...data, ...(extracted as Partial<StepChatIntakeProps['data']>) };
  const nextSow = { ...svcDesc, ...sowUpdate };
  const ctx = buildContext(category, nextData, nextSow);
  const complete = isConversationComplete(ctx);

  if (complete) {
    const narrative = [nextSow.objective, nextSow.scope, nextSow.deliverables, nextSow.resources]
      .filter(Boolean)
      .join('\n\n');
    sowUpdate.narrative = narrative;
    extracted.businessJustification = narrative;
    return { extracted, sow: sowUpdate, nextQuestion: 'All details captured. Click Next to proceed to supplier identification and compliance.', complete: true };
  }

  return { extracted, sow: sowUpdate, nextQuestion: determineNextQuestion(ctx)?.prompt ?? '', complete: false };
}

function buildWelcomeMessage(category: string, data: StepChatIntakeProps['data']): string {
  const parts: string[] = [];

  // Acknowledge what's already known.
  if (data.title || data.supplier || data.estimatedValue > 0) {
    parts.push("Great, I've got some details already:");
    if (data.title) parts.push(`• **${data.title}**`);
    if (data.supplier) parts.push(`• Supplier: ${data.supplier}`);
    if (data.estimatedValue > 0) parts.push(`• Value: €${data.estimatedValue.toLocaleString()}`);
    // Go straight to the next unanswered question the engine selects instead
    // of asking "do you want to refine this?".
    parts.push('');
    parts.push(
      determineNextQuestion(buildContext(category, data, {}))?.prompt ??
        (WELCOME_MESSAGES[category] ?? WELCOME_MESSAGES.goods),
    );
  } else {
    parts.push(WELCOME_MESSAGES[category] ?? WELCOME_MESSAGES.goods);
  }

  return parts.join('\n');
}

export function StepChatIntake({ category, categoryDescription, data, onUpdate }: StepChatIntakeProps) {
  const { data: suppliers = [] } = useSuppliers();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: buildWelcomeMessage(category, data) },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState(false);
  const [svcDesc, setSvcDesc] = useState<Partial<ServiceDescription>>({});
  const [generating, setGenerating] = useState(false);
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const [qualityChecks, setQualityChecks] = useState<{ section: string; passed: boolean; issue: string | null }[]>([]);
  const [showQuality, setShowQuality] = useState(false);
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

  // Unified completeness across the request key facts AND the SOW elements —
  // the service description is one document, not a summary plus a separate SOW.
  const sowFilledCount = SOW_SECTIONS.filter((s) => svcDesc[s.key as keyof ServiceDescription]).length;
  const unifiedTotal = FIELD_LABELS.length + SOW_SECTIONS.length;
  const unifiedDone = filledCount + sowFilledCount;
  const unifiedPct = Math.round((unifiedDone / unifiedTotal) * 100);

  const getFieldValue = (key: string): string => {
    // The "Commodity Code" key-fact shows the specific UNSPSC code + label (the
    // meaningful classification), falling back to the high-level category.
    if (key === 'category') {
      return data.commodityCode
        ? `${data.commodityCode} — ${data.commodityCodeLabel}`
        : categoryDescription;
    }
    if (key === 'estimatedValue') return data.estimatedValue > 0 ? formatCurrency(data.estimatedValue) : '';
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
            serviceDescription: svcDesc,
          },
        }),
      });

      if (!response.ok) throw new Error('API error');

      const result = await response.json();

      // Merge extracted request fields (LLM does the extraction).
      const updates: Record<string, unknown> = {};
      if (result.extracted) {
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
          const commodity = getAICommodityCode(updates.title, category);
          if (commodity) {
            updates.commodityCode = commodity.code;
            updates.commodityCodeLabel = commodity.label;
          }
        }
        if (Object.keys(updates).length > 0) onUpdate(updates);
      }

      // Merge SOW sections.
      let mergedSow: Partial<ServiceDescription> = svcDesc;
      if (result.serviceDescription) {
        const merged: Partial<ServiceDescription> = { ...svcDesc };
        for (const [key, value] of Object.entries(result.serviceDescription)) {
          if (value && typeof value === 'string' && value.trim()) {
            merged[key as keyof ServiceDescription] = value as string;
          }
        }
        mergedSow = merged;
        setSvcDesc(merged);
        onUpdate({ serviceDescription: merged });
      }

      // The ENGINE — not the LLM — owns the next question and completeness,
      // computed from the just-merged state. So the flow is adaptive, carries
      // everything forward, and never re-asks or short-circuits the mandatory
      // SOW (regardless of what the LLM returns for nextQuestion/complete).
      const mergedData = {
        ...data,
        title: (updates.title as string) || data.title,
        estimatedValue: (updates.estimatedValue as number) || data.estimatedValue,
        deliveryDate: (updates.deliveryDate as string) || data.deliveryDate,
      };
      const ctx = buildContext(category, mergedData, mergedSow);

      if (isConversationComplete(ctx) && requiredSlotsFilled(ctx)) {
        setIsComplete(true);
        setSummary(result.summary ?? 'Service description captured. Ready for supplier identification and compliance.');
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: result.summary ?? 'All details captured. You can proceed to the next step.' },
        ]);
      } else {
        const prompt = determineNextQuestion(ctx)?.prompt;
        if (prompt) setMessages((prev) => [...prev, { role: 'assistant', content: prompt }]);
      }
    } catch {
      // LLM unavailable — the engine still drives the same adaptive, carry-
      // forward flow (mandatory SOW preserved) using a lightweight extraction.
      const fallback = localFallbackResponse(text, category, data, svcDesc);

      if (Object.keys(fallback.extracted).length > 0) {
        onUpdate(fallback.extracted);
      }
      if (Object.keys(fallback.sow).length > 0) {
        setSvcDesc((prev) => ({ ...prev, ...fallback.sow }));
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: fallback.nextQuestion }]);

      if (fallback.complete) {
        setIsComplete(true);
        setSummary('Service description captured. Ready for supplier identification and compliance.');
      }
    } finally {
      setIsTyping(false);
    }
  }, [inputValue, isTyping, messages, category, data, svcDesc, onUpdate, suppliers]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // The service description is composed automatically once the conversation has
  // captured all required components — there is no manual "generate" action.
  // This polishes the captured answers into the full set of sections + a
  // narrative; if the endpoint is unavailable it stays graceful (the
  // conversation has already composed a working narrative) and shows no error.
  const generateServiceDescription = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/generate-sow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          title: data.title,
          value: data.estimatedValue,
          supplier: data.supplier,
          timeline: data.deliveryDate,
          capturedAnswers: Object.fromEntries(
            Object.entries(svcDesc).filter(([, v]) => v?.trim()),
          ),
          commodityCode: data.commodityCode,
        }),
      });

      if (!res.ok) throw new Error('generate-sow API error');
      const result = await res.json() as {
        sections: Partial<ServiceDescription>;
        narrative: string;
        qualityScore: number;
        qualityChecks: { section: string; passed: boolean; issue: string | null }[];
      };

      const merged = { ...result.sections, narrative: result.narrative };
      setSvcDesc(merged as Partial<ServiceDescription>);
      onUpdate({ serviceDescription: merged });
      setQualityScore(result.qualityScore);
      setQualityChecks(result.qualityChecks);
      setShowQuality(true);
    } catch (e) {
      // Automatic step — degrade gracefully, no user-facing error.
      console.error('[generate-sow]', e);
    } finally {
      setGenerating(false);
    }
  }, [category, data, svcDesc, onUpdate]);

  // Auto-compose the service description the moment the conversation is complete
  // (all components captured). Runs once; no button required.
  const autoGeneratedRef = useRef(false);
  useEffect(() => {
    if (isComplete && !autoGeneratedRef.current) {
      autoGeneratedRef.current = true;
      generateServiceDescription();
    }
  }, [isComplete, generateServiceDescription]);

  const handleSowEdit = useCallback((key: string, value: string) => {
    const updated = { ...svcDesc, [key]: value };
    setSvcDesc(updated);
    onUpdate({ serviceDescription: updated });
  }, [svcDesc, onUpdate]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:h-[calc(100vh-16rem)] lg:max-h-[640px] lg:min-h-[420px]">
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

          {/* Complete banner + generated narrative */}
          {isComplete && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3">
                <CheckCircle className="size-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-800">Request details captured</p>
                  {summary && <p className="text-xs text-green-600 mt-0.5">{summary}</p>}
                  <p className="text-xs text-green-600 mt-1">Click <strong>Next</strong> to proceed to validation.</p>
                </div>
              </div>

              {/* Show generated narrative if available */}
              {svcDesc.narrative && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <FileText className="size-4 text-[#2D5F8A]" />
                      <p className="text-xs font-semibold text-gray-700">Generated Service Description</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => { navigator.clipboard.writeText(svcDesc.narrative ?? ''); toast.success('Copied to clipboard'); }}>
                      <Copy className="size-3" />Copy
                    </Button>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{svcDesc.narrative}</p>
                </div>
              )}
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

      {/* Right Sidebar (2/5) */}
      <div className="lg:col-span-2 space-y-4 lg:h-full lg:overflow-y-auto lg:pr-1">
        {/* Single service-description panel — the master capture. The request
            key facts and the SOW are one document, not separate tabs. */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
              {/* Unified progress (request key facts + SOW elements). The panel
                  title is the step heading ("Service description") above. */}
              <div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>{unifiedDone} of {unifiedTotal} captured</span>
                  <span>{unifiedPct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-[#2D5F8A] transition-all duration-500" style={{ width: `${unifiedPct}%` }} />
                </div>
              </div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Key facts</p>

              <div className="space-y-2">
                {FIELD_LABELS.map(({ key, label }) => {
                  const value = getFieldValue(key);
                  const filled = !!value;
                  return (
                    <div key={key} className="flex items-start gap-2">
                      {filled ? <CheckCircle className="size-3.5 text-green-500 mt-0.5 shrink-0" /> : <Circle className="size-3.5 text-gray-300 mt-0.5 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{label}</p>
                        <p className={cn('text-xs truncate', filled ? 'text-gray-900' : 'text-gray-300 italic')}>{filled ? value : 'Pending...'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {data.supplierId && (
                <div className="rounded-md bg-green-50 border border-green-100 px-2 py-1.5">
                  <p className="text-[9px] font-medium text-green-600 uppercase tracking-wider">Supplier Matched</p>
                  <p className="text-[11px] text-green-800">{data.supplier}</p>
                </div>
              )}
              {/* SERVICE DESCRIPTION — the master document, same panel as the facts above */}
              <div className="pt-3 border-t border-gray-100 space-y-3">
              {/* Header row — the service description builds automatically from
                  the conversation; there is no manual generate action. */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <FileText className="size-3.5 text-[#2D5F8A]" />
                  <h4 className="text-xs font-semibold text-gray-900">Service description components</h4>
                </div>
                <div className="flex items-center gap-1.5">
                  {generating && (
                    <span className="flex items-center gap-1 text-[10px] text-gray-400">
                      <Loader2 className="size-3 animate-spin" />
                      Composing…
                    </span>
                  )}
                  {svcDesc.narrative && (
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => { navigator.clipboard.writeText(svcDesc.narrative ?? ''); toast.success('Copied'); }}>
                      <Copy className="size-3" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Quality score badge */}
              {qualityScore !== null && (
                <div className="space-y-1">
                  <button
                    className="flex items-center gap-1.5 w-full"
                    onClick={() => setShowQuality((v) => !v)}
                  >
                    <ShieldCheck className={`size-3.5 shrink-0 ${qualityScore >= 80 ? 'text-green-600' : qualityScore >= 60 ? 'text-amber-500' : 'text-red-500'}`} />
                    <span className={`text-[10px] font-semibold ${qualityScore >= 80 ? 'text-green-700' : qualityScore >= 60 ? 'text-amber-700' : 'text-red-700'}`}>
                      SOW Quality: {qualityScore}/100
                    </span>
                    {qualityChecks.some((c) => !c.passed) && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-300 text-amber-700">
                        {qualityChecks.filter((c) => !c.passed).length} issue{qualityChecks.filter((c) => !c.passed).length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </button>
                  {showQuality && (
                    <div className="rounded-md border border-gray-100 bg-gray-50 p-2 space-y-0.5">
                      {qualityChecks.map((chk) => (
                        <div key={chk.section} className="flex items-start gap-1.5 text-[10px]">
                          {chk.passed
                            ? <CheckCircle className="size-3 text-green-500 shrink-0 mt-0.5" />
                            : <XCircle className="size-3 text-red-400 shrink-0 mt-0.5" />}
                          <span className={chk.passed ? 'text-gray-500' : 'text-red-600'}>
                            <span className="font-medium capitalize">{chk.section.replace(/([A-Z])/g, ' $1')}</span>
                            {!chk.passed && `: ${chk.issue}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SOW Sections — captured through the conversation, editable */}
              {SOW_SECTIONS.map(({ key, label }) => {
                const value = svcDesc[key as keyof ServiceDescription];
                return (
                  <div key={key}>
                    <div className="flex items-center gap-1.5">
                      {value ? <CheckCircle className="size-3 text-green-500 shrink-0" /> : <Circle className="size-3 text-gray-300 shrink-0" />}
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
                    </div>
                    {value ? (
                      <textarea
                        className="mt-0.5 w-full text-[11px] text-gray-700 leading-relaxed bg-transparent border border-transparent hover:border-gray-200 focus:border-[#2D5F8A] focus:bg-white focus:outline-none rounded px-1.5 py-1 resize-none transition-colors"
                        rows={Math.max(2, Math.ceil(value.length / 80))}
                        value={value}
                        onChange={(e) => handleSowEdit(key, e.target.value)}
                      />
                    ) : (
                      <p className="text-[11px] text-gray-300 italic mt-0.5 pl-[18px]">Pending — captured as you answer.</p>
                    )}
                  </div>
                );
              })}

              {/* Narrative Summary */}
              {svcDesc.narrative && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Narrative Summary</p>
                  <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
                    <p className="text-[11px] text-gray-700 leading-relaxed whitespace-pre-wrap">{svcDesc.narrative}</p>
                  </div>
                </div>
              )}

              {Object.keys(svcDesc).filter((k) => k !== 'narrative' && svcDesc[k as keyof ServiceDescription]).length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">Answer the assistant&apos;s questions — your service description builds automatically as the details come together.</p>
              )}
            </div>
          {isComplete && (
            <div className="rounded-md bg-green-50 border border-green-200 p-2 text-center mt-3">
              <CheckCircle className="size-4 text-green-600 mx-auto mb-0.5" />
              <p className="text-xs font-medium text-green-800">Ready for validation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
