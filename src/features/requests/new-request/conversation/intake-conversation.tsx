// The conversation page (Intake Prototype, "Door 1 — the conversation"): one
// page for what used to be three steps — Describe, How you'll buy and Details.
// The conversation on the left, in three phases (What you need · How it is
// bought · What it needs); Your request on the right, filling in as it goes.
// It ends on "Buying channel confirmed", and the Channel page is where the
// request is submitted.
//
// Every turn is an engine that decided it before this page existed:
// classify-demand (what the words are), use-route-checks (the catalogue, the
// contracts, the channel), call-off-agenda (a call-off's details), and
// use-service-description-conversation (the service description, its
// challenges and drafts, and the risk questions as its tail). The page composes
// them in one transcript with one reply box, and owns only the order.
//
// The transcript is history: a turn that has been answered is written to a log
// and never re-rendered from live state, so a later check or edit cannot
// rewrite what the assistant already said.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Paperclip, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatDate } from '@/lib/format';
import type { BuyingChannel, Contract, IntakeAttachment, ProcurementProfile, Supplier } from '@/data/types';
import type { IntakeDetermination } from '@/lib/procurement/intake-determination';
import type { CatalogueItem } from '@/data/catalogue-items';
import { useCreateProspectiveSupplier, useSuppliers } from '@/lib/db/hooks/use-suppliers';
import { useAiAgent } from '@/lib/db/hooks/use-ai-agents';
import { useCommodityCodeBook, useProcurementCategories } from '@/lib/db/hooks/use-procurement-categories';
import { useCostCentres } from '@/lib/db/hooks/use-cost-centres';
import { useDeliveryLocations } from '@/lib/db/hooks/use-delivery-locations';
import { usePreferredSupplierIds } from '@/lib/db/hooks/use-category-preferred-suppliers';
import { useChannelCopy, useChannelStageMap } from '@/lib/db/hooks/use-channel-stage-map';
import { usePolicyConfig } from '@/lib/procurement/use-policy-config';
import { DEFAULT_CATEGORY_TAXONOMY } from '@/data/category-taxonomy';
import { buyingChannelLabel } from '@/lib/routing/evaluate-routing-rules';
import { getStagesForChannel } from '@/lib/workflow/channel-stages';
import { isProspective } from '@/lib/workflow/onboarding-stage';
import { isPreferredSupplierOverride } from '@/lib/procurement/supplier-preference';
import { rankSupplierSuggestions } from '@/lib/procurement/supplier-suggestions';
import { parseAmount } from '@/lib/procurement/policy-answers';
import { parseDeliveryDate } from '@/lib/parse-delivery-date';
import { determineNextQuestion, requiredSectionIds } from '@/lib/procurement/demand-conversation';
import { RESIDUAL_QUESTION_LABEL } from '@/lib/procurement/residual-questions';
import type { IntakeFormData, MiniIrqAnswers, SectionCapture } from '../intake-form-data';
import { intakeSubmissionGaps } from '../intake-submission-gaps';
import { SupplierAutocomplete } from '../components/supplier-autocomplete';
import { UrgencyChannelNote } from '../components/urgency-channel-note';
import { acceptClassification, classifyDemand, type ClassificationChoice, type DemandClassification } from './classify-demand';
import { enrichGuidance, useRouteChecks } from './use-route-checks';
import {
  applyCallOffAnswer, callOffQuestions, callOffRemaining, nextCallOffQuestion, prefillCallOff,
  type CallOffFieldId, type ContractCallOffDraft,
} from './call-off-agenda';
import { useServiceDescriptionConversation, type ChatMessage } from './use-service-description-conversation';
import { channelConfirmed as isChannelConfirmed, shortTitle } from './conversation-rules';
import { requestRows, type RequestRow, type RowEditor, type SectionState } from './request-rows';
import { YourRequestPanel, type EditValue } from './your-request-panel';
import { AssistantTurn, CardTurn, Choices, PhaseLabel, UserTurn, Working } from './turns';

interface IntakeConversationProps {
  /** The words from Home or the assistant (`?q=`), sent as the first message. */
  prefill?: string;
  formData: IntakeFormData;
  updateFormData: (updates: Partial<IntakeFormData>) => void;
  determination: IntakeDetermination | null;
  requester: { id: string; name: string };
  profileCostCentre: string;
  storedProfile: ProcurementProfile | null;
  callOffDraft: ContractCallOffDraft | null;
  setCallOffDraft: (draft: ContractCallOffDraft) => void;
  /** "See how it will be bought" — the Channel page. */
  onSeeChannel: () => void;
}

type Route = 'describing' | 'call-off' | 'new-request';
type Logged = { role: 'assistant' | 'user'; text: string };
/**
 * Phases 1 and 2 as they happened: what was said, where phase 2 began, and each
 * way to buy that was offered — kept as offered, so answering one (or a later
 * check) cannot make it vanish from the history.
 */
type Entry =
  | ({ kind: 'say' } & Logged)
  | { kind: 'phase'; label: string }
  /** `matched`: the words each item matched on — a suggestion the requester can check is one they can reject. */
  | { kind: 'catalogue'; items: Array<{ item: CatalogueItem; matched: string[] }>; alternative?: Contract }
  | { kind: 'contract'; contract: Contract; alternates: Contract[]; preliminary: boolean };
const PHASE_TWO = '2 · How it is bought';
type SupplierTurn = 'not-yet' | 'asked' | 'picking' | 'reason' | 'another' | 'answered';
/** The supplier question as it was put — kept, so a later change cannot reword it. */
interface SupplierCard {
  named?: { id: string; name: string; preferred: boolean };
  preferredNames: string[];
  categoryName: string;
  sources: boolean;
}

const NO_RISK_QUESTIONS: IntakeDetermination['residualQuestions'] = [];
/** More than this many transcript messages before the supplier turn, and the middle folds away. */
const FOLD_AFTER = 8;
/** Above this many configured rows, a choice is a list rather than a row of buttons. */
const MAX_CHOICE_BUTTONS = 6;

function list(names: string[]): string {
  return names.length <= 1 ? names[0] ?? '' : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function Log({ entries, prefix }: { entries: Logged[]; prefix: string }) {
  return (
    <>
      {entries.map((entry, index) => (entry.role === 'user'
        ? <UserTurn key={`${prefix}-${index}`}>{entry.text}</UserTurn>
        : <AssistantTurn key={`${prefix}-${index}`}>{entry.text}</AssistantTurn>))}
    </>
  );
}

/** A choice between many configured rows — a cost centre among dozens. */
function PickFromList({ label, options, onPick }: {
  label: string;
  options: Array<{ id: string; label: string }>;
  onPick: (id: string, label: string) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <div className="flex w-full max-w-md items-center gap-2">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 min-w-0 flex-1 rounded-md border border-input bg-card px-2 text-caption text-ink"
      >
        <option value="">Choose…</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
      <Button
        size="sm"
        className="h-8 text-caption"
        disabled={!value}
        onClick={() => onPick(value, options.find((option) => option.id === value)?.label ?? value)}
      >
        Use this
      </Button>
    </div>
  );
}

export function IntakeConversation(props: IntakeConversationProps) {
  const { formData, updateFormData, determination } = props;
  const navigate = useNavigate();
  const { data: suppliers = [] } = useSuppliers();
  const { data: classifierAgent } = useAiAgent('AI-001');
  const { data: recommenderAgent } = useAiAgent('AI-005');
  const { data: dbCategories = [] } = useProcurementCategories();
  const codeBook = useCommodityCodeBook();
  const { data: allCostCentres = [] } = useCostCentres();
  const { data: allLocations = [] } = useDeliveryLocations();
  const { data: stageMap } = useChannelStageMap();
  const channelCopy = useChannelCopy();
  const policy = usePolicyConfig();
  const createProspective = useCreateProspectiveSupplier();
  const costCentres = useMemo(() => allCostCentres.filter((c) => c.active), [allCostCentres]);
  const locations = useMemo(() => allLocations.filter((l) => l.active), [allLocations]);
  const categories = dbCategories.length > 0 ? dbCategories : DEFAULT_CATEGORY_TAXONOMY;
  const categoryLabel = (id: string) => categories.find((c) => c.id === id)?.label ?? id;
  const preferredSupplierIds = usePreferredSupplierIds(formData.category);
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? id;

  // ── 1 · What you need ────────────────────────────────────────────────────
  const [words, setWords] = useState('');
  /** A document read as the description — the turn shows its name, not five pages of text. */
  const [wordsFrom, setWordsFrom] = useState<string | null>(null);
  const [classification, setClassification] = useState<DemandClassification | null>(null);
  const [classifying, setClassifying] = useState(false);
  /** What the requester said to "Is that right?" — the category is confirmed once set. */
  const [confirmedAs, setConfirmedAs] = useState<string | null>(null);
  /** Check results, offers, the detail questions and their answers, in the order they happened. */
  const [log, setLog] = useState<Entry[]>([]);
  const addToLog = (...entries: Entry[]) => setLog((prev) => [...prev, ...entries]);

  const classify = async (text: string) => {
    setWords(text);
    setClassifying(true);
    try {
      setClassification(await classifyDemand(text, {
        aiEnabled: classifierAgent?.status === 'active', categories, suppliers, codeBook,
      }));
    } finally {
      setClassifying(false);
    }
  };
  const confirmClassification = (choice: ClassificationChoice, said: string) => {
    if (!classification) return;
    const updates = acceptClassification(classification, choice, words, { categoryLabel, suppliers });
    // A pasted brief or a document is not a title; its first sentence is.
    if (updates.title) updates.title = shortTitle(updates.title);
    updateFormData(updates);
    setConfirmedAs(said);
  };
  const describeAgain = () => {
    setClassification(null); setWords(''); setWordsFrom(null); setConfirmedAs(null);
  };

  // Home's words arrive as the first message, once.
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !props.prefill?.trim()) return;
    prefilled.current = true;
    void classify(props.prefill.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.prefill]);

  // ── 2 · How it is bought ─────────────────────────────────────────────────
  const [route, setRoute] = useState<Route>('describing');
  const [declined, setDeclined] = useState<{ catalogue?: boolean; contract?: boolean }>({});
  /** The phase-1 question being asked: the one detail that decides the contract, or more description. */
  const [asking, setAsking] = useState<'detail' | 'more' | null>(null);
  const checks = useRouteChecks(confirmedAs ? {
    title: formData.title, demandDetail: formData.demandDetail, category: formData.category,
    estimatedValue: formData.estimatedValue, supplierId: formData.supplierId, llmIntent: formData.llmIntent,
    isUrgent: formData.isUrgent, commodityCode: formData.commodityCode,
  } : null);
  const catalogueOffer = !declined.catalogue && checks.catalogueItems.length > 0 && checks.decision.route === 'catalogue';
  const contractOffer = !declined.contract && checks.contractMatches.length > 0 && !catalogueOffer;
  const contract = contractOffer ? checks.contractMatches[0].contract : undefined;
  const detailQuestion = checks.clarifyingQuestion ?? `Tell me ${enrichGuidance(formData.category)}.`;

  // Each check is written to the transcript once, when it settles for the words
  // it checked — a detail answered later adds a new line rather than rewriting
  // the first, which the question after it would then contradict.
  // A route the requester has already declined is not reported again.
  const checkSummary = !checks.settled ? null
    : checks.unavailable
      ? 'I could not reach the catalogue or the contract register, so neither was checked and nothing was ruled in or out.'
      : [
          ...(declined.catalogue ? [] : [`Checked the catalogue — ${checks.catalogueItems.length > 0
            ? (checks.catalogueItems.length === 1 ? 'one item matches.' : `${checks.catalogueItems.length} items match.`)
            : (checks.decision.ruledOut.catalogue ?? 'nothing for this.')}`]),
          ...(declined.contract ? [] : [`Checked contracts — ${checks.contractMatches.length === 0
            ? (checks.decision.ruledOut.contract ?? 'none covers this.')
            : checks.canCallOff ? `${checks.contractMatches[0].contract.title} covers this.` : 'one might cover this.'}`]),
        ].join('\n');
  const checkedFor = useRef<string | null>(null);
  const detailCheckedFor = useRef('');
  const checkKey = `${formData.title}\u0000${formData.demandDetail}`;
  useEffect(() => {
    if (!confirmedAs || route !== 'describing' || !checkSummary || checkedFor.current === checkKey) return;
    // A re-check says what prompted it: a detail answered here, or the title
    // edited on the right.
    const prefix = checkedFor.current === null ? ''
      : formData.demandDetail !== detailCheckedFor.current ? 'With that detail: ' : 'Checked again: ';
    checkedFor.current = checkKey;
    detailCheckedFor.current = formData.demandDetail;
    addToLog({ kind: 'say', role: 'assistant', text: prefix ? `${prefix}${checkSummary.charAt(0).toLowerCase()}${checkSummary.slice(1)}` : checkSummary });
    // `formData.demandDetail` is part of `checkKey`, which is a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmedAs, route, checkSummary, checkKey]);
  const checked = checkedFor.current === checkKey && Boolean(checkSummary);
  const decided = Boolean(confirmedAs) && checked && route === 'describing' && !asking;

  // A demand nothing covers becomes a new request without a button — there is
  // nothing to choose. Coverage one detail would settle asks for the detail.
  // Otherwise the way to buy is offered, once for the words it was checked for.
  const offeredFor = useRef<string | null>(null);
  useEffect(() => {
    if (!decided) return;
    if (checks.unavailable || (!catalogueOffer && !contractOffer)) {
      updateFormData({ preCheckOutcome: 'full-request' });
      setRoute('new-request');
      return;
    }
    if (contractOffer && !checks.canCallOff) { setAsking('detail'); return; }
    if (offeredFor.current === checkKey) return;
    offeredFor.current = checkKey;
    const offer: Entry = catalogueOffer
      ? {
          kind: 'catalogue', items: checks.decision.catalogueMatches.slice(0, 3).map(({ item, matched }) => ({ item, matched })),
          // A contract that covers it too is a real alternative, offered rather
          // than found by describing it again.
          alternative: checks.canCallOff ? checks.contractMatches[0]?.contract : undefined,
        }
      : {
          kind: 'contract', contract: checks.contractMatches[0].contract,
          // Only what the matcher itself is confident of: a weak candidate
          // offered as "call off X instead" reads as a recommendation.
          alternates: checks.contractMatches.slice(1, 3)
            .filter((m) => 'confidence' in m && m.confidence !== 'low').map((m) => m.contract),
          preliminary: checks.matchUnavailable,
        };
    setLog((prev) => [...prev, ...(prev.some((e) => e.kind === 'phase') ? [] : [{ kind: 'phase' as const, label: PHASE_TWO }]), offer]);
  }, [decided, checks.unavailable, catalogueOffer, contractOffer, checks.canCallOff, checks.decision.catalogueMatches, checks.contractMatches, checks.matchUnavailable, checkKey, updateFormData]);

  // ── 3 · What a call-off needs ────────────────────────────────────────────
  // The contract as it was called off — held, so a later check cannot change
  // which questions are asked.
  const [offContract, setOffContract] = useState<Contract | null>(null);
  const questions = useMemo(() => callOffQuestions(offContract?.category), [offContract?.category]);
  const [passed, setPassed] = useState<Set<CallOffFieldId>>(() => new Set());
  const [callOffLog, setCallOffLog] = useState<Logged[]>([]);
  const [callOffRetry, setCallOffRetry] = useState<{ text: string; overLimit?: boolean } | null>(null);
  const draft = props.callOffDraft;
  const nextCallOff = route === 'call-off' && draft ? nextCallOffQuestion(questions, draft, passed) : null;

  const callOff = (chosen: Contract, said: string) => {
    addToLog({ kind: 'say', role: 'user', text: said });
    setOffContract(chosen);
    updateFormData({
      preCheckOutcome: 'contract', contractId: chosen.id, contractTitle: chosen.title,
      supplier: chosen.supplierName, supplierId: chosen.supplierId, supplierProvenance: 'named',
      category: formData.category || chosen.category.toLowerCase(),
    });
    const prefilledDraft = prefillCallOff({
      title: formData.title, value: formData.estimatedValue, needBy: formData.deliveryDate,
      recipient: formData.beneficiaryName || undefined,
      costCentre: formData.costCentre || props.storedProfile?.costCentre,
      deliveryLocation: props.storedProfile?.defaultShipToLocationId,
    }, chosen.category);
    props.setCallOffDraft(prefilledDraft);
    const left = callOffRemaining(callOffQuestions(chosen.category), prefilledDraft).length;
    setCallOffLog([{
      role: 'assistant',
      text: `I've filled what I could from what you said and your profile — it's on the right, and you can change any of it there.${left > 0 ? ` ${left === 1 ? 'One thing' : `${left} things`} left.` : ''}`,
    }]);
    setRoute('call-off');
  };
  const raiseNewRequest = (said: string) => {
    setDeclined({ contract: true, catalogue: true });
    // A contract's supplier is the contract's, not the requester's — it does
    // not follow the demand into a new request.
    updateFormData({
      preCheckOutcome: 'full-request', contractId: '', contractTitle: '',
      ...(formData.contractId ? { supplier: '', supplierId: '', supplierProvenance: undefined } : {}),
    });
    if (route === 'call-off') setCallOffLog((prev) => [...prev, { role: 'user', text: said }]);
    else addToLog({ kind: 'say', role: 'user', text: said });
    setRoute('new-request');
  };

  const answerCallOff = (text: string) => {
    if (!draft || !nextCallOff) return;
    const result = applyCallOffAnswer(nextCallOff, text, draft, { directCallOffLimit: policy.directCallOffLimit });
    setCallOffLog((prev) => [...prev, { role: 'assistant', text: callOffRetry?.text ?? nextCallOff.prompt }, { role: 'user', text }]);
    if (!result.ok) { setCallOffRetry({ text: result.retry, overLimit: result.overLimit }); return; }
    setCallOffRetry(null);
    props.setCallOffDraft(result.draft);
    if (result.passed) setPassed((prev) => new Set(prev).add(result.passed!));
  };
  const chooseCallOff = (field: CallOffFieldId, id: string, label: string) => {
    if (!draft || !nextCallOff) return;
    setCallOffLog((prev) => [...prev, { role: 'assistant', text: nextCallOff.prompt }, { role: 'user', text: label }]);
    setCallOffRetry(null);
    props.setCallOffDraft({ ...draft, [field]: id });
  };

  // ── 3 · What a new request needs ─────────────────────────────────────────
  // The supplier is asked after the description and before the risk questions,
  // because the supplier decides them: a high-risk supplier adds the
  // critical-service question.
  const [supplierTurn, setSupplierTurn] = useState<SupplierTurn>('not-yet');
  const [supplierCard, setSupplierCard] = useState<SupplierCard | null>(null);
  /** Where the supplier turn sits among the service-description messages. */
  const [supplierAt, setSupplierAt] = useState<number | null>(null);
  const [supplierLog, setSupplierLog] = useState<Logged[]>([]);
  const riskQuestions = supplierTurn === 'answered' ? determination?.residualQuestions ?? NO_RISK_QUESTIONS : NO_RISK_QUESTIONS;
  const sd = useServiceDescriptionConversation({
    category: formData.category,
    data: {
      title: formData.title, supplier: formData.supplier, supplierId: formData.supplierId,
      estimatedValue: formData.estimatedValue, currency: formData.currency,
      // The detail added in phase 1 is context the conversation should not ask for again.
      businessJustification: [formData.businessJustification, formData.demandDetail].filter(Boolean).join(' ').trim(),
      deliveryDate: formData.deliveryDate, isUrgent: formData.isUrgent, costCentre: formData.costCentre,
      commodityCode: formData.commodityCode, commodityCodeLabel: formData.commodityCodeLabel,
      serviceDescription: formData.serviceDescription,
    },
    onUpdate: (updates) => updateFormData(updates as Partial<IntakeFormData>),
    riskQuestions,
    riskAnswers: formData.miniIrq as MiniIrqAnswers,
    enabled: route === 'new-request',
  });
  const channel = (determination?.buyingChannelSlug ?? checks.routing.channel) as BuyingChannel;
  const sources = getStagesForChannel(stageMap, channel).includes('sourcing');
  const preferredNames = preferredSupplierIds.map(supplierName);
  const categoryTags = categories.find((c) => c.id === formData.category)?.supplierTags ?? [];

  useEffect(() => {
    if (route !== 'new-request' || !sd.descriptionComplete || supplierTurn !== 'not-yet') return;
    const named = formData.supplierProvenance === 'named' && formData.supplierId
      ? { id: formData.supplierId, name: formData.supplier, preferred: preferredSupplierIds.includes(formData.supplierId) }
      : undefined;
    setSupplierCard({ named, preferredNames, categoryName: formData.categoryDescription || categoryLabel(formData.category), sources });
    setSupplierAt(sd.messages.length);
    setSupplierTurn('asked');
    // The card is a snapshot of the moment it is asked; nothing else re-runs this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, sd.descriptionComplete, supplierTurn]);
  // Once the supplier is settled, the risk questions it decides are asked.
  useEffect(() => {
    if (supplierTurn === 'answered') sd.askNext();
    // `askNext` changes identity with every answer; this follows the questions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierTurn, riskQuestions.length]);

  const say = (...entries: Logged[]) => setSupplierLog((prev) => [...prev, ...entries]);
  // On a sourcing channel, anyone else the requester knows is invited too.
  const askForAnother = () => {
    if (supplierCard?.sources) { say({ role: 'assistant', text: 'Anyone else you would like invited?' }); setSupplierTurn('another'); }
    else setSupplierTurn('answered');
  };
  // After the main supplier is settled: what a new supplier means, a reason if
  // it is off the preferred list, then anyone else.
  const afterPrimary = (supplier: { id: string; name: string }, record?: Supplier) => {
    // A supplier created a moment ago is not in the directory list yet, so the
    // record the picker returned is used when there is one.
    const full = record ?? suppliers.find((s) => s.id === supplier.id);
    if (full && isProspective(full)) {
      say({
        role: 'assistant',
        text: supplierCard?.sources
          ? `${supplier.name} is a new supplier — screening must clear before they can be invited to sourcing, and onboarding completes before contracting.`
          : `${supplier.name} is a new supplier — screening must clear and onboarding complete before contracting.`,
      });
    }
    if (isPreferredSupplierOverride(supplier.id, preferredSupplierIds)) {
      say({
        role: 'assistant',
        text: `${supplier.name} isn't preferred for this category, so the choice needs a reason${policy.preferredSupplierOverrideNeedsApproval ? ' — and the category manager approves it' : ''}. Why this supplier?`,
      });
      setSupplierTurn('reason');
      return;
    }
    askForAnother();
  };
  const goToMarket = () => {
    say({ role: 'user', text: supplierCard?.sources ? 'No — go to market.' : 'Not decided yet.' });
    updateFormData({ supplierIntent: 'to-be-sourced', supplier: '', supplierId: '', supplierCandidateIds: [], supplierProvenance: undefined });
    setSupplierTurn('answered');
  };
  const confirmNamed = () => {
    const named = supplierCard?.named;
    if (!named) return;
    say({ role: 'user', text: supplierCard.sources ? `Yes, invite ${named.name}.` : `Yes, ${named.name}.` });
    updateFormData({ supplierProvenance: 'chosen', supplierIntent: 'named' });
    afterPrimary(named);
  };
  const startPicking = (said: string) => { say({ role: 'user', text: said }); setSupplierTurn('picking'); };
  const pickSupplier = (supplier: Supplier) => {
    say({ role: 'user', text: supplier.name });
    if (supplierTurn === 'another') {
      updateFormData({ supplierCandidateIds: [...new Set([...formData.supplierCandidateIds, supplier.id])] });
      return;
    }
    updateFormData({
      supplier: supplier.name, supplierId: supplier.id, supplierProvenance: 'chosen', supplierIntent: 'named',
      supplierCandidateIds: formData.supplierCandidateIds.filter((id) => id !== supplier.id),
    });
    afterPrimary(supplier, supplier);
  };
  // AI-005's ranking, when it is switched on: a shortlist to pick from, not a decision.
  const suggestions = recommenderAgent?.status === 'active' && (supplierTurn === 'picking' || supplierTurn === 'another')
    ? rankSupplierSuggestions(suppliers, {
        tags: categoryTags,
        preferredIds: preferredSupplierIds,
        // On a sourcing channel the preferred suppliers are invited anyway.
        exclude: [formData.supplierId, ...formData.supplierCandidateIds, ...(supplierCard?.sources ? preferredSupplierIds : [])].filter(Boolean),
      })
    : [];

  // ── The one reply box ────────────────────────────────────────────────────
  const [reply, setReply] = useState('');
  const expecting: 'description' | 'detail' | 'call-off' | 'service-description' | 'reason' | null =
    !words && !classifying ? 'description'
      : asking && route === 'describing' ? 'detail'
        : route === 'call-off' && nextCallOff && nextCallOff.answer !== 'choice' ? 'call-off'
          : route === 'new-request' && supplierTurn === 'reason' ? 'reason'
            : route === 'new-request' && !sd.awaitingChoice && !sd.isTyping && !sd.isComplete
              && (supplierTurn === 'not-yet' || supplierTurn === 'answered') ? 'service-description'
              : null;
  const value = expecting === 'service-description' ? sd.inputValue : reply;
  const setValue = expecting === 'service-description' ? sd.setInputValue : setReply;
  // Whenever a typed answer is wanted, the cursor is already in the box — the
  // old "Add detail" button was dead precisely because it did not move it. Not
  // while the requester is editing a row on the right: that is theirs.
  const replyRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!expecting || document.activeElement?.closest('aside[aria-label="Your request"]')) return;
    replyRef.current?.focus({ preventScroll: true });
  }, [expecting]);
  const send = () => {
    const text = value.trim();
    if (!text || !expecting) return;
    if (expecting === 'service-description') { void sd.handleSend(); return; }
    setReply('');
    switch (expecting) {
      case 'description':
        void classify(text);
        return;
      case 'detail': {
        addToLog(
          { kind: 'say', role: 'assistant', text: asking === 'more' ? 'Tell me more about what you need.' : `One detail decides it: ${detailQuestion}` },
          { kind: 'say', role: 'user', text },
        );
        // The answer sharpens the match and is kept out of the title. A figure
        // in it is the value, when none was given.
        const amount = parseAmount(text);
        updateFormData({
          demandDetail: formData.demandDetail ? `${formData.demandDetail} ${text}` : text,
          ...(amount && !(formData.estimatedValue > 0) ? { estimatedValue: amount } : {}),
        });
        setAsking(null);
        return;
      }
      case 'call-off':
        answerCallOff(text);
        return;
      case 'reason':
        say({ role: 'user', text });
        updateFormData({ supplierOverrideReason: text });
        askForAnother();
        return;
    }
  };

  // A document before anything is said IS the description; after, it is attached.
  const [upload, setUpload] = useState<{ name: string; status: 'reading' | 'attached' | 'failed' } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const handleFile = async (file: File) => {
    if (!/application\/pdf|wordprocessingml\.document/.test(file.type) || file.size > 10 * 1024 * 1024) {
      setUpload({ name: file.name, status: 'failed' });
      return;
    }
    setUpload({ name: file.name, status: 'reading' });
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
      const response = await fetch('/api/intake-upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, contentType: file.type, dataBase64: btoa(binary) }),
      });
      const body = await response.json() as { attachment?: IntakeAttachment };
      if (!response.ok || !body.attachment) { setUpload({ name: file.name, status: 'failed' }); return; }
      updateFormData({ attachments: [...(formData.attachments ?? []), body.attachment] });
      setUpload({ name: file.name, status: 'attached' });
      if (!words && body.attachment.extractedText) {
        setWordsFrom(file.name);
        await classify(body.attachment.extractedText);
      }
    } catch {
      // The typed path stays available when extraction fails, and it says so.
      setUpload({ name: file.name, status: 'failed' });
    }
  };

  // ── Buying channel confirmed ─────────────────────────────────────────────
  const gaps = intakeSubmissionGaps(formData, preferredSupplierIds);
  const conversationDone = route === 'new-request' && sd.isComplete && supplierTurn === 'answered';
  const confirmed = isChannelConfirmed({
    route,
    conversationComplete: sd.isComplete,
    supplierSettled: supplierTurn === 'answered',
    gaps,
    hasDetermination: determination !== null,
    callOffComplete: Boolean(draft) && !nextCallOff,
  });

  // ── Your request ─────────────────────────────────────────────────────────
  const [edited, setEdited] = useState<Set<string>>(() => new Set());
  const channelLabel = determination?.buyingChannelResult ?? buyingChannelLabel(channel);
  const ruleSource = determination?.matchedRuleDescription || determination?.matchedRuleName || 'the value band';
  const channelRow = !checked && route === 'describing' ? null
    : route === 'call-off' ? { value: `Call-off · ${formData.contractTitle}`, source: confirmed ? 'Confirmed by you' : 'Accepted by you', settled: confirmed }
      : route === 'new-request' ? { value: `New request · ${channelLabel}`, source: `${confirmed ? 'Confirmed' : 'Routing'} · ${ruleSource}`, settled: confirmed }
        : catalogueOffer ? { value: 'Catalogue order — no request', source: 'Derived', settled: false }
          : contract && checks.canCallOff ? { value: `Call-off · ${contract.title}`, source: 'Proposed · you accept in the conversation', settled: false }
            // The checks are done and a question is open: say what it decides.
            : asking === 'detail' ? { value: 'Deciding — one detail settles which contract', source: 'Asked now', settled: false }
              : asking === 'more' ? { value: 'Deciding — the catalogue item was not it', source: 'Asked now', settled: false }
                : { value: 'Checking the catalogue and contracts', source: 'Derived', settled: false };

  // The sections this demand is asked about, or already has text for. The
  // hook's object changes identity every render, so this is computed, not memoised.
  const sectionText = (id: string) => String((sd.svcDesc as Record<string, unknown>)[id] ?? '');
  // One set with the Channel page: the sections this demand must cover.
  const requiredSections = new Set<string>(requiredSectionIds(sd.progressCtx, sd.slots, sd.sections));
  const askedSections = new Set<string>(sd.slots.filter((s) => s.target.kind === 'sow').map((s) => s.target.field));
  const askingNow = route === 'new-request' ? determineNextQuestion(sd.progressCtx, undefined, sd.slots)?.slot : undefined;
  const sections: SectionState[] = route !== 'new-request' ? [] : sd.sections
    .filter((section) => askedSections.has(section.id) || requiredSections.has(section.id) || sectionText(section.id).trim())
    .map((section) => ({
      id: section.id,
      label: section.label,
      required: requiredSections.has(section.id),
      text: sectionText(section.id),
      capture: (sd.svcDesc.captureFlags as Record<string, SectionCapture> | undefined)?.[section.id],
      asking: askingNow?.target.kind === 'sow' && askingNow.target.field === section.id,
    }));
  const rows = requestRows({
    route: route === 'describing' ? (catalogueOffer ? 'catalogue' : 'describing') : route,
    channel: channelRow,
    form: formData,
    requester: props.requester,
    profileCostCentre: props.profileCostCentre,
    costCentreLabel: (id) => allCostCentres.find((c) => c.id === id)?.label,
    deliveryLocationLabel: (id) => allLocations.find((l) => l.id === id)?.label,
    edited,
    leftOpen: sd.leftOpen,
    sections,
    supplierAnswered: supplierTurn === 'answered' || supplierTurn === 'another',
    sources,
    preferredSupplierNames: preferredNames,
    overrideOwed: isPreferredSupplierOverride(formData.supplierId, preferredSupplierIds),
    riskAnswers: supplierTurn === 'answered'
      ? riskQuestions.map((q) => ({ key: q.field, label: RESIDUAL_QUESTION_LABEL[q.id] ?? q.question, answer: (formData.miniIrq as MiniIrqAnswers)[q.field] }))
      : [],
    callOff: route === 'call-off' && draft && offContract
      ? { questions, draft, contractTitle: offContract.title, supplierName: offContract.supplierName }
      : undefined,
    catalogue: catalogueOffer ? {
      name: checks.catalogueItems[0].name,
      price: `${formatCurrency(checks.catalogueItems[0].unitPrice)} / ${checks.catalogueItems[0].unit}`,
      supplierName: checks.catalogueItems[0].supplierName,
    } : undefined,
  });
  const editorValue = (row: RequestRow): string => {
    if (row.key.startsWith('section:')) return sectionText(row.key.slice('section:'.length));
    if (row.key.startsWith('callOff:') && draft) {
      const raw = draft[row.key.slice('callOff:'.length) as CallOffFieldId];
      return typeof raw === 'number' ? (raw > 0 ? String(raw) : '') : raw;
    }
    switch (row.key) {
      case 'estimatedValue': return formData.estimatedValue > 0 ? String(formData.estimatedValue) : '';
      case 'deliveryDate': return parseDeliveryDate(formData.deliveryDate) ?? '';
      case 'costCentre': return route === 'call-off' ? draft?.costCentre ?? '' : formData.costCentre;
      case 'deliveryLocation': return draft?.deliveryLocation ?? '';
      case 'beneficiary': return formData.beneficiaryId;
      case 'supplier': return formData.supplier;
      case 'isUrgent': return formData.isUrgent ? 'yes' : 'no';
      default: return String((formData as unknown as Record<string, unknown>)[row.key] ?? '');
    }
  };
  const onEdit = (row: RequestRow, editor: RowEditor, change: EditValue) => {
    if (change.kind === 'user') {
      setEdited((prev) => new Set(prev).add(row.key));
      updateFormData({ beneficiaryId: change.id, beneficiaryName: change.name, beneficiaryCountry: change.country ?? '', beneficiaryCountryCode: change.countryCode ?? '' });
      return;
    }
    if (change.kind === 'supplier') {
      setEdited((prev) => new Set(prev).add(row.key));
      // While the supplier question is open, choosing in the panel answers it.
      if (supplierTurn === 'asked' || supplierTurn === 'picking') { pickSupplier(change.supplier); return; }
      updateFormData({ supplier: change.supplier.name, supplierId: change.supplier.id, supplierProvenance: 'chosen', supplierIntent: 'named' });
      return;
    }
    const text = change.kind === 'text' ? change.value : String(change.value);
    if (row.key.startsWith('callOff:') && draft) {
      const field = row.key.slice('callOff:'.length) as CallOffFieldId;
      const question = questions.find((q) => q.field === field);
      // The same rules as answering in the conversation — an edit cannot put a
      // value past the direct call-off limit, or an end before the start.
      const result = question ? applyCallOffAnswer(question, text, draft, { directCallOffLimit: policy.directCallOffLimit }) : null;
      if (result && !result.ok) {
        setCallOffLog((prev) => [...prev, { role: 'assistant', text: `I kept the ${question!.label.toLowerCase()} as it was: ${result.retry}` }]);
        return;
      }
      setEdited((prev) => new Set(prev).add(row.key));
      props.setCallOffDraft(result?.ok ? result.draft : { ...draft, [field]: text });
      return;
    }
    setEdited((prev) => new Set(prev).add(row.key));
    switch (editor.kind) {
      case 'section': sd.handleSowEdit(editor.section, text); return;
      case 'money': updateFormData({ estimatedValue: Number(text) || 0 }); return;
      case 'date': updateFormData({ deliveryDate: text }); return;
      case 'toggle': updateFormData({ isUrgent: text === 'yes' }); return;
      case 'cost-centre':
        if (route === 'call-off' && draft) props.setCallOffDraft({ ...draft, costCentre: text });
        else updateFormData({ costCentre: text });
        return;
      case 'delivery-location':
        if (draft) props.setCallOffDraft({ ...draft, deliveryLocation: text });
        return;
      case 'text': updateFormData({ [editor.field]: text } as Partial<IntakeFormData>); return;
      default: return;
    }
  };

  // ── The transcript ───────────────────────────────────────────────────────
  const stage = !confirmedAs ? 0 : route === 'describing' ? 1 : 2;
  const phaseText = confirmed ? 'channel confirmed'
    : !confirmedAs ? 'identifying what you need'
      : route === 'describing' ? (catalogueOffer ? 'found it in the catalogue' : 'checking the catalogue and contracts')
        : route === 'call-off' ? 'capturing the call-off' : 'writing the service description';
  const catalogueCopy = channelCopy('catalogue');
  const callOffCopy = channelCopy('framework-call-off');
  // Only a channel that means a new request speaks for one: routing can answer
  // catalogue or call-off, which are the two routes the requester just declined.
  const newRequestCopy = channel !== 'catalogue' && channel !== 'framework-call-off'
    ? channelCopy(channel)
    : { headline: 'Procurement collects the service description, finds suppliers and assesses the risk', detail: '' };
  const [showEarlier, setShowEarlier] = useState(false);
  const indexed = sd.messages.map((message, index) => ({ message, index }));
  const sdBefore = supplierAt === null ? indexed : indexed.slice(0, supplierAt);
  const sdAfter = supplierAt === null ? [] : indexed.slice(supplierAt);
  // Once the conversation has moved on to the supplier, the middle of the
  // description folds away — the answers are all on the right.
  const fold = supplierTurn !== 'not-yet' && !showEarlier && sdBefore.length > FOLD_AFTER;
  const foldedAnswers = fold ? sdBefore.slice(4, -2).filter(({ message }) => message.role === 'user').length : 0;

  const endRef = useRef<HTMLDivElement>(null);
  const transcriptLength = log.length + callOffLog.length + supplierLog.length + sd.messages.length;
  useEffect(() => {
    // The transcript's own scroller only — `nearest` leaves the page where it is.
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [transcriptLength, route, confirmedAs, classification, supplierTurn, confirmed, asking, nextCallOff?.field]);

  const candidate = classification?.commodityCandidates?.[0];
  const renderSd = (items: Array<{ message: ChatMessage; index: number }>) => items.map(({ message, index }) => (
    message.role === 'user'
      ? <UserTurn key={`sd-${index}`}>{message.content}</UserTurn>
      : (
        <div key={`sd-${index}`} className="flex flex-col gap-2 self-start">
          <AssistantTurn why={message.why} example={message.example}>{message.content}</AssistantTurn>
          {message.draft && index === sd.messages.length - 1 && (
            <Choices options={[{ label: 'Use this', primary: true, onClick: () => sd.acceptDraft(message.draft!.slotId, message.draft!.text) }]} />
          )}
          {message.choice && (
            <Choices
              disabled={(formData.miniIrq as MiniIrqAnswers)[message.choice.field] !== undefined}
              options={([['Yes', true], ['No', false]] as const).map(([label, answer]) => ({
                label,
                primary: (formData.miniIrq as MiniIrqAnswers)[message.choice!.field] === answer,
                onClick: () => sd.answerRiskQuestion(message.choice!.field, answer, label),
              }))}
            />
          )}
        </div>
      )
  ));

  const card = supplierCard;
  // A preferred supplier named in the words is invited anyway on a sourcing channel.
  const cardNamed = card?.named && !(card.sources && card.named.preferred) ? card.named : undefined;
  const cardQuestion = !card ? ''
    : card.sources
      ? (cardNamed ? `Should ${cardNamed.name} be invited as well?` : card.preferredNames.length > 0 ? 'Do you have another supplier in mind as well?' : 'Do you have a supplier in mind?')
      : (cardNamed ? `Will you buy from ${cardNamed.name}?` : 'Which supplier will you buy from?');
  const cardOptions = !card ? []
    : card.sources
      ? (cardNamed
          ? [
              { label: `Yes, invite ${cardNamed.name}`, primary: true, onClick: confirmNamed },
              { label: 'No — go to market', onClick: goToMarket },
              { label: 'A different supplier', onClick: () => startPicking('A different supplier.') },
            ]
          : [
              { label: 'No — go to market', onClick: goToMarket },
              { label: 'Yes, add a supplier', onClick: () => startPicking('Yes, add a supplier.') },
            ])
      : (cardNamed
          ? [
              { label: `Yes, ${cardNamed.name}`, primary: true, onClick: confirmNamed },
              { label: 'A different supplier', onClick: () => startPicking('A different supplier.') },
              { label: 'Not decided yet', onClick: goToMarket },
            ]
          : [
              { label: 'Choose a supplier', primary: true, onClick: () => startPicking('Choose a supplier.') },
              { label: 'Not decided yet', onClick: goToMarket },
            ]);
  const invitedLine = !card || !card.sources ? '' : card.preferredNames.length === 1 ? ' It is invited when sourcing starts.'
    : card.preferredNames.length === 2 ? ' Both are invited when sourcing starts.' : ' They are all invited when sourcing starts.';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-heading font-semibold text-ink">New request</h1>
        <ol aria-label="Progress" className="flex flex-wrap gap-x-2 text-caption">
          {['1 · What you need', '2 · How it is bought', '3 · What it needs'].map((label, index) => (
            <li
              key={label}
              aria-current={index === stage ? 'step' : undefined}
              className={index === stage ? 'font-semibold text-ink' : index < stage ? 'text-ink-2' : 'text-ink-3'}
            >
              {label}
            </li>
          ))}
        </ol>
      </div>

      {/* The page fills the window and each column scrolls inside it, as the
          artboard draws it. 14rem is the header above it plus the clearance the
          floating assistant button keeps (main's bottom padding) — so neither
          column's last line can sit under that button. */}
      <div className="grid overflow-hidden rounded-xl border border-line bg-card shadow-[var(--shadow)] lg:h-[calc(100vh-14rem)] lg:min-h-[480px] lg:grid-cols-[minmax(0,1fr)_420px]">
        <section aria-label="Conversation" className="flex min-h-[560px] min-w-0 flex-col lg:min-h-0">
          <div className="flex items-center gap-2 border-b border-line-2 bg-card-2 px-5 py-2.5">
            <Sparkles className="size-4 text-accent" aria-hidden="true" />
            <span className="text-body font-semibold text-ink">Procurement assistant</span>
            <span className="text-caption text-ink-3">{phaseText}</span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4" aria-live="polite">
            <PhaseLabel>1 · What you need</PhaseLabel>
            {!words && !classifying && (
              <AssistantTurn>
                What do you need? Say it in your own words, or attach a brief — I&apos;ll check the catalogue and existing contracts first, then ask only what is still missing.
              </AssistantTurn>
            )}
            {words && (
              <UserTurn>
                {wordsFrom
                  ? <><span className="font-medium">Attached {wordsFrom}</span>{'\n'}{words.length > 180 ? `${words.slice(0, 180).trimEnd()}…` : words}</>
                  : words}
              </UserTurn>
            )}
            {classifying && <Working>Reading it…</Working>}
            {classification && !classifying && (
              <div className="flex flex-col gap-2 self-start">
                {/* Which layer read it is a fact worth stating: a confidence
                    figure would be invented — the model returns none. */}
                <AssistantTurn note={classification.source === 'llm' ? 'Read by the category classifier.' : 'Matched on the configured category keywords.'}>
                  That sounds like <b>{categoryLabel(classification.category).toLowerCase()}</b>
                  {candidate && <> — <span className="font-mono text-caption text-ink-2">{candidate.code}</span> {candidate.label}</>}. Is that right?
                </AssistantTurn>
                <Choices
                  disabled={Boolean(confirmedAs)}
                  options={[
                    { label: 'Yes', primary: true, onClick: () => confirmClassification(candidate ? { kind: 'candidate', code: candidate.code } : { kind: 'none' }, 'Yes.') },
                    ...(classification.commodityCandidates ?? []).slice(1, 3).map((c) => ({
                      label: `It's ${c.label}`, onClick: () => confirmClassification({ kind: 'candidate', code: c.code }, `It's ${c.label}.`),
                    })),
                    ...(candidate ? [{ label: 'None of these codes', onClick: () => confirmClassification({ kind: 'none' }, 'None of those codes.') }] : []),
                    { label: 'No — let me describe it again', onClick: describeAgain },
                  ]}
                />
              </div>
            )}
            {confirmedAs && <UserTurn>{confirmedAs}</UserTurn>}
            {log.map((entry, index) => {
              // Only the latest offer can still be answered; an earlier one reads as it happened.
              const open = index === log.length - 1 && route === 'describing' && !asking;
              switch (entry.kind) {
                case 'say':
                  return entry.role === 'user'
                    ? <UserTurn key={`log-${index}`}>{entry.text}</UserTurn>
                    : <AssistantTurn key={`log-${index}`}>{entry.text}</AssistantTurn>;
                case 'phase':
                  return <PhaseLabel key={`log-${index}`}>{entry.label}</PhaseLabel>;
                // Each offer is headed in its channel's own words — the claiming
                // template's, set in the Workflow Designer — as the new-request
                // turn is; only the finding and the policy note are the page's.
                case 'catalogue':
                  return (
                    <CardTurn key={`log-${index}`} tone="accent">
                      <p className="text-eyebrow font-semibold uppercase tracking-[0.08em] text-accent">{catalogueCopy.headline}</p>
                      <p>
                        <b>This is in the catalogue — no request needed.</b>{catalogueCopy.detail ? ` ${catalogueCopy.detail}` : ''}
                      </p>
                      <ul className="flex flex-col gap-1.5">
                        {entry.items.map(({ item, matched }) => (
                          <li key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-line bg-card px-3 py-2">
                            <span className="min-w-0">
                              <span className="block truncate text-body font-medium text-ink">{item.name}</span>
                              <span className="block truncate text-caption text-ink-3">
                                {item.catalogueName} · {item.leadTime} · {formatCurrency(item.unitPrice)} / {item.unit}
                                {matched.length > 0 && <> · matched on {matched.map((word) => `“${word}”`).join(', ')}</>}
                              </span>
                            </span>
                            {/* A way out to the Catalogue page, not an answer — so it stays usable. */}
                            <Button size="sm" className="h-8 shrink-0" onClick={() => navigate(`/catalogue?add=${encodeURIComponent(item.id)}`)}>
                              Order it <ArrowRight className="size-3.5" aria-hidden="true" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                      <p className="text-caption text-ink-3">
                        Ordered on the Catalogue page: up to {formatCurrency(policy.catalogueAutoApprovalThreshold)} it becomes a purchase order straight away, and above that it is approved first.
                      </p>
                      <Choices disabled={!open} options={[
                        {
                          label: 'Not what you need? Keep describing',
                          onClick: () => {
                            setDeclined((prev) => ({ ...prev, catalogue: true }));
                            addToLog({ kind: 'say', role: 'user', text: 'Not what I need.' });
                            setAsking('more');
                          },
                        },
                        ...(entry.alternative
                          ? [{ label: `Call off ${entry.alternative.title} instead`, onClick: () => callOff(entry.alternative!, `Call off ${entry.alternative!.title} instead.`) }]
                          : []),
                      ]} />
                    </CardTurn>
                  );
                case 'contract':
                  return (
                    <CardTurn key={`log-${index}`} tone="accent">
                      <p className="text-eyebrow font-semibold uppercase tracking-[0.08em] text-accent">{callOffCopy.headline}</p>
                      <p><b>{entry.contract.title} covers this.</b>{callOffCopy.detail ? ` ${callOffCopy.detail}` : ''}</p>
                      <p className="text-caption text-ink-3">
                        {entry.contract.supplierName} · in force until {formatDate(entry.contract.endDate)}
                        {entry.contract.value > 0 && <> · {formatCurrency(Math.max(0, entry.contract.value * (1 - entry.contract.utilisationPercentage / 100)))} of {formatCurrency(entry.contract.value)} ceiling left</>}
                        {' '}· a direct call-off up to {formatCurrency(policy.directCallOffLimit)}
                      </p>
                      {entry.preliminary && (
                        <p className="text-caption text-ink-3">The contract matcher could not be reached, so this is a preliminary match — the checkout confirms coverage before anything is placed.</p>
                      )}
                      <Choices disabled={!open} options={[
                        { label: 'Call it off', primary: true, onClick: () => callOff(entry.contract, 'Call it off.') },
                        ...entry.alternates.map((other) => ({
                          label: `Call off ${other.title} instead`, onClick: () => callOff(other, `Call off ${other.title} instead.`),
                        })),
                        { label: 'Not this — raise a new request', onClick: () => raiseNewRequest('Not this — raise a new request.') },
                      ]} />
                    </CardTurn>
                  );
              }
            })}
            {confirmedAs && route === 'describing' && !checked && (
              <Working>{log.length > 0 ? 'Checking again…' : 'Checking the catalogue and contracts…'}</Working>
            )}
            {asking === 'detail' && route === 'describing' && <AssistantTurn>One detail decides it: {detailQuestion}</AssistantTurn>}
            {asking === 'more' && route === 'describing' && <AssistantTurn>Tell me more about what you need.</AssistantTurn>}

            {callOffLog.length > 0 && (
              <>
                <PhaseLabel>3 · What the call-off needs</PhaseLabel>
                <Log entries={callOffLog} prefix="co" />
                {nextCallOff && (
                  <div className="flex flex-col gap-2 self-start">
                    <AssistantTurn>{callOffRetry?.text ?? nextCallOff.prompt}</AssistantTurn>
                    {nextCallOff.answer === 'choice' && (() => {
                      const options = (nextCallOff.field === 'costCentre' ? costCentres : locations).map((row) => ({
                        id: row.id, label: nextCallOff.field === 'costCentre' ? `${row.id} · ${row.label}` : row.label,
                      }));
                      return options.length > MAX_CHOICE_BUTTONS
                        ? <PickFromList label={nextCallOff.label} options={options} onPick={(id, label) => chooseCallOff(nextCallOff.field, id, label)} />
                        : <Choices options={options.map((option) => ({ label: option.label, onClick: () => chooseCallOff(nextCallOff.field, option.id, option.label) }))} />;
                    })()}
                    {!nextCallOff.required && (
                      <Choices options={[{ label: 'Not known yet', onClick: () => answerCallOff('not known yet') }]} />
                    )}
                    {callOffRetry?.overLimit && (
                      <Choices options={[{ label: 'Raise a new request instead', onClick: () => raiseNewRequest('Raise it as a new request instead.') }]} />
                    )}
                  </div>
                )}
              </>
            )}

            {route === 'new-request' && !log.some((entry) => entry.kind === 'phase') && <PhaseLabel>{PHASE_TWO}</PhaseLabel>}
            {route === 'new-request' && (
              <AssistantTurn>
                <b>Then this is a new request.</b> {newRequestCopy.headline}
                {newRequestCopy.detail ? ` — ${newRequestCopy.detail.charAt(0).toLowerCase()}${newRequestCopy.detail.slice(1)}` : '.'}
                {'\n'}I&apos;ll ask what the service description needs and write it as we go — it builds on the right.
              </AssistantTurn>
            )}
            {route === 'new-request' && (
              <>
                <PhaseLabel>3 · What the new request needs</PhaseLabel>
                {fold ? (
                  <>
                    {renderSd(sdBefore.slice(0, 4))}
                    <button
                      type="button"
                      onClick={() => setShowEarlier(true)}
                      className="self-center rounded-full border border-dashed border-line bg-card-2 px-3.5 py-1 text-caption text-ink-2 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Show {foldedAnswers} earlier {foldedAnswers === 1 ? 'answer' : 'answers'}
                    </button>
                    {renderSd(sdBefore.slice(-2))}
                  </>
                ) : renderSd(sdBefore)}
                {sd.isTyping && supplierTurn === 'not-yet' && <Working>Thinking…</Working>}
                {card && (
                  <>
                    <CardTurn>
                      <p className="text-eyebrow font-semibold uppercase tracking-[0.08em] text-ink-3">
                        {card.preferredNames.length > 0 ? 'Preferred supplier' : 'Supplier'}
                      </p>
                      <p>
                        {cardNamed && <>You mentioned <b>{cardNamed.name}</b>. </>}
                        {card.preferredNames.length > 0 && (
                          <>
                            {card.categoryName} has {card.preferredNames.length === 1 ? 'one preferred supplier' : `${card.preferredNames.length} preferred suppliers`} —{' '}
                            <b>{list(card.preferredNames)}</b>.{invitedLine}{' '}
                          </>
                        )}
                        {cardQuestion}
                      </p>
                      <Choices disabled={supplierTurn !== 'asked'} options={cardOptions} />
                      {card.preferredNames.length > 0 && (
                        <p className="text-caption text-ink-3">
                          A supplier that isn&apos;t preferred for this category needs a reason{policy.preferredSupplierOverrideNeedsApproval ? ', and adds the category manager to the approvals' : ''}.
                        </p>
                      )}
                    </CardTurn>
                    <Log entries={supplierLog} prefix="sup" />
                    {(supplierTurn === 'picking' || supplierTurn === 'another') && (
                      <div className="flex w-full max-w-md flex-col gap-2 self-start" data-turn="supplier-picker">
                        {suggestions.length > 0 && (
                          <>
                            <p className="text-caption text-ink-3">Suggested by category fit, performance and risk</p>
                            <Choices options={suggestions.map(({ supplier }) => ({ label: supplier.name, onClick: () => pickSupplier(supplier) }))} />
                          </>
                        )}
                        <SupplierAutocomplete
                          value=""
                          supplierId=""
                          onSelect={pickSupplier}
                          // A vendor the directory does not hold is created as a
                          // prospective supplier — which is what makes onboarding expressible.
                          onCreateProspective={async (name) => pickSupplier(await createProspective.mutateAsync({ name }))}
                        />
                        {supplierTurn === 'another' && (
                          <Choices options={[{ label: "No, that's all", onClick: () => { say({ role: 'user', text: "No, that's all." }); setSupplierTurn('answered'); } }]} />
                        )}
                      </div>
                    )}
                    {renderSd(sdAfter)}
                    {sd.isTyping && supplierTurn !== 'not-yet' && <Working>Thinking…</Working>}
                  </>
                )}
                {conversationDone && gaps.length > 0 && (
                  <AssistantTurn>
                    Before the channel can be confirmed, the request needs {list(gaps.map((gap) => gap.label))} — add {gaps.length === 1 ? 'it' : 'them'} on the right.
                  </AssistantTurn>
                )}
              </>
            )}

            {confirmed && (
              <CardTurn tone="ok">
                <p className="text-eyebrow font-semibold uppercase tracking-[0.08em] text-ok">Buying channel confirmed</p>
                <p className="text-body font-semibold text-ink">
                  {/* The label as routing names it: lower-casing it mangles "Direct PO". */}
                  {route === 'call-off' ? `Call-off — ${formData.contractTitle}` : `New request — ${channelLabel}`}
                </p>
                <p className="text-caption text-ink-2">
                  {route === 'call-off'
                    ? 'Everything the call-off needs is captured. Next, see how it will be bought, step by step — you submit from there.'
                    : 'Everything this channel needs is captured, and the service description is written. Next, see how it will be bought, step by step — you submit from there.'}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm" onClick={props.onSeeChannel}>See how it will be bought <ArrowRight className="size-3.5" aria-hidden="true" /></Button>
                  <span className="text-caption text-ink-3">Nothing is submitted yet.</span>
                </div>
              </CardTurn>
            )}
            <div ref={endRef} />
          </div>

          <form className="flex flex-col gap-1.5 border-t border-line bg-card-2 px-4 py-3" onSubmit={(e) => { e.preventDefault(); send(); }}>
            {upload && (
              <p className={upload.status === 'failed' ? 'text-caption text-stop' : 'text-caption text-ink-3'} role="status">
                {upload.status === 'reading' ? `Reading ${upload.name}…`
                  : upload.status === 'attached' ? `Attached ${upload.name}.`
                    : `Could not read ${upload.name} — attach a PDF or Word document under 10 MB, or say what you need in your own words.`}
              </p>
            )}
            <div className="flex items-center gap-2">
              <label htmlFor="intake-reply" className="sr-only">Your answer</label>
              <Input
                id="intake-reply"
                ref={replyRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={!expecting}
                placeholder={
                  expecting === 'description' ? 'e.g. Business consulting for a finance transformation programme'
                    : expecting === 'detail' ? 'e.g. The finance team, from January, about €180k'
                      : expecting === 'reason' ? 'Why this supplier?'
                        : expecting ? 'Type your answer…'
                          : confirmed ? 'Anything to change? Edit it on the right.'
                            : 'Answer with the buttons above.'
                }
                className="h-10 flex-1 bg-card"
              />
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleFile(file); e.target.value = ''; }}
              />
              <Button type="button" variant="ghost" size="sm" className="h-10" onClick={() => fileInput.current?.click()} disabled={upload?.status === 'reading'}>
                <Paperclip className="size-4" aria-hidden="true" /> Attach a document
              </Button>
              <Button type="submit" size="sm" className="h-10" disabled={!expecting || !value.trim()}>
                <Send className="size-4" aria-hidden="true" /> Send
              </Button>
            </div>
          </form>
        </section>

        <YourRequestPanel
          groups={rows.groups}
          known={rows.known}
          required={rows.required}
          summary={route === 'new-request' ? sd.svcDesc.narrative ?? null : null}
          quality={route === 'new-request' && sd.qualityScore !== null ? { score: sd.qualityScore, checks: sd.qualityChecks } : null}
          editorValue={editorValue}
          costCentres={costCentres}
          deliveryLocations={locations}
          requesterId={props.requester.id}
          supplierId={formData.supplierId}
          urgencyNote={formData.category ? (
            <UrgencyChannelNote category={formData.category} estimatedValue={formData.estimatedValue} supplierId={formData.supplierId || undefined} isUrgent={formData.isUrgent} />
          ) : undefined}
          onEdit={onEdit}
        />
      </div>
    </div>
  );
}
