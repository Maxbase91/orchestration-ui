import { supabase } from '@/lib/supabase-client';
import type { Invoice } from '@/data/types';
import { mapDbToInvoice, mapInvoiceToDb } from './mappers';

const TABLE = 'invoices';

export async function listInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('invoice_date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapDbToInvoice);
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapDbToInvoice(data) : null;
}

export async function createInvoice(record: Invoice): Promise<Invoice> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(mapInvoiceToDb(record))
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToInvoice(data);
}

export async function updateInvoice(id: string, patch: Partial<Invoice>): Promise<Invoice> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(mapInvoiceToDb(patch))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToInvoice(data);
}

export async function deleteInvoice(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
