import type { User } from './types';

export const users: User[] = [
  {
    id: 'u1',
    name: 'Anna Müller',
    email: 'anna.mueller@company.com',
    role: 'Procurement Lead',
    department: 'Global Procurement',
    initials: 'AM',
    isOOO: false,
  },
  {
    id: 'u2',
    name: 'Thomas Weber',
    email: 'thomas.weber@company.com',
    role: 'Procurement Lead',
    department: 'Global Procurement',
    initials: 'TW',
    isOOO: true,
    delegateId: 'u1',
  },
  {
    id: 'u3',
    name: 'Sarah Chen',
    email: 'sarah.chen@company.com',
    role: 'Category Manager',
    department: 'IT Procurement',
    initials: 'SC',
    isOOO: false,
  },
  {
    id: 'u4',
    name: 'Marcus Johnson',
    email: 'marcus.johnson@company.com',
    role: 'Category Manager',
    department: 'Professional Services',
    initials: 'MJ',
    isOOO: false,
  },
  {
    id: 'u5',
    name: 'Elena Petrova',
    email: 'elena.petrova@company.com',
    role: 'Business Requestor',
    department: 'Engineering',
    initials: 'EP',
    isOOO: false,
  },
  {
    id: 'u6',
    name: 'James O\'Brien',
    email: 'james.obrien@company.com',
    role: 'Business Requestor',
    department: 'Marketing',
    initials: 'JO',
    isOOO: false,
  },
  {
    id: 'u7',
    name: 'Dr. Katrin Bauer',
    email: 'katrin.bauer@company.com',
    role: 'Finance Approver',
    department: 'Finance',
    initials: 'KB',
    isOOO: false,
  },
  {
    id: 'u8',
    name: 'Robert Fischer',
    email: 'robert.fischer@company.com',
    role: 'Finance Approver',
    department: 'Finance',
    initials: 'RF',
    isOOO: true,
    delegateId: 'u7',
  },
  {
    id: 'u9',
    name: 'Lisa Nakamura',
    email: 'lisa.nakamura@company.com',
    role: 'Supplier Manager',
    department: 'Supplier Relations',
    initials: 'LN',
    isOOO: false,
  },
  {
    id: 'u10',
    name: 'David Kowalski',
    email: 'david.kowalski@company.com',
    role: 'Supplier Manager',
    department: 'Supplier Relations',
    initials: 'DK',
    isOOO: false,
  },
  {
    id: 'u11',
    name: 'Christine Dupont',
    email: 'christine.dupont@company.com',
    role: 'VP Procurement',
    department: 'Global Procurement',
    initials: 'CD',
    isOOO: false,
  },
  {
    id: 'u12',
    name: 'Henrik Larsson',
    email: 'henrik.larsson@company.com',
    role: 'VP Procurement',
    department: 'Global Procurement',
    initials: 'HL',
    isOOO: false,
  },
];

export function getUserById(id: string): User | undefined {
  return users.find((u) => u.id === id);
}

export function getUsersByRole(role: string): User[] {
  return users.filter((u) => u.role === role);
}
