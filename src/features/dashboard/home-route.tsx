import { DashboardPage } from './dashboard-page';
import { SimpleHomePage } from './simple-home-page';
import { useExperienceMode } from '@/hooks/use-experience-mode';

/**
 * The `/` route. Simple mode gets the requester entry point; Expert mode gets
 * the operational dashboard. Decorative alternate home layouts are retired.
 */
export function HomeRoute() {
  const { mode } = useExperienceMode();
  if (mode === 'simple') return <SimpleHomePage />;
  return <DashboardPage />;
}
