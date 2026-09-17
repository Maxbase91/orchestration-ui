// CSV export — one implementation.
//
// There were two, in exports-page.tsx and report-builder-page.tsx, identical
// except for how each guarded the empty case, and the audit log was about to be
// a third. They also shared a defect: no byte-order mark, so Excel reads the
// file as the local single-byte encoding and every `€`, `ü` and `§` arrives
// mangled. In a euro-denominated store with names like "Anna Müller" that is
// most exports, and it is the kind of thing nobody reports as a bug — they
// retype the file.

/** RFC 4180: quote only when the value contains a delimiter, quote or newline. */
function cell(value: unknown): string {
  const v = String(value ?? '');
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/**
 * The CSV text for these rows, header row first.
 *
 * Columns come from the first row unless given explicitly. Pass `columns` when
 * the rows are heterogeneous or the order matters — reading them off row zero
 * silently drops any key the first row happens not to have.
 *
 * CRLF line endings, because that is what RFC 4180 specifies and what Excel
 * expects; a lone LF makes some versions treat the file as one long row.
 */
export function toCsv(
  rows: ReadonlyArray<Record<string, unknown>>,
  columns?: readonly string[],
): string {
  const headers = columns ?? Object.keys(rows[0] ?? {});
  if (headers.length === 0) return '';
  return [
    headers.map(cell).join(','),
    ...rows.map((row) => headers.map((h) => cell(row[h])).join(',')),
  ].join('\r\n');
}

/**
 * Offer the rows to the user as a download. No-op when there is nothing to save.
 *
 * The leading U+FEFF is the byte-order mark — it is what makes Excel read the
 * file as UTF-8. Without it the export opens with mojibake for every non-ASCII
 * character, which on this data means every currency amount.
 */
export function downloadCsv(
  filename: string,
  rows: ReadonlyArray<Record<string, unknown>>,
  columns?: readonly string[],
): void {
  const csv = toCsv(rows, columns);
  if (!csv) return;
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** `prefix-2026-09-17.csv` — a filename that sorts and does not collide. */
export function datedFilename(prefix: string, now: Date = new Date()): string {
  return `${prefix}-${now.toISOString().slice(0, 10)}.csv`;
}
