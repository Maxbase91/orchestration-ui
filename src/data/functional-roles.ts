// Seed for `functional_roles` — the roles named on approval-chain steps and
// workflow stages, and which system role acts as each. Maintained on the
// Approval Chains page; this is the starting set only.
//
// Every name here is used by a seeded chain or workflow stage, or by a
// historic approval still in the data ("Finance Approver"), or is one of the
// three roles resolved from a record (Budget Owner → the cost centre's owner,
// Category Manager → the category's managers, Contract Owner → the contract's
// owner), where `actsAs` decides when the record names nobody.
import type { Role } from '../config/roles.js';

export interface FunctionalRole {
  name: string;
  actsAs: Role;
  description: string;
  sortOrder: number;
}

export const functionalRoles: FunctionalRole[] = [
  { name: 'Budget Owner', actsAs: 'procurement-manager', description: 'The owner of the cost centre the request is charged to. With no owner set, any procurement manager decides.', sortOrder: 1 },
  { name: 'Category Manager', actsAs: 'procurement-manager', description: "The category's managers (Categories). With none set, any procurement manager decides.", sortOrder: 2 },
  { name: 'Contract Owner', actsAs: 'procurement-manager', description: "The owner of the contract a call-off draws on. With none set, any procurement manager decides.", sortOrder: 3 },
  { name: 'Finance', actsAs: 'procurement-manager', description: 'Finance approval on the value-banded chains.', sortOrder: 10 },
  { name: 'VP Procurement', actsAs: 'admin', description: 'Approval above the budget-approval threshold.', sortOrder: 11 },
  { name: 'CFO', actsAs: 'admin', description: 'Approval above delegated authority.', sortOrder: 12 },
  { name: 'Board', actsAs: 'admin', description: 'Approval above delegated authority.', sortOrder: 13 },
  { name: 'Supplier Manager', actsAs: 'vendor-manager', description: 'Compliance escalation for a high-risk supplier.', sortOrder: 14 },
  { name: 'Legal', actsAs: 'procurement-manager', description: 'Compliance escalation; owns the Contracting stage.', sortOrder: 15 },
  { name: 'Approver', actsAs: 'procurement-manager', description: "Owns the catalogue workflow's manager approval stage.", sortOrder: 20 },
  { name: 'Business Requestor', actsAs: 'service-owner', description: 'Owns the stages the requester acts on (intake, receipt).', sortOrder: 21 },
  { name: 'Procurement Lead', actsAs: 'procurement-manager', description: 'Owns sourcing.', sortOrder: 22 },
  { name: 'Procurement Ops', actsAs: 'operations-lead', description: 'Owns purchase-order creation.', sortOrder: 23 },
  { name: 'Accounts Payable', actsAs: 'operations-lead', description: 'Owns the invoice and payment stages.', sortOrder: 24 },
  { name: 'Third-party risk', actsAs: 'vendor-manager', description: 'Owns the risk assessment stage.', sortOrder: 25 },
  { name: 'Vendor management', actsAs: 'vendor-manager', description: 'Owns vendor onboarding. It had no mapping in code, so the stage was left unassigned.', sortOrder: 26 },
  { name: 'Finance Approver', actsAs: 'procurement-manager', description: 'Named on older approvals still in the data.', sortOrder: 90 },
];
