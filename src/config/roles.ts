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
