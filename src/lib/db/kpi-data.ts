import { supabase } from '@/lib/supabase-client';
import type { KPIDataPoint } from '@/data/types';
import { mapDbToKpi } from './mappers';

const TABLE = 'kpi_data';

export async function listKpiData(): Promise<KPIDataPoint[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('month');
  if (error) throw error;
  return (data ?? []).map(mapDbToKpi);
}
