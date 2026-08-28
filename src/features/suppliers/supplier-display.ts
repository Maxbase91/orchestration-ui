// Presentation lookups shared across the supplier surfaces.
//
// These lived in `components/supplier-card.tsx` and were re-exported from it,
// which made that module export both a component and plain data — Fast Refresh
// then cannot hot-update the card, and four other screens imported their
// colours from a component file. Data belongs beside the other data.

/** Flag emoji by ISO 3166-1 alpha-2 code. Absent code renders no flag. */
export const countryFlags: Record<string, string> = {
  DE: '\u{1F1E9}\u{1F1EA}',
  GB: '\u{1F1EC}\u{1F1E7}',
  US: '\u{1F1FA}\u{1F1F8}',
  IN: '\u{1F1EE}\u{1F1F3}',
  NL: '\u{1F1F3}\u{1F1F1}',
  FR: '\u{1F1EB}\u{1F1F7}',
  IE: '\u{1F1EE}\u{1F1EA}',
  JP: '\u{1F1EF}\u{1F1F5}',
  CH: '\u{1F1E8}\u{1F1ED}',
};

/** Badge classes by risk rating. Keep in step with the RiskRating union. */
export const riskColors: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
  critical: 'bg-red-200 text-red-900',
};
