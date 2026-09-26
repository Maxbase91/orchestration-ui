import { useRef, useEffect } from 'react';
import { Sparkles, Send, User, CheckCircle, Circle, Loader2, AlertTriangle, FileText, Copy, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { parseDeliveryDate } from '@/lib/parse-delivery-date';
import type { ResidualQuestion } from '@/lib/procurement/residual-questions';
import type { MiniIrqAnswers, ServiceDescription } from './intake-form-data';
import { UrgencyChannelNote } from './components/urgency-channel-note';
import { SupplierFacts } from '@/components/shared/supplier-facts';

import {
  useServiceDescriptionConversation,
  type ConversationData,
} from './conversation/use-service-description-conversation';

interface StepChatIntakeProps {
  category: string;
  categoryDescription: string;
  data: ConversationData;
  onUpdate: (data: Record<string, unknown>) => void;
  /**
   * The criteria-driven risk questions this demand triggers, from the
   * determination. They are asked HERE, as the tail of the conversation, rather
   * than as a card of switches below it — a requester answering questions
   * should not have to notice that two of them live somewhere else.
   */
  riskQuestions?: readonly ResidualQuestion[];
  /** Answers so far. An absent key means the question has not been answered. */
  riskAnswers?: MiniIrqAnswers;
}


// Key facts captured during intake. Supplier is intentionally NOT here — it is
// selected later (during compliance / supplier identification), so showing it
// as "Pending" was misleading and dragged the progress down. When a supplier IS
// already known (e.g. named in the demand), the "Supplier Matched" chip below
// surfaces it.
const FIELD_LABELS: { key: string; label: string }[] = [
  { key: 'title', label: 'Description' },
  { key: 'category', label: 'Commodity Code' },
  { key: 'estimatedValue', label: 'Estimated Value' },
  { key: 'deliveryDate', label: 'Need-by date' },
];

// Stable identities for the optional props: an inline `= {}` default would be a
// new reference each render and destabilise every memo that depends on it.
const NO_RISK_ANSWERS: MiniIrqAnswers = {};

export function StepChatIntake({ category, categoryDescription: _categoryDescription, data, onUpdate, riskQuestions, riskAnswers = NO_RISK_ANSWERS }: StepChatIntakeProps) {
  // The engine is the hook's (conversation/use-service-description-conversation.ts);
  // this is its screen.
  const {
    messages, inputValue, setInputValue, isTyping, summary, error, svcDesc,
    generating, qualityScore, qualityChecks, showQuality, setShowQuality,
    unifiedTotal, unifiedDone, unifiedPct, isComplete,
    sections, getFieldValue, handleSend, awaitingChoice, acceptDraft,
    answerRiskQuestion, handleSowEdit,
  } = useServiceDescriptionConversation({ category, data, onUpdate, riskQuestions, riskAnswers });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll the chat to its newest message — and only the chat.
  //
  // scrollIntoView with no `block` scrolls every scrollable ancestor, the
  // window included, so each send jumped the whole page. `nearest` moves the
  // conversation's own scroller and leaves the page where the requester put it.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [messages, isTyping]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    // Two panes, but built from the wizard's own primitives. This step used to
    // render bespoke bordered divs with their own header bar and badge, which
    // is a large part of why it read as a different application bolted into the
    // middle of the journey. The layout is still two-up — a conversation beside
    // what it is producing is the right shape for the task — but the shell,
    // the card, the type scale and the AI treatment are now the ones the rest
    // of the product uses (design-document §7.3).
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
      {/* The conversation (3/5) */}
      <Card className="lg:col-span-3 flex flex-col overflow-hidden border-l-2 border-l-blue-400 bg-accent-soft/70 lg:h-[calc(100vh-16rem)] lg:max-h-[640px] lg:min-h-[420px]">
        {/* The AI visual language: blue-tinted surface, sparkle, and a label
            saying what is generating — the same treatment every AI surface in
            the product carries. */}
        <CardHeader className="shrink-0 border-b border-accent-line py-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <div className="flex size-6 items-center justify-center rounded-full bg-accent-soft">
              <Sparkles className="size-3.5 text-accent" />
            </div>
            Procurement assistant
            <span className="text-[11px] font-normal text-ink-3">AI-guided intake</span>
          </CardTitle>
        </CardHeader>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={cn('flex gap-2', msg.role === 'user' ? 'flex-row-reverse' : '')}>
              <div className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full',
                msg.role === 'user' ? 'bg-accent-solid' : 'bg-accent-soft'
              )}>
                {msg.role === 'user'
                  ? <User className="size-3.5 text-paper" />
                  : <Sparkles className="size-3.5 text-accent" />
                }
              </div>
              <div className={cn(
                'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                msg.role === 'user' ? 'bg-accent-solid text-paper' : 'bg-accent-soft text-ink'
              )}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {/* A worked example, shown as a hint UNDER the question and
                    visibly labelled. Appended to the sentence it read as an
                    answer — "What's the primary objective of this engagement?
                    run a promptathon to upskill 40 staff on AI tooling" — with
                    a topic belonging to somebody else's project. */}
                {msg.example && (
                  <p className="mt-1.5 text-[11px] text-ink-3">
                    <span className="font-medium uppercase tracking-wider text-ink-3">
                      Example
                    </span>{' '}
                    {msg.example}
                  </p>
                )}
                {/* A drafted answer the requester can adopt. Accepting records
                    it as assistant-drafted rather than as something they
                    wrote; "I'll write it" just returns them to the input. */}
                {msg.draft && (
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => acceptDraft(msg.draft!.slotId, msg.draft!.text)}
                    >
                      Use this
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px]"
                      onClick={() => inputRef.current?.focus()}
                    >
                      I&apos;ll write it
                    </Button>
                  </div>
                )}
                {/* A yes/no governance question. Two buttons, and the text
                    input is disabled while one is pending — an answer recorded
                    as evidence has to come from the requester pressing it, not
                    from a model reading their prose. The current answer stays
                    highlighted and is still changeable: it is an input, not a
                    submission. */}
                {msg.choice && (
                  <div className="mt-2 flex gap-2">
                    {([['Yes', true], ['No', false]] as const).map(([label, value]) => (
                      <Button
                        key={label}
                        size="sm"
                        variant={riskAnswers[msg.choice!.field] === value ? 'default' : 'outline'}
                        className="h-7 text-[11px]"
                        onClick={() => answerRiskQuestion(msg.choice!.field, value, label)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                )}
                {/* Present only on conditional questions — the ones that appear
                    for some demands and not others, and so read as arbitrary
                    without a reason. The mandatory six carry none. */}
                {msg.why && (
                  <p className="mt-1.5 border-t border-accent-line pt-1.5 text-[11px] italic text-ink-3">
                    Asked because {msg.why.replace(/^Asked because /i, '')}
                  </p>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft">
                <Sparkles className="size-3.5 text-accent" />
              </div>
              <div className="rounded-lg bg-accent-soft px-3 py-2">
                <div className="flex gap-1">
                  <span className="size-1.5 animate-bounce rounded-full bg-idle" style={{ animationDelay: '0ms' }} />
                  <span className="size-1.5 animate-bounce rounded-full bg-idle" style={{ animationDelay: '150ms' }} />
                  <span className="size-1.5 animate-bounce rounded-full bg-idle" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {/* Complete banner + generated narrative */}
          {isComplete && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg bg-ok-soft border border-ok-line p-3">
                <CheckCircle className="size-5 text-ok shrink-0" />
                <div>
                  <p className="text-sm font-medium text-ok">Request details captured</p>
                  {summary && <p className="text-xs text-ok mt-0.5">{summary}</p>}
                  <p className="text-xs text-ok mt-1">Click <strong>Next</strong> to proceed to validation.</p>
                </div>
              </div>

              {/* The narrative itself is NOT repeated here. It used to be
                  rendered twice from the same `svcDesc.narrative` — "Generated
                  Service Description" in this column and "Narrative Summary" in
                  the panel — the same text under two names. It lives in the
                  panel, beside the sections it is composed from. */}
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-warn-soft border border-warn-line p-3">
              <AlertTriangle className="size-4 text-warn shrink-0" />
              <p className="text-xs text-warn">Connection issue. Try sending your message again.</p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-accent-line bg-card/60 p-3 flex gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              awaitingChoice ? 'Choose Yes or No above'
                : isComplete ? 'Add more details or click Next...'
                  : 'Type your answer...'
            }
            disabled={isTyping || awaitingChoice}
            className="flex-1"
          />
          <Button size="sm" onClick={handleSend} disabled={isTyping || awaitingChoice || !inputValue.trim()}>
            {isTyping ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </Card>

      {/* What the conversation is producing (2/5) */}
      {/* Sticky, not scrollable. The panel had its own scroll region, so the
          requester had two things to scroll on one screen and the progress line
          could be off-screen while they answered. */}
      <div className="lg:col-span-2 space-y-4 lg:sticky lg:top-6">
        {/* Single service-description panel — the master capture. The request
            key facts and the SOW are one document, not separate tabs. */}
        <Card className="p-4 space-y-4">
              {/* Unified progress (request key facts + SOW elements). The panel
                  title is the step heading ("Service description") above. */}
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-ink-2">
                    Enough for the risk assessment and sourcing
                  </span>
                  <span className="text-ink-3">{unifiedDone} of {unifiedTotal}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-idle-soft">
                  <div className="h-full rounded-full bg-accent-solid transition-all duration-500" style={{ width: `${unifiedPct}%` }} />
                </div>
                <p className="mt-1.5 text-[11px] text-ink-3">
                  What you write here is reused across the process — it is what suppliers
                  price against and what the risk assessment reads.
                </p>
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">Key facts</p>

              <div className="space-y-2">
                {FIELD_LABELS.map(({ key, label }) => {
                  const value = getFieldValue(key);
                  const filled = !!value;
                  // The description and the value carried over from step 1 are
                  // EDITABLE here. They used to be rendered read-only, so the
                  // one-line demand the requester typed at step 1 became a fixed
                  // header they could not correct without going back — the
                  // sections beside them have always been editable.
                  const editable = key === 'title' || key === 'estimatedValue';
                  // The need-by date too: the conversation drops it after two
                  // unreadable answers, and submit requires it — read-only here,
                  // a skipped date could never be added and the request could
                  // never be submitted.
                  if (key === 'deliveryDate') {
                    const iso = parseDeliveryDate(data.deliveryDate);
                    return (
                      <div key={key} className="flex items-start gap-2">
                        {iso ? <CheckCircle className="size-3.5 text-ok mt-0.5 shrink-0" /> : <Circle className="size-3.5 text-ink-3 mt-0.5 shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <label htmlFor="key-facts-need-by" className="block text-[11px] font-medium uppercase tracking-wider text-ink-3">Need-by date</label>
                          <input
                            id="key-facts-need-by"
                            type="date"
                            className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-ink transition-colors hover:border-line focus:border-accent focus:bg-card focus:outline-none"
                            value={iso ?? ''}
                            onChange={(e) => onUpdate({ deliveryDate: e.target.value })}
                          />
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={key} className="flex items-start gap-2">
                      {filled ? <CheckCircle className="size-3.5 text-ok mt-0.5 shrink-0" /> : <Circle className="size-3.5 text-ink-3 mt-0.5 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-ink-3">{label}</p>
                        {editable ? (
                          <input
                            className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-ink transition-colors hover:border-line focus:border-accent focus:bg-card focus:outline-none"
                            value={key === 'estimatedValue' ? (data.estimatedValue || '') : data.title}
                            placeholder={key === 'estimatedValue' ? 'Estimated value' : 'Describe what you need'}
                            inputMode={key === 'estimatedValue' ? 'numeric' : undefined}
                            onChange={(e) => onUpdate(
                              key === 'estimatedValue'
                                ? { estimatedValue: Number(e.target.value.replace(/[^\d.]/g, '')) || 0 }
                                : { title: e.target.value },
                            )}
                          />
                        ) : (
                          <p className={cn('text-xs truncate', filled ? 'text-ink' : 'text-ink-3 italic')}>{filled ? value : 'Pending...'}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Always shown. It appeared only once a supplier was named, so on
                  most requests the supplier was invisible — and "currently
                  unknown" is exactly when the preferred suppliers matter. Not
                  counted in the progress: it is chosen later, not missing. */}
              <SupplierFacts supplierId={data.supplierId} supplierName={data.supplier} category={category} />
              {/* SERVICE DESCRIPTION — the master document, same panel as the facts above */}
              <div className="pt-3 border-t border-line-2 space-y-3">
              {/* Header row — the service description builds automatically from
                  the conversation; there is no manual generate action. */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <FileText className="size-3.5 text-accent" />
                  <h4 className="text-sm font-semibold text-ink">Service description</h4>
                </div>
                <div className="flex items-center gap-1.5">
                  {generating && (
                    <span className="flex items-center gap-1 text-[10px] text-ink-3">
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
                    <ShieldCheck className={`size-3.5 shrink-0 ${qualityScore >= 80 ? 'text-ok' : qualityScore >= 60 ? 'text-warn' : 'text-stop'}`} />
                    <span className={`text-[10px] font-semibold ${qualityScore >= 80 ? 'text-ok' : qualityScore >= 60 ? 'text-warn' : 'text-stop'}`}>
                      SOW Quality: {qualityScore}/100
                    </span>
                    {qualityChecks.some((c) => !c.passed) && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 border-warn-line text-warn">
                        {qualityChecks.filter((c) => !c.passed).length} issue{qualityChecks.filter((c) => !c.passed).length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </button>
                  {showQuality && (
                    <div className="rounded-md border border-line-2 bg-card-2 p-2 space-y-0.5">
                      {qualityChecks.map((chk) => (
                        <div key={chk.section} className="flex items-start gap-1.5 text-[10px]">
                          {chk.passed
                            ? <CheckCircle className="size-3 text-ok shrink-0 mt-0.5" />
                            : <XCircle className="size-3 text-stop shrink-0 mt-0.5" />}
                          <span className={chk.passed ? 'text-ink-3' : 'text-stop'}>
                            <span className="font-medium capitalize">{chk.section.replace(/([A-Z])/g, ' $1')}</span>
                            {!chk.passed && `: ${chk.issue}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Sections, from the resolved template. A section the template
                  marks `asked: false` is INFERRED — no slot ever asks for it,
                  the model writes it — so it is shown as such rather than as an
                  outstanding item the requester is waiting to be asked about. */}
              {sections.map(({ id, label, asked }) => {
                // Section values are strings; `captureFlags` is the one non-string
                // member of the type, and is never a section id.
                const raw = svcDesc[id as keyof ServiceDescription];
                const value = typeof raw === 'string' ? raw : '';
                const capture = svcDesc.captureFlags?.[id];
                return (
                  <div key={id}>
                    <div className="flex items-center gap-1.5">
                      {value
                        ? <CheckCircle className="size-3 shrink-0 text-ok" />
                        : <Circle className={cn('size-3 shrink-0', asked ? 'text-ink-3' : 'text-accent-line')} />}
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">{label}</p>
                      {!asked && (
                        <span className="text-[9px] uppercase tracking-wider text-accent-solid">inferred</span>
                      )}
                      {/* Provenance, so a reviewer can see which parts of the
                          description the requester did not really write. */}
                      {capture === 'assistant-drafted' && (
                        <span className="text-[9px] uppercase tracking-wider text-accent-solid">drafted for you</span>
                      )}
                      {capture === 'weak' && (
                        <span className="text-[9px] uppercase tracking-wider text-warn">needs detail</span>
                      )}
                    </div>
                    {value ? (
                      <textarea
                        className="mt-0.5 w-full text-[11px] text-ink-2 leading-relaxed bg-transparent border border-transparent hover:border-line focus:border-accent focus:bg-card focus:outline-none rounded px-1.5 py-1 resize-none transition-colors"
                        rows={Math.max(2, Math.ceil(value.length / 80))}
                        value={value}
                        onChange={(e) => handleSowEdit(id, e.target.value)}
                      />
                    ) : (
                      <p className="mt-0.5 pl-[18px] text-[11px] italic text-ink-3">
                        {asked ? 'Pending — captured as you answer.' : 'Written for you when the description is composed.'}
                      </p>
                    )}
                  </div>
                );
              })}

              {/* The service description. One surface, here, beside the sections
                  it composes. Present only when it has actually been written —
                  offline nothing composes it, and a join of the raw answers is
                  not a service description. */}
              {svcDesc.narrative && (
                <div className="mt-3 pt-3 border-t border-line-2">
                  <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-1">Service description</p>
                  <div className="rounded-md bg-card-2 border border-line p-3">
                    <p className="text-[11px] text-ink-2 leading-relaxed whitespace-pre-wrap">{svcDesc.narrative}</p>
                  </div>
                </div>
              )}

              {Object.keys(svcDesc).filter((k) => k !== 'narrative' && svcDesc[k as keyof ServiceDescription]).length === 0 && (
                <p className="text-xs text-ink-3 text-center py-4">Answer the assistant&apos;s questions — your service description builds automatically as the details come together.</p>
              )}
            </div>
          {/* Currency, urgency and cost centre are commercial facts, not part of
              the service description — so the conversation does not ask for
              them. They were only ever collected on step-details, which this
              path never renders, so on the chat path they were captured
              nowhere at all. Three controls, shown once the description is
              complete so they do not interrupt the conversation. */}
          {isComplete && (
            <div className="mt-3 space-y-3 rounded-md border border-line bg-card p-3">
              <p className="text-xs font-semibold text-ink-2">Commercial details</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px]">Currency</Label>
                  <Select value={data.currency} onValueChange={(v) => onUpdate({ currency: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* No cost-centre picker. Derived from the profile and shown
                    once in the requester-context block above — this panel held
                    the fourth copy of the same five invented cost centres. */}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Switch
                    id="chat-urgent"
                    checked={data.isUrgent}
                    onCheckedChange={(v) => onUpdate({ isUrgent: v })}
                  />
                  <Label htmlFor="chat-urgent" className="cursor-pointer text-xs">
                    Mark as urgent
                  </Label>
                </div>
                {/* The channel was shown on the pre-check and is settled except
                    for this. Say so, here, as it is ticked. */}
                <UrgencyChannelNote
                  category={category}
                  estimatedValue={data.estimatedValue}
                  supplierId={data.supplierId}
                  isUrgent={data.isUrgent}
                />
              </div>
            </div>
          )}

          {isComplete && (
            <div className="rounded-md bg-ok-soft border border-ok-line p-2 text-center mt-3">
              <CheckCircle className="size-4 text-ok mx-auto mb-0.5" />
              <p className="text-xs font-medium text-ok">Ready for validation</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
