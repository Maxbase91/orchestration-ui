import { useAuthStore } from '@/stores/auth-store';

export function useCurrentRole() {
  return useAuthStore((s) => s.currentRole);
}
