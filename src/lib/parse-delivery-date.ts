/**
 * Converts a free-text delivery timeline extracted by the AI intake
 * into a YYYY-MM-DD string suitable for the Supabase DATE column.
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
  const s = raw.trim().toLowerCase();
  const today = new Date();
  const year = today.getFullYear();

  // 1. Already a valid ISO date (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
    const d = new Date(raw.trim());
    if (!isNaN(d.getTime())) return raw.trim();
  }

  // 2. ASAP / urgent / immediately
  if (/\b(asap|urgent|immediately|now)\b/.test(s)) {
    return toIso(new Date(today.getTime() + 7 * 86400_000));
  }

  // 3. End of Q1/Q2/Q3/Q4
  const quarterMatch = s.match(/end\s+of\s+(q[1-4])/);
  if (quarterMatch) {
    const [month, day] = QUARTER_END[quarterMatch[1]];
    return toIso(new Date(year, month, day));
  }

  // 4. "end of [Month]" or "by [Month]" or "in [Month]"
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
