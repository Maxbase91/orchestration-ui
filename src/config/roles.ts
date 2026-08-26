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

/**
 * Object kinds each role may reference from a ticket.
 *
 * Derived from what the role can already see in the app, not invented: a picker
 * that lists objects a role has no nav access to would leak ids and names
 * through the back door. Mirrors the visibility groups in navigation.ts —
 * requests are visible to every internal role, suppliers to the supplier-
 * management roles, and contracts / POs / invoices to the core internal roles.
 *
 * The external supplier role gets nothing: it must not be able to enumerate
 * internal objects from a support form.
 */
export function ticketLinkTypesForRole(role: Role): string[] {
  if (role === 'supplier') return [];

  const types = ['purchase-request'];
  if (['procurement-manager', 'vendor-manager', 'operations-lead', 'admin'].includes(role)) {
    types.push('supplier');
  }
  if (['procurement-manager', 'operations-lead', 'admin'].includes(role)) {
    types.push('contract', 'purchase-order', 'invoice');
  }
  return types;
}
