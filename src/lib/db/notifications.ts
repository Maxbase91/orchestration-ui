import { supabase } from '@/lib/supabase-client';
import type { Notification } from '@/data/types';
import { mapDbToNotification, mapNotificationToDb } from './mappers';

const TABLE = 'notifications';

export async function listNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('timestamp', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapDbToNotification);
}

export async function markNotificationRead(id: string, isRead = true): Promise<Notification> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ is_read: isRead })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToNotification(data);
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ is_read: true }).eq('is_read', false);
  if (error) throw error;
}

export async function createNotification(record: Notification): Promise<Notification> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(mapNotificationToDb(record))
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToNotification(data);
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
