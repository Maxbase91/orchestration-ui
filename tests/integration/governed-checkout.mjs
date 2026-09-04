#!/usr/bin/env node
// Decision coverage for the governed catalogue/contract checkout seam.
import { evaluateGovernedCheckout } from '../../src/lib/procurement/governed-checkout.ts';

const supplier = { id: 'SUP-1', name: 'Example Supplier', riskRating: 'low', screeningStatus: 'clear' };
const contract = { id: 'CON-1', title: 'Example agreement', supplierId: 'SUP-1', supplierName: 'Example Supplier', value: 10000, startDate: '2025-01-01', endDate: '2027-01-01', status: 'active', ownerId: 'u1', ownerName: 'Owner', department: 'Procurement', category: 'Goods', renewalDate: '2026-12-01', utilisationPercentage: 10, linkedRequestIds: [] };
const profile = { userId: 'u1', defaultCurrency: 'EUR', costCentre: 'CC-1', budgetOwner: 'Budget', accountType: 'expense', approvedShipToLocations: [{ id: 'office', label: 'Office' }], defaultShipToLocationId: 'office' };
const risk = { id: 'RISK-1', title: 'Supplier risk', subjectType: 'supplier', supplierId: 'SUP-1', contractId: 'CON-1', category: 'goods', riskLevel: 'low', score: 1, status: 'completed', assessorId: 'u2', assessorName: 'Risk', assessedAt: '2026-01-01', validUntil: '2027-01-01', summary: '', mitigations: [], reusable: true, linkedRequestIds: [], createdAt: '2026-01-01' };
const line = { description: 'Laptop', quantity: 1, unit: 'each', unitPrice: 500, supplierId: 'SUP-1', contractId: 'CON-1', commodityCode: '43211500' };
// The reference data the cost-centre and delivery-location checks are made
// against. Supplied by the caller — the server from its own read, the client
// from the same tables — so the evaluator stays pure and cannot be told by the
// browser what counts as approved.
const reference = { activeCostCentreIds: ['CC-1'], activeDeliveryLocationIds: ['office'] };

let failures = 0;
function check(name, condition) {
  if (condition) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures += 1; console.error(`  \x1b[31m✗\x1b[0m ${name}`); }
}

console.log('Governed checkout decisioning');
const valid = evaluateGovernedCheckout({ route: 'catalogue', lines: [line], supplier, contract, riskAssessment: risk, profile, ...reference, purpose: 'Replace an assigned laptop', now: new Date('2026-08-29') });
check('valid low-value order is accepted', valid.ok);
check('below threshold is auto-approved', valid.status === 'approved' && !valid.approvalRequired);
check('commodity code is resolved', valid.resolved.commodityCodes.includes('43211500'));

const threshold = evaluateGovernedCheckout({ route: 'catalogue', lines: [{ ...line, unitPrice: 1000 }], supplier, contract, riskAssessment: risk, profile, ...reference, purpose: 'Threshold test', now: new Date('2026-08-29') });
check('threshold value requires approval', threshold.approvalRequired && threshold.status === 'pending-approval');

const expiredRisk = evaluateGovernedCheckout({ route: 'catalogue', lines: [line], supplier, contract, riskAssessment: { ...risk, validUntil: '2026-01-01' }, profile, ...reference, purpose: 'Renew risk', now: new Date('2026-08-29') });
check('expired risk enables risk review', expiredRisk.ok && expiredRisk.riskReviewRequired && expiredRisk.status === 'risk-review');

const missingCatalogueRisk = evaluateGovernedCheckout({ route: 'catalogue', lines: [line], supplier, contract, profile, ...reference, purpose: 'Missing risk', now: new Date('2026-08-29') });
check('catalogue item without risk linkage is blocked', !missingCatalogueRisk.ok && missingCatalogueRisk.errors.some((error) => /risk assessment/i.test(error)));

const expiredContract = evaluateGovernedCheckout({ route: 'catalogue', lines: [line], supplier, contract: { ...contract, status: 'expired' }, riskAssessment: risk, profile, ...reference, purpose: 'Blocked contract', now: new Date('2026-08-29') });
check('expired contract blocks submission', !expiredContract.ok && expiredContract.contractAmendmentRequired);

const overCapacity = evaluateGovernedCheckout({ route: 'catalogue', lines: [{ ...line, unitPrice: 9500 }], supplier, contract, riskAssessment: risk, profile, ...reference, purpose: 'Over capacity', now: new Date('2026-08-29') });
check('over-capacity order is blocked', !overCapacity.ok && overCapacity.contractAmendmentRequired);

const mixed = evaluateGovernedCheckout({ route: 'catalogue', lines: [line, { ...line, supplierId: 'SUP-2' }], supplier, contract, riskAssessment: risk, profile, ...reference, purpose: 'Mixed basket', now: new Date('2026-08-29') });
check('mixed supplier basket is blocked', !mixed.ok && mixed.errors.some((error) => /same supplier/i.test(error)));

console.log('\nA cost centre and a delivery location must be real, and active');
// This is the check that could not fail before. `approvedShipToLocations` came
// off the requester's profile, nothing ever populated it, and the server fell
// back to the profile the BROWSER sent when no row existed — so the delivery
// location was validated against a list supplied by the thing being validated.
// The cost centre was checked for non-emptiness only.
const base = { route: 'catalogue', lines: [line], supplier, contract, riskAssessment: risk, profile, purpose: 'Reference data', now: new Date('2026-08-29') };

const unknownLocation = evaluateGovernedCheckout({ ...base, ...reference, shipToLocationId: 'nowhere' });
check('a delivery location that is not in the table is rejected',
  !unknownLocation.ok && unknownLocation.errors.some((error) => /delivery location is not active/i.test(error)));

const retiredLocation = evaluateGovernedCheckout({ ...base, ...reference, activeDeliveryLocationIds: [], shipToLocationId: 'office' });
check('a delivery location that has been deactivated is rejected',
  !retiredLocation.ok && retiredLocation.errors.some((error) => /delivery location is not active/i.test(error)));

const unknownCostCentre = evaluateGovernedCheckout({ ...base, ...reference, costCentre: 'CC-DOES-NOT-EXIST' });
check('a cost centre that is not in the table is rejected',
  !unknownCostCentre.ok && unknownCostCentre.errors.some((error) => /cost centre is not active/i.test(error)));

const retiredCostCentre = evaluateGovernedCheckout({ ...base, ...reference, activeCostCentreIds: [], costCentre: 'CC-1' });
check('a cost centre that has been retired is rejected',
  !retiredCostCentre.ok && retiredCostCentre.errors.some((error) => /cost centre is not active/i.test(error)));

// Fails closed. A caller that could not load the reference data has no evidence
// the values are valid, and absent evidence must not read as approval.
const noReferenceData = evaluateGovernedCheckout(base);
check('a checkout with no reference data loaded is rejected, not waved through',
  !noReferenceData.ok
  && noReferenceData.errors.some((error) => /cost centre is not active/i.test(error))
  && noReferenceData.errors.some((error) => /delivery location is not active/i.test(error)));

// The profile's own list is no longer consulted: it is not evidence.
const selfApproved = evaluateGovernedCheckout({
  ...base,
  profile: { ...profile, approvedShipToLocations: [{ id: 'invented', label: 'Invented' }] },
  activeCostCentreIds: ['CC-1'], activeDeliveryLocationIds: ['office'],
  shipToLocationId: 'invented',
});
check('a location the profile claims to approve is still rejected if the table does not have it',
  !selfApproved.ok && selfApproved.errors.some((error) => /delivery location is not active/i.test(error)));

if (failures > 0) process.exitCode = 1;
