export const theme = {
  colors: {
    navy: { DEFAULT: '#1B2A4A', light: '#2D5F8A' },
    amber: { DEFAULT: '#D4782F' },
    background: '#F3F5F9',
    card: '#FFFFFF',
    text: { primary: '#1E1E1E', secondary: '#4A5568', muted: '#718096' },
    status: {
      success: '#2E7D4F',
      warning: '#D4782F',
      danger: '#B5392E',
      info: '#2D5F8A',
    },
  },
} as const;

export const statusColorMap = {
  draft: 'bg-gray-100 text-gray-700',
  intake: 'bg-blue-100 text-blue-700',
  validation: 'bg-blue-100 text-blue-700',
  approval: 'bg-amber-100 text-amber-700',
  sourcing: 'bg-amber-100 text-amber-700',
  contracting: 'bg-amber-100 text-amber-700',
  po: 'bg-amber-100 text-amber-700',
  receipt: 'bg-amber-100 text-amber-700',
  invoice: 'bg-amber-100 text-amber-700',
  payment: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  'referred-back': 'bg-red-100 text-red-700',
  active: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-700',
  expiring: 'bg-amber-100 text-amber-700',
  blocked: 'bg-red-100 text-red-700',
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  overdue: 'bg-red-100 text-red-700',
  // Sourcing statuses
  published: 'bg-blue-100 text-blue-700',
  'in-evaluation': 'bg-amber-100 text-amber-700',
  'award-pending': 'bg-purple-100 text-purple-700',
  // Contract statuses
  'under-review': 'bg-blue-100 text-blue-700',
  terminated: 'bg-red-100 text-red-700',
  // PO statuses
  submitted: 'bg-blue-100 text-blue-700',
  acknowledged: 'bg-blue-100 text-blue-700',
  received: 'bg-green-100 text-green-700',
  'partially-received': 'bg-amber-100 text-amber-700',
  closed: 'bg-gray-100 text-gray-700',
  // Invoice statuses
  matched: 'bg-green-100 text-green-700',
  scheduled: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  disputed: 'bg-red-100 text-red-700',
  // Match statuses
  'partial-match': 'bg-amber-100 text-amber-700',
  unmatched: 'bg-red-100 text-red-700',
  variance: 'bg-amber-100 text-amber-700',
} as const;

export type StatusKey = keyof typeof statusColorMap;
