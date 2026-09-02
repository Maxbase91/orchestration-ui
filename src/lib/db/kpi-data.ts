import { db } from '@/lib/db-client';
import type { KPIDataPoint } from '@/data/types';
import { mapDbToKpi } from './mappers';

const TABLE = 'kpi_data';

export async function listKpiData(): Promise<KPIDataPoint[]> {
  const { data, error } = await db.from(TABLE).select('*').order('month');
  if (error) throw error;
  return (data ?? []).map(mapDbToKpi);
}
