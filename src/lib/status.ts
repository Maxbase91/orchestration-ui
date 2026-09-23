// Status/priority display helpers: badge colours, human labels and priority
// icons, driven by shared lookup tables so every screen renders them the same.
import { statusColorMap, TONE_CLASS, type StatusKey } from '@/config/theme';

export function getStatusColor(status: string): string {
  const key = status.toLowerCase() as StatusKey;
  // An unmapped status is shown as neutral rather than guessed at.
  return statusColorMap[key] ?? TONE_CLASS.idle;
}

// Domain acronyms that must stay upper-case when a status/label is title-cased
// word-by-word (e.g. "po-created" → "PO Created", not "Po Created").
const ACRONYMS: Record<string, string> = {
  'po': 'PO',
  'gr': 'GR',
  'rfp': 'RFP',
  'rfq': 'RFQ',
  'rfi': 'RFI',
  'sra': 'SRA',
  'kpi': 'KPI',
};

export function getStatusLabel(status: string): string {
  return status
    .toLowerCase()
    .split('-')
    .map((word) => ACRONYMS[word] ?? (word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}
