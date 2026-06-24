import type { SupplierPayment } from '@/data/types';
import { SUPPLIER_PAYMENTS } from '@/data/supplier-payments';

// Vendor-data foundation. Backed by the own-store seed today; this module is the
// single seam to migrate to a Supabase `supplier_payments` table (or a live AP /
// banking source) later — the connector and consumers don't change.

export async function listPayments(): Promise<SupplierPayment[]> {
  return SUPPLIER_PAYMENTS;
}

export async function getPayment(id: string): Promise<SupplierPayment | null> {
  return SUPPLIER_PAYMENTS.find((p) => p.id === id) ?? null;
}
