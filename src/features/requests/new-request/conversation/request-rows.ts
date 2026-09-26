// "Your request" — every value the request carries while it is being described,
// grouped as the Intake Prototype draws them (Channel · Who and where · What ·
// Supplier · Service description, or The call-off), each with:
//
//   - where it came from: from you / derived / drafted — check it / still to come;
//   - whether the requester edits it in place. Inputs only (decided 2026-09-26):
//     what they told us — the title, the value, dates, who and where, the
//     supplier, the service description — is edited in place and the
//     conversation reads the edit from then on. What the platform decides — the
//     channel, the category's code, a contract's supplier, a catalogue price —
//     has no editor: it changes through the conversation (re-confirm the
//     category, "Not this — raise a new request"), so routing stays governed;
//   - whether it counts toward "N of M known". M is what the route needs before
//     the Channel page (decided 2026-09-26): a new request's key facts, supplier
//     decision, risk answers and required service-description sections; a
//     call-off's details. So it reaches M of M exactly when "Buying channel
//     confirmed" can appear.
//
// Pure, with relative imports, so a node test drives it.
import { formatCurrency, formatDate } from '../../../../lib/format.js';
import type { IntakeFormData, SectionCapture } from '../intake-form-data.js';
import type { CallOffQuestion, ContractCallOffDraft } from './call-off-agenda.js';

export type Provenance = 'known' | 'derived' | 'draft' | 'pending';

export type RowEditor =
  | { kind: 'text'; field: 'title' | 'recipient' | 'purpose' | 'supplierOverrideReason' }
  | { kind: 'money'; field: 'estimatedValue' | 'value' }
  | { kind: 'date'; field: 'deliveryDate' | 'needBy' | 'serviceEndDate' }
  | { kind: 'cost-centre' }
  | { kind: 'delivery-location' }
  | { kind: 'beneficiary' }
  | { kind: 'supplier' }
  | { kind: 'section'; section: string };

export interface RequestRow {
  key: string;
  label: string;
  /** One line; the full text is in the editor and the tooltip. */
  value: string;
  provenance: Provenance;
  /** Where it came from, in words: "From your words", "Your profile", "Routing · …". */
  source: string;
  /** Counts toward M. */
  required: boolean;
  /** Counts toward N — required and in. */
  known: boolean;
  /** Absent for what the platform decides. */
  edit?: RowEditor;
}

export interface RequestGroup {
  title: string;
  rows: RequestRow[];
}

/** Where the demand is heading. */
export type IntakeRoute = 'describing' | 'catalogue' | 'call-off' | 'new-request';

export interface SectionState {
  id: string;
  label: string;
  /** Mandatory for this demand (the engine's `requiredSlots`). */
  required: boolean;
  text: string;
  capture?: SectionCapture;
  /** The question the conversation is asking right now. */
  asking?: boolean;
}

export interface RequestRowsInput {
  route: IntakeRoute;
  /** The channel as decided so far; null until the checks have run. */
  channel: { value: string; source: string; settled: boolean } | null;
  form: IntakeFormData;
  requester: { name: string };
  /** The profile's cost centre, to tell "Your profile" from a choice. */
  profileCostCentre: string;
  costCentreLabel: (id: string) => string | undefined;
  deliveryLocationLabel: (id: string) => string | undefined;
  /** Rows the requester has edited in the panel. */
  edited: ReadonlySet<string>;
  /** Fields the conversation gave up asking for ("not known yet"). */
  leftOpen: ReadonlySet<string>;
  /** A new request's service-description sections, in template order. */
  sections?: SectionState[];
  /** The supplier question has been answered (named, chosen, or go to market). */
  supplierAnswered?: boolean;
  /** The channel runs a sourcing event, so the preferred suppliers are invited. */
  sources?: boolean;
  preferredSupplierNames?: string[];
  /** A supplier outside the category's preferred list, which owes a reason. */
  overrideOwed?: boolean;
  /** Risk questions asked so far, with their answers. */
  riskAnswers?: Array<{ key: string; label: string; answer: boolean | undefined }>;
  /** A call-off's questions, draft and contract. */
  callOff?: { questions: CallOffQuestion[]; draft: ContractCallOffDraft; contractTitle: string; supplierName: string };
  /** A catalogue match being offered. */
  catalogue?: { name: string; price: string; supplierName: string };
}

const pending = (source: string): Pick<RequestRow, 'provenance' | 'source'> => ({ provenance: 'pending', source });

function from(input: RequestRowsInput, key: string, own: string): string {
  return input.edited.has(key) ? 'Edited by you' : own;
}

function whoAndWhere(input: RequestRowsInput): RequestGroup {
  const { form } = input;
  const forSomeoneElse = Boolean(form.beneficiaryId) && Boolean(form.beneficiaryName);
  const centreId = input.route === 'call-off' ? input.callOff?.draft.costCentre ?? '' : form.costCentre;
  const centre = centreId ? `${centreId}${input.costCentreLabel(centreId) ? ` · ${input.costCentreLabel(centreId)}` : ''}` : '';
  const rows: RequestRow[] = [
    {
      key: 'requesterCountry', label: 'Requesting from', value: form.requesterCountry || 'Not on your profile',
      ...(form.requesterCountry ? { provenance: 'known' as const, source: 'Your profile' } : pending('Your profile has no country')),
      required: false, known: Boolean(form.requesterCountry),
    },
    {
      key: 'beneficiary', label: 'Buying for', value: forSomeoneElse ? form.beneficiaryName : `${input.requester.name} (you)`,
      provenance: 'known', source: forSomeoneElse ? from(input, 'beneficiary', 'Chosen by you') : 'Default',
      required: false, known: true, edit: { kind: 'beneficiary' },
    },
    {
      key: 'costCentre', label: 'Charged to', value: centre || 'Not yet known',
      ...(centre
        ? { provenance: 'known' as const, source: from(input, 'costCentre', centreId === input.profileCostCentre ? 'Your profile' : 'Chosen by you') }
        : pending('Needed before you submit')),
      required: input.route !== 'catalogue', known: Boolean(centre), edit: { kind: 'cost-centre' },
    },
  ];
  if (input.route === 'call-off' && input.callOff) {
    const where = input.callOff.draft.deliveryLocation;
    rows.push({
      key: 'deliveryLocation', label: 'Deliver to', value: where ? input.deliveryLocationLabel(where) ?? where : 'Not yet known',
      ...(where ? { provenance: 'known' as const, source: from(input, 'deliveryLocation', 'Your profile') } : pending('Asked later')),
      required: true, known: Boolean(where), edit: { kind: 'delivery-location' },
    });
  }
  return { title: 'Who and where', rows };
}

function what(input: RequestRowsInput): RequestGroup {
  const { form } = input;
  if (input.route === 'catalogue' && input.catalogue) {
    return {
      title: 'What',
      rows: [
        { key: 'item', label: 'Item', value: input.catalogue.name, provenance: 'derived', source: 'Catalogue', required: false, known: true },
        { key: 'price', label: 'Price', value: input.catalogue.price, provenance: 'derived', source: 'Catalogue', required: false, known: true },
      ],
    };
  }
  const category = form.commodityCodeLabel
    ? `${form.categoryDescription || form.category} · ${form.commodityCode}`
    : form.categoryDescription || form.category;
  const valueLeftOpen = input.leftOpen.has('value') && !(form.estimatedValue > 0);
  const dateLeftOpen = input.leftOpen.has('deliveryDate') && !form.deliveryDate;
  const rows: RequestRow[] = [
    {
      key: 'title', label: 'Title', value: form.title || 'Not yet known',
      ...(form.title ? { provenance: 'known' as const, source: from(input, 'title', 'From your words') } : pending('From your first message')),
      required: true, known: Boolean(form.title), edit: { kind: 'text', field: 'title' },
    },
    {
      // The category is the platform's reading of the words: confirmed in the
      // conversation, never typed over.
      key: 'category', label: 'Category', value: category || 'Not yet known',
      ...(form.commodityClassificationConfirmed ? { provenance: 'known' as const, source: 'Confirmed by you' } : pending('Asked next')),
      required: true, known: Boolean(form.commodityClassificationConfirmed),
    },
    {
      key: 'estimatedValue', label: 'Value', value: form.estimatedValue > 0 ? formatCurrency(form.estimatedValue) : valueLeftOpen ? 'Left open' : 'Not yet known',
      ...(form.estimatedValue > 0
        ? { provenance: 'known' as const, source: from(input, 'estimatedValue', 'From your words') }
        : pending(valueLeftOpen ? 'Add it once you know it' : 'Asked later')),
      // A budget the requester does not know yet is not a gap: the conversation
      // moves on, and routing reads what there is.
      required: !valueLeftOpen, known: form.estimatedValue > 0, edit: { kind: 'money', field: 'estimatedValue' },
    },
    {
      key: 'deliveryDate', label: 'Need by', value: form.deliveryDate ? formatDate(form.deliveryDate) : 'Not yet known',
      ...(form.deliveryDate
        ? { provenance: 'known' as const, source: from(input, 'deliveryDate', 'From your words') }
        // Unlike the budget, submit needs the date (submission-requirements.ts),
        // so a date the conversation gave up on is still asked for — here.
        : pending(dateLeftOpen ? 'Needed before you submit — add it here' : 'Asked later')),
      required: input.route !== 'catalogue', known: Boolean(form.deliveryDate), edit: { kind: 'date', field: 'deliveryDate' },
    },
  ];
  for (const risk of input.riskAnswers ?? []) {
    rows.push({
      key: `risk:${risk.key}`, label: risk.label,
      value: risk.answer === undefined ? 'Not yet answered' : risk.answer ? 'Yes' : 'No',
      ...(risk.answer === undefined ? pending('Asked now') : { provenance: 'known' as const, source: 'Risk question' }),
      // Answered with Yes or No in the conversation — evidence, so never typed.
      required: true, known: risk.answer !== undefined,
    });
  }
  return { title: 'What', rows };
}

function supplier(input: RequestRowsInput): RequestGroup {
  const { form } = input;
  if (input.route === 'call-off' && input.callOff) {
    return {
      title: 'Supplier',
      rows: [{ key: 'supplier', label: 'Supplier', value: input.callOff.supplierName, provenance: 'derived', source: 'From the contract', required: false, known: true }],
    };
  }
  if (input.route === 'catalogue' && input.catalogue) {
    return {
      title: 'Supplier',
      rows: [{ key: 'supplier', label: 'Supplier', value: input.catalogue.supplierName, provenance: 'derived', source: 'From the catalogue item', required: false, known: true }],
    };
  }
  const named = Boolean(form.supplier);
  const rows: RequestRow[] = [{
    key: 'supplier', label: 'Supplier',
    value: named ? form.supplier : input.sources ? 'Currently unknown — sourcing selects one' : 'Currently unknown',
    ...(named
      ? { provenance: 'known' as const, source: from(input, 'supplier', form.supplierProvenance === 'named' ? 'Named in your words' : 'Chosen by you') }
      : pending(input.supplierAnswered ? (input.sources ? 'Awarded at sourcing' : 'You choose one') : 'Asked later')),
    required: input.route === 'new-request',
    known: named || Boolean(input.supplierAnswered),
    edit: { kind: 'supplier' },
  }];
  if ((input.preferredSupplierNames ?? []).length > 0) {
    rows.push({
      key: 'preferred', label: 'Preferred for category', value: input.preferredSupplierNames!.join(', '),
      provenance: 'derived', source: input.sources ? 'Invited to sourcing · set in Categories' : 'Set in Categories',
      required: false, known: true,
    });
  }
  if (input.overrideOwed) {
    rows.push({
      key: 'supplierOverrideReason', label: 'Why this supplier', value: form.supplierOverrideReason || 'Not yet given',
      ...(form.supplierOverrideReason ? { provenance: 'known' as const, source: 'Your reason' } : pending('Needed for a supplier outside the preferred list')),
      required: true, known: Boolean(form.supplierOverrideReason), edit: { kind: 'text', field: 'supplierOverrideReason' },
    });
  }
  return { title: 'Supplier', rows };
}

function serviceDescription(sections: SectionState[]): RequestGroup {
  const required = sections.filter((s) => s.required);
  const done = required.filter((s) => s.text.trim()).length;
  return {
    title: `Service description · required ${done} of ${required.length}`,
    rows: sections.map((s) => {
      const text = s.text.trim();
      const drafted = s.capture === 'assistant-drafted';
      return {
        key: `section:${s.id}`, label: s.label, value: text || (s.asking ? 'Asking now' : s.required ? 'Not yet asked' : 'Optional'),
        ...(text
          ? { provenance: (drafted ? 'draft' : 'known') as Provenance, source: drafted ? 'Drafted by the assistant — check it' : s.capture === 'reviewer-edited' ? 'Edited by you' : 'Your answer' }
          : pending(s.required ? 'Required' : 'Optional')),
        required: s.required, known: Boolean(text),
        edit: { kind: 'section' as const, section: s.id },
      };
    }),
  };
}

function callOffGroup(input: RequestRowsInput): RequestGroup {
  const callOff = input.callOff!;
  const rows: RequestRow[] = [
    { key: 'contract', label: 'Contract', value: callOff.contractTitle, provenance: 'derived', source: 'The contract check', required: false, known: true },
  ];
  for (const q of callOff.questions) {
    // Where and what it is charged to sit under Who and where.
    if (q.field === 'deliveryLocation' || q.field === 'costCentre') continue;
    const raw = callOff.draft[q.field];
    const has = typeof raw === 'number' ? raw > 0 : Boolean(raw);
    const shown = !has ? 'Not yet known' : q.answer === 'money' ? formatCurrency(raw as number) : q.answer === 'date' ? formatDate(String(raw)) : String(raw);
    const editor: RowEditor | undefined = q.answer === 'money' ? { kind: 'money', field: 'value' }
      : q.answer === 'date' && (q.field === 'needBy' || q.field === 'serviceEndDate') ? { kind: 'date', field: q.field }
        : q.field === 'title' || q.field === 'recipient' || q.field === 'purpose' ? { kind: 'text', field: q.field === 'title' ? 'title' : q.field } : undefined;
    rows.push({
      key: `callOff:${q.field}`, label: q.label, value: shown,
      ...(has ? { provenance: 'known' as const, source: from(input, `callOff:${q.field}`, 'From you') } : pending(q.required ? 'Asked now' : 'Optional')),
      required: q.required, known: has, edit: editor,
    });
  }
  return { title: 'The call-off', rows };
}

/** The panel, and its "N of M known". */
export function requestRows(input: RequestRowsInput): { groups: RequestGroup[]; known: number; required: number } {
  const channel: RequestRow = {
    key: 'channel', label: 'Channel',
    value: input.channel?.value ?? 'Deciding — the catalogue and contracts are checked first',
    ...(input.channel
      ? { provenance: (input.channel.settled ? 'known' : 'derived') as Provenance, source: input.channel.source }
      : pending('Derived')),
    required: true, known: Boolean(input.channel?.settled),
  };
  const groups: RequestGroup[] = [
    { title: 'Channel', rows: [channel] },
    whoAndWhere(input),
    ...(input.route === 'call-off' && input.callOff ? [callOffGroup(input)] : [what(input)]),
    supplier(input),
    ...(input.route === 'new-request' && input.sections?.length ? [serviceDescription(input.sections)] : []),
  ];
  const rows = groups.flatMap((g) => g.rows);
  return {
    groups,
    known: rows.filter((r) => r.required && r.known).length,
    required: rows.filter((r) => r.required).length,
  };
}
