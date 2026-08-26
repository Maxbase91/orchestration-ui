export type Role = 'service-owner' | 'procurement-manager' | 'vendor-manager' | 'operations-lead' | 'supplier' | 'admin';

export interface RoleConfig {
  id: Role;
  label: string;
  description: string;
}

export const roles: RoleConfig[] = [
  { id: 'service-owner', label: 'Requestor / End User', description: 'Business user who needs to buy something' },
  { id: 'procurement-manager', label: 'Strategic Procurement Manager', description: 'Manages demand pipeline and sourcing strategy' },
  { id: 'vendor-manager', label: 'Vendor Manager', description: 'Validates sourcing requests and compliance' },
  { id: 'operations-lead', label: 'Procurement Operations Lead', description: 'Handles operational queries and workflows' },
  { id: 'supplier', label: 'Supplier (External)', description: 'External supplier self-service' },
  { id: 'admin', label: 'Admin / Platform Owner', description: 'Configures rules, workflows, and policies' },
];

export const internalRoles: Role[] = ['service-owner', 'procurement-manager', 'vendor-manager', 'operations-lead', 'admin'];

/**
 * Roles that work the support queue — see every ticket, assign, reply, and close.
 * Everyone else is a requester: their own tickets only, and never an internal note.
 *
 * `operations-lead` is included because operational queries are what that role
 * exists to field ("Handles operational queries and workflows"). `service-owner`
 * and `vendor-manager` are internal but raise tickets rather than work them.
 */
export const ticketAgentRoles: Role[] = ['admin', 'procurement-manager', 'operations-lead'];

export function canWorkTickets(role: Role): boolean {
  return ticketAgentRoles.includes(role);
}
