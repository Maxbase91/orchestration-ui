// When seed data is older than the current trailing window (demo / staging),
// anchor date computations to the data's most recent record instead of today.
// This prevents all "this month / last N months" widgets from showing zeros.

export function resolveDemoReference(
  records: Array<{ createdAt?: string; updatedAt?: string; endDate?: string }>,
  windowMonths = 6,
): Date {
  const now = new Date();
  if (records.length === 0) return now;

  const latestMs = Math.max(
    ...records.map((r) => {
      const candidate = r.updatedAt ?? r.createdAt ?? r.endDate;
      return candidate ? new Date(candidate).getTime() : 0;
    }),
  );
  if (!isFinite(latestMs) || latestMs === 0) return now;

  const latestDate = new Date(latestMs);
  const windowStart = new Date(now.getFullYear(), now.getMonth() - windowMonths, 1);
  return latestDate < windowStart ? latestDate : now;
}
