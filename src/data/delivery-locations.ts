// Canonical default delivery locations — the seed and the fallback for the
// `delivery_locations` reference table, edited in Admin → Delivery locations.
//
// This replaces two fabrications. The catalogue checkout offered three invented
// options ("My default office location", "My approved home delivery address",
// "The beneficiary's approved location") that no table backed, and the governed
// checkout validated the chosen location against `approvedShipToLocations` on
// the requester's profile — a list nothing ever populated, which the browser
// itself supplied when no profile row existed. The check approved whatever it
// was handed. These are administered rows, so it can approve something real.
//
// Standardised / white-label: generic site types, no organisation, city or
// sector naming. A deployment replaces the set through Admin, without code.
//
// PURE DATA — no runtime imports, so the server-side seed can import it.

import type { DeliveryLocation } from '../lib/db/delivery-locations.js';

export const DEFAULT_DELIVERY_LOCATIONS: DeliveryLocation[] = [
  { id: 'office', label: 'Head office', address: '', countryCode: '', active: true, sortOrder: 1 },
  { id: 'office-secondary', label: 'Secondary office', address: '', countryCode: '', active: true, sortOrder: 2 },
  { id: 'warehouse', label: 'Central warehouse', address: '', countryCode: '', active: true, sortOrder: 3 },
  { id: 'distribution-centre', label: 'Distribution centre', address: '', countryCode: '', active: true, sortOrder: 4 },
  { id: 'project-site', label: 'Project site', address: '', countryCode: '', active: true, sortOrder: 5 },
  // Kept as an id because in-flight drafts and deep links may already carry it.
  { id: 'home', label: 'Home address on file', address: '', countryCode: '', active: true, sortOrder: 6 },
];
