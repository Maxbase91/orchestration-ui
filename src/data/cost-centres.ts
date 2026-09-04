// Canonical default cost centres — the seed and the fallback for the
// `cost_centres` reference table, edited in Admin → Cost centres.
//
// The cost centre used to be free text, after a dropdown of five invented
// entries was rightly deleted for presenting a fabrication with the authority
// of a picker. Free text was the wrong correction: a requester could still type
// anything, and `evaluateGovernedCheckout` could only ever check that the field
// was non-empty. These are administered rows, so the check can be real.
//
// Standardised / white-label: generic business functions, no organisation or
// sector framing. A deployment replaces the set through Admin, without code.
//
// The ids are the codes already carried by existing requests, requisitions and
// purchase orders, so those rows resolve against these without a backfill.
//
// PURE DATA — no runtime imports, so the server-side seed can import it.

import type { CostCentre } from '../lib/db/cost-centres.js';

export const DEFAULT_COST_CENTRES: CostCentre[] = [
  { id: 'CC-COM-001', label: 'Communications', description: '', owner: '', active: true, sortOrder: 1 },
  { id: 'CC-DATA-001', label: 'Data & Analytics', description: '', owner: '', active: true, sortOrder: 2 },
  { id: 'CC-ENG-001', label: 'Engineering 1', description: '', owner: '', active: true, sortOrder: 3 },
  { id: 'CC-ENG-002', label: 'Engineering 2', description: '', owner: '', active: true, sortOrder: 4 },
  { id: 'CC-ENG-003', label: 'Engineering 3', description: '', owner: '', active: true, sortOrder: 5 },
  { id: 'CC-EXEC-001', label: 'Executive Office', description: '', owner: '', active: true, sortOrder: 6 },
  { id: 'CC-FAC-001', label: 'Facilities 1', description: '', owner: '', active: true, sortOrder: 7 },
  { id: 'CC-FAC-002', label: 'Facilities 2', description: '', owner: '', active: true, sortOrder: 8 },
  { id: 'CC-FAC-003', label: 'Facilities 3', description: '', owner: '', active: true, sortOrder: 9 },
  { id: 'CC-FAC-004', label: 'Facilities 4', description: '', owner: '', active: true, sortOrder: 10 },
  { id: 'CC-FAC-005', label: 'Facilities 5', description: '', owner: '', active: true, sortOrder: 11 },
  { id: 'CC-FIN-001', label: 'Finance 1', description: '', owner: '', active: true, sortOrder: 12 },
  { id: 'CC-FIN-002', label: 'Finance 2', description: '', owner: '', active: true, sortOrder: 13 },
  { id: 'CC-FIN-003', label: 'Finance 3', description: '', owner: '', active: true, sortOrder: 14 },
  { id: 'CC-IT-001', label: 'Information Technology 1', description: '', owner: '', active: true, sortOrder: 15 },
  { id: 'CC-IT-002', label: 'Information Technology 2', description: '', owner: '', active: true, sortOrder: 16 },
  { id: 'CC-IT-003', label: 'Information Technology 3', description: '', owner: '', active: true, sortOrder: 17 },
  { id: 'CC-IT-004', label: 'Information Technology 4', description: '', owner: '', active: true, sortOrder: 18 },
  { id: 'CC-IT-005', label: 'Information Technology 5', description: '', owner: '', active: true, sortOrder: 19 },
  { id: 'CC-IT-006', label: 'Information Technology 6', description: '', owner: '', active: true, sortOrder: 20 },
  { id: 'CC-IT-007', label: 'Information Technology 7', description: '', owner: '', active: true, sortOrder: 21 },
  { id: 'CC-IT-008', label: 'Information Technology 8', description: '', owner: '', active: true, sortOrder: 22 },
  { id: 'CC-AUDIT-001', label: 'Internal Audit', description: '', owner: '', active: true, sortOrder: 23 },
  { id: 'CC-LEGAL-001', label: 'Legal', description: '', owner: '', active: true, sortOrder: 24 },
  { id: 'CC-LOG-001', label: 'Logistics', description: '', owner: '', active: true, sortOrder: 25 },
  { id: 'CC-MFG-001', label: 'Manufacturing', description: '', owner: '', active: true, sortOrder: 26 },
  { id: 'CC-MKT-001', label: 'Marketing', description: '', owner: '', active: true, sortOrder: 27 },
  { id: 'CC-OPS-001', label: 'Operations 1', description: '', owner: '', active: true, sortOrder: 28 },
  { id: 'CC-OPS-002', label: 'Operations 2', description: '', owner: '', active: true, sortOrder: 29 },
  { id: 'CC-OPS-003', label: 'Operations 3', description: '', owner: '', active: true, sortOrder: 30 },
  { id: 'CC-OPS-004', label: 'Operations 4', description: '', owner: '', active: true, sortOrder: 31 },
  { id: 'CC-OPS-005', label: 'Operations 5', description: '', owner: '', active: true, sortOrder: 32 },
  { id: 'CC-OPS-006', label: 'Operations 6', description: '', owner: '', active: true, sortOrder: 33 },
  { id: 'CC-HR-001', label: 'People 1', description: '', owner: '', active: true, sortOrder: 34 },
  { id: 'CC-HR-002', label: 'People 2', description: '', owner: '', active: true, sortOrder: 35 },
  { id: 'CC-PROD-001', label: 'Product', description: '', owner: '', active: true, sortOrder: 36 },
  { id: 'CC-QC-001', label: 'Quality', description: '', owner: '', active: true, sortOrder: 37 },
  { id: 'CC-RD-001', label: 'Research & Development', description: '', owner: '', active: true, sortOrder: 38 },
  { id: 'CC-RISK-001', label: 'Risk Management', description: '', owner: '', active: true, sortOrder: 39 },
  { id: 'CC-SALES-001', label: 'Sales', description: '', owner: '', active: true, sortOrder: 40 },
  { id: 'CC-SEC-001', label: 'Security', description: '', owner: '', active: true, sortOrder: 41 },
  { id: 'CC-STR-001', label: 'Strategy', description: '', owner: '', active: true, sortOrder: 42 },
  { id: 'CC-STRAT-001', label: 'Strategy', description: '', owner: '', active: true, sortOrder: 43 },
  { id: 'CC-SUST-001', label: 'Sustainability', description: '', owner: '', active: true, sortOrder: 44 },
];
