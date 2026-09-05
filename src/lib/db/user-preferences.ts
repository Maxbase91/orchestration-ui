// Browser-side user preferences. The read/merge lives in
// user-preferences-core.ts so the serverless handlers share one implementation
// rather than keeping a second copy of the same upsert.
import { db } from '@/lib/db-client';
import { mergePreferences, readPreferences, type UserPrefs } from './user-preferences-core';

export type { UserPrefs };

export async function getUserPreferences(userId: string): Promise<UserPrefs> {
  return readPreferences(db, userId);
}

export async function updateUserPreferences(
  userId: string,
  patch: Partial<UserPrefs>,
): Promise<UserPrefs> {
  return mergePreferences(db, userId, patch);
}
