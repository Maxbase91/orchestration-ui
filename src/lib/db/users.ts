import { supabase } from '@/lib/supabase-client';
import type { User } from '@/data/types';
import { mapDbToUser, mapUserToDb } from './mappers';

const TABLE = 'users';

export async function listUsers(): Promise<User[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('name');
  if (error) throw error;
  return (data ?? []).map(mapDbToUser);
}

export async function getUser(id: string): Promise<User | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapDbToUser(data) : null;
}

export async function createUser(record: User): Promise<User> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(mapUserToDb(record))
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToUser(data);
}

export async function updateUser(id: string, patch: Partial<User>): Promise<User> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(mapUserToDb(patch))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToUser(data);
}

export async function deleteUser(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
