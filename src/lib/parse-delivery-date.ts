/**
 * Converts a free-text delivery timeline extracted by the AI intake
 * into a YYYY-MM-DD string suitable for the DATE column.
 *
 * Handles phrases like:
 *   "end of Q3"         → last day of Q3 relative to current year
 *   "end of August"     → 2026-08-31
 *   "by August"         → 2026-08-31
 *   "in 30 days"        → today + 30
 *   "6 weeks"           → today + 42
 *   "ASAP" / "urgent"   → today + 7
 *   "2026-09-30"        → pass-through
 *   unparseable         → null
 */

const QUARTER_END: Record<string, [number, number]> = {
  q1: [2, 31],  // March 31
  q2: [5, 30],  // June 30
  q3: [8, 30],  // September 30
  q4: [11, 31], // December 31
};

const MONTH_NAMES: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7,
  sep: 8, oct: 9, nov: 10, dec: 11,
};

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function lastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

export function parseDeliveryDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // A full stop after a word is punctuation, not part of the date: the reported
  // "end. of 2026" failed only because of it. Anchored on a preceding letter so
  // the separators in 31.12.2026 are untouched.
  const s = raw.trim().toLowerCase().replace(/([a-z])\.(?=\s|$)/g, '$1');
  const today = new Date();
  const year = today.getFullYear();

  // 1. Already a valid ISO date (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
    const d = new Date(raw.trim());
    if (!isNaN(d.getTime())) return raw.trim();
  }

  // 2. Day-first numeric dates: 31.12.2026, 31/12/2026, 31-12-2026, 31.12.26.
  //
  // These were not accepted at all, and the failure was worse than a rejection:
  // the conversation asks twice and then gives up on the field, so a requester
  // typing a perfectly good "31.12.2026" had the answer discarded and the
  // need-by date silently dropped from the request. Day-first because the rest
  // of the product is written for a European audience — an ambiguous 03.04.2026
  // is read as 3 April, and 13.04.2026 could only ever be day-first anyway.
  const numeric = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    const rawYear = Number(numeric[3]);
    const fullYear = rawYear < 100 ? 2000 + rawYear : rawYear;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const candidate = new Date(Date.UTC(fullYear, month - 1, day));
      // Rejects 31.02: the Date constructor rolls it into March rather than
      // failing, so the only way to tell is to read the parts back.
      if (candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day) {
        return toIso(candidate);
      }
    }
    return null;
  }

  // 3. A bare year, or the end of one: "2026", "end of 2026", "by end 2026".
  //    Resolves to 31 December, which is what "end of" means for a year.
  const yearOnly = s.match(/^(?:by\s+|before\s+)?(?:end\s+(?:of\s+)?)?(20\d{2})$/);
  if (yearOnly) return toIso(new Date(Date.UTC(Number(yearOnly[1]), 11, 31)));

  // 4. A bare quarter: "Q4", "Q4 2026". "end of Q4" is handled below and this
  //    does not shadow it, because that phrase does not match here.
  const bareQuarter = s.match(/^q([1-4])(?:\s+(20\d{2}))?$/);
  if (bareQuarter) {
    const [month, day] = QUARTER_END[`q${bareQuarter[1]}`];
    return toIso(new Date(bareQuarter[2] ? Number(bareQuarter[2]) : year, month, day));
  }

  // 5. ASAP / urgent / immediately
  if (/\b(asap|urgent|immediately|now)\b/.test(s)) {
    return toIso(new Date(today.getTime() + 7 * 86400_000));
  }

  // 6. End of Q1/Q2/Q3/Q4
  const quarterMatch = s.match(/end\s+of\s+(q[1-4])/);
  if (quarterMatch) {
    const [month, day] = QUARTER_END[quarterMatch[1]];
    return toIso(new Date(year, month, day));
  }

  // 7. "end of [Month]" or "by [Month]" or "in [Month]"
  const monthPhraseMatch = s.match(/(?:end\s+of|by|in|before)\s+([a-z]+)/);
  if (monthPhraseMatch) {
    const monthIdx = MONTH_NAMES[monthPhraseMatch[1]];
    if (monthIdx !== undefined) {
      // Use current year; if month already passed, use next year
      const targetYear = today.getMonth() > monthIdx ? year + 1 : year;
      return toIso(lastDayOfMonth(targetYear, monthIdx));
    }
  }

  // 5. "N days" / "N weeks" / "N months"
  const relativeMatch = s.match(/(\d+)\s*(day|week|month)/);
  if (relativeMatch) {
    const n = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2];
    let ms = 0;
    if (unit === 'day') ms = n * 86400_000;
    else if (unit === 'week') ms = n * 7 * 86400_000;
    else if (unit === 'month') ms = n * 30 * 86400_000;
    return toIso(new Date(today.getTime() + ms));
  }

  // 6. Month name alone (e.g., "August", "September 2026")
  for (const [name, idx] of Object.entries(MONTH_NAMES)) {
    if (s.includes(name)) {
      // Try to extract year from string
      const yearMatch = s.match(/\b(202\d)\b/);
      const targetYear = yearMatch ? parseInt(yearMatch[1]) : (today.getMonth() > idx ? year + 1 : year);
      return toIso(lastDayOfMonth(targetYear, idx));
    }
  }

  // 7. "next quarter" / "next month"
  if (s.includes('next month')) {
    const d = new Date(year, today.getMonth() + 2, 0); // last day of next month
    return toIso(d);
  }
  if (s.includes('next quarter')) {
    const currentQ = Math.floor(today.getMonth() / 3);
    const nextQ = (currentQ + 1) % 4;
    const [month, day] = Object.values(QUARTER_END)[nextQ];
    const targetYear = nextQ === 0 ? year + 1 : year;
    return toIso(new Date(targetYear, month, day));
  }

  // 8. Could not parse — return null (column will be omitted)
  return null;
}
