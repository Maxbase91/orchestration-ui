import type { SupplierPayment } from './types';

// Vendor-data foundation: representative supplier payment / banking master
// records. Not wired into an R1 flow — this is the own-store data the `payment`
// connector stands up so a live AP / banking source can swap in later. The IBAN
// / BIC values are illustrative test data, and are sensitive fields that must be
// masked when surfaced.
export const SUPPLIER_PAYMENTS: SupplierPayment[] = [
  {
    id: 'PAY-001', supplierId: 'SUP-001', supplierName: 'Accenture',
    bankName: 'Barclays', accountHolder: 'Accenture plc',
    iban: 'GB29NWBK60161331926819', bic: 'BARCGB22', currency: 'GBP',
    paymentTerms: 'Net 45', preferredMethod: 'bank-transfer',
    verificationStatus: 'verified', verifiedAt: '2026-01-12',
  },
  {
    id: 'PAY-002', supplierId: 'SUP-002', supplierName: 'SAP SE',
    bankName: 'Commerzbank', accountHolder: 'SAP SE',
    iban: 'DE89370400440532013000', bic: 'COBADEFF', currency: 'EUR',
    paymentTerms: 'Net 30', preferredMethod: 'bank-transfer',
    verificationStatus: 'verified', verifiedAt: '2025-11-03',
  },
  {
    id: 'PAY-003', supplierId: 'SUP-003', supplierName: 'Deloitte',
    bankName: 'HSBC', accountHolder: 'Deloitte LLP',
    iban: 'GB94BARC10201530093459', bic: 'HBUKGB4B', currency: 'GBP',
    paymentTerms: 'Net 45', preferredMethod: 'bank-transfer',
    verificationStatus: 'verified', verifiedAt: '2026-02-20',
  },
  {
    id: 'PAY-004', supplierId: 'SUP-004', supplierName: 'KPMG',
    bankName: 'NatWest', accountHolder: 'KPMG LLP',
    iban: 'GB33BUKB20201555555555', bic: 'NWBKGB2L', currency: 'GBP',
    paymentTerms: 'Net 30', preferredMethod: 'bank-transfer',
    verificationStatus: 'pending',
  },
  {
    id: 'PAY-005', supplierId: 'SUP-005', supplierName: 'Capgemini',
    bankName: 'BNP Paribas', accountHolder: 'Capgemini SE',
    iban: 'FR1420041010050500013M02606', bic: 'BNPAFRPP', currency: 'EUR',
    paymentTerms: 'Net 60', preferredMethod: 'bank-transfer',
    verificationStatus: 'verified', verifiedAt: '2025-09-30',
  },
  {
    id: 'PAY-006', supplierId: 'SUP-006', supplierName: 'Amazon Web Services (AWS)',
    bankName: 'JPMorgan Chase', accountHolder: 'Amazon Web Services, Inc.',
    iban: 'US64SVBKUS6S3300958879', bic: 'CHASUS33', currency: 'USD',
    paymentTerms: 'Net 30', preferredMethod: 'card',
    verificationStatus: 'verified', verifiedAt: '2026-03-01',
  },
  {
    id: 'PAY-007', supplierId: 'SUP-007', supplierName: 'Microsoft',
    bankName: 'Bank of America', accountHolder: 'Microsoft Corporation',
    iban: 'US12BOFA01038762194530', bic: 'BOFAUS3N', currency: 'USD',
    paymentTerms: 'Net 30', preferredMethod: 'bank-transfer',
    verificationStatus: 'unverified',
  },
];
