// The next free id in a prefixed sequence (FORM-007, AI-008, RR-014, c5).
//
// One past the highest number in use — never the count. Every admin list saves
// by upserting on id, so an id that is already taken does not fail: it
// silently replaces that record. `length + 1` is taken as soon as anything has
// been deleted (four forms FORM-002…006 made the next "new" form FORM-006, and
// its edits went to the live one), which is how it was found; routing rules and
// the knowledge base had each fixed it in a copy of their own.
//
// Pure, relative imports only.

/**
 * The next id after the highest `<prefix><number>` in `existingIds`, padded to
 * `width` digits. Ids that do not follow the pattern are ignored rather than
 * breaking the sequence.
 */
export function nextSequentialId(prefix: string, existingIds: readonly string[], width = 3): string {
  const pattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`);
  const highest = existingIds.reduce((max, id) => {
    const n = Number(pattern.exec(id)?.[1] ?? 0);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(width, '0')}`;
}
