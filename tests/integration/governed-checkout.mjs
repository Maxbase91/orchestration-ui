#!/usr/bin/env node
// Decision coverage for the governed catalogue/contract checkout seam.
import { evaluateGovernedCheckout } from '../../src/lib/procurement/governed-checkout.ts';

const supplier = { id: 'SUP-1', name: 'Example Supplier', riskRating: 'low', screeningStatus: 'clear' };
const contract = { id: 'CON-1', title: 'Example agreement', supplierId: 'SUP-1', supplierName: 'Example Supplier', value: 10000, startDate: '2025-01-01', endDate: '2027-01-01', status: 'active', ownerId: 'u1', ownerName: 'Owner', department: 'Procurement', category: 'Goods', renewalDate: '2026-12-01', utilisationPercentage: 10, linkedRequestIds: [] };
const profile = { userId: 'u1', defaultCurrency: 'EUR', costCentre: 'CC-1', budgetOwner: 'Budget', accountType: 'expense', approvedShipToLocations: [{ id: 'office', label: 'Office' }], defaultShipToLocationId: 'office' };
const risk = { id: 'RISK-1', title: 'Supplier risk', subjectType: 'supplier', supplierId: 'SUP-1', contractId: 'CON-1', category: 'goods', riskLevel: 'low', score: 1, status: 'completed', assessorId: 'u2', assessorName: 'Risk', assessedAt: '2026-01-01', validUntil: '2027-01-01', summary: '', mitigations: [], reusable: true, linkedRequestIds: [], createdAt: '2026-01-01' };
const line = { description: 'Laptop', quantity: 1, unit: 'each', unitPrice: 500, supplierId: 'SUP-1', contractId: 'CON-1', commodityCode: '43211500' };

let failures = 0;
function check(name, condition) {
  if (condition) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures += 1; console.error(`  \x1b[31m✗\x1b[0m ${name}`); }
}

console.log('Governed checkout decisioning');
const valid = evaluateGovernedCheckout({ route: 'catalogue', lines: [line], supplier, contract, riskAssessment: risk, profile, purpose: 'Replace an assigned laptop', now: new Date('2026-08-29') });
check('valid low-value order is accepted', valid.ok);
check('below threshold is auto-approved', valid.status === 'approved' && !valid.approvalRequired);
check('commodity code is resolved', valid.resolved.commodityCodes.includes('43211500'));

const threshold = evaluateGovernedCheckout({ route: 'catalogue', lines: [{ ...line, unitPrice: 1000 }], supplier, contract, riskAssessment: risk, profile, purpose: 'Threshold test', now: new Date('2026-08-29') });
check('threshold value requires approval', threshold.approvalRequired && threshold.status === 'pending-approval');

const expiredRisk = evaluateGovernedCheckout({ route: 'catalogue', lines: [line], supplier, contract, riskAssessment: { ...risk, validUntil: '2026-01-01' }, profile, purpose: 'Renew risk', now: new Date('2026-08-29') });
check('expired risk enables risk review', expiredRisk.ok && expiredRisk.riskReviewRequired && expiredRisk.status === 'risk-review');

const missingCatalogueRisk = evaluateGovernedCheckout({ route: 'catalogue', lines: [line], supplier, contract, profile, purpose: 'Missing risk', now: new Date('2026-08-29') });
check('catalogue item without risk linkage is blocked', !missingCatalogueRisk.ok && missingCatalogueRisk.errors.some((error) => /risk assessment/i.test(error)));

const expiredContract = evaluateGovernedCheckout({ route: 'catalogue', lines: [line], supplier, contract: { ...contract, status: 'expired' }, riskAssessment: risk, profile, purpose: 'Blocked contract', now: new Date('2026-08-29') });
check('expired contract blocks submission', !expiredContract.ok && expiredContract.contractAmendmentRequired);

const overCapacity = evaluateGovernedCheckout({ route: 'catalogue', lines: [{ ...line, unitPrice: 9500 }], supplier, contract, riskAssessment: risk, profile, purpose: 'Over capacity', now: new Date('2026-08-29') });
check('over-capacity order is blocked', !overCapacity.ok && overCapacity.contractAmendmentRequired);

const mixed = evaluateGovernedCheckout({ route: 'catalogue', lines: [line, { ...line, supplierId: 'SUP-2' }], supplier, contract, riskAssessment: risk, profile, purpose: 'Mixed basket', now: new Date('2026-08-29') });
check('mixed supplier basket is blocked', !mixed.ok && mixed.errors.some((error) => /same supplier/i.test(error)));

if (failures > 0) process.exitCode = 1;
