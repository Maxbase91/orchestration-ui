import type { Role } from '@/config/roles';

/** Shared presentation-mode policy. Business permissions remain role-driven. */
export type ExperienceMode = 'simple' | 'expert';

const runtimeEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};
const SIMPLE_MODE_ENABLED = runtimeEnv.VITE_SIMPLE_EXPERIENCE_ENABLED !== 'false';

function csv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Pilot allowlists are optional. With no allowlist configured the prototype
 * keeps Simple mode available to every signed-in persona, while production
 * can narrow exposure without changing components.
 */
export function canUseSimpleExperience(userId: string, role: Role): boolean {
  if (!SIMPLE_MODE_ENABLED) return false;
  const users = csv(runtimeEnv.VITE_SIMPLE_EXPERIENCE_USER_IDS);
  const roles = csv(runtimeEnv.VITE_SIMPLE_EXPERIENCE_ROLES);
  if (users.length === 0 && roles.length === 0) return true;
  return users.includes(userId) || roles.includes(role);
}

export function defaultExperienceMode(role: Role): ExperienceMode {
  return role === 'service-owner' ? 'simple' : 'expert';
}

export function normalizeExperienceMode(value: unknown): ExperienceMode | undefined {
  return value === 'simple' || value === 'expert' ? value : undefined;
}
