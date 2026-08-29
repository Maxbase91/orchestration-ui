import { useSettingsStore } from '@/stores/settings-store';
import { DashboardPage } from './dashboard-page';
import { HomeDesign } from './home-designs/home-design';
import { SimpleHomePage } from './simple-home-page';
import { useExperienceMode } from '@/hooks/use-experience-mode';

/**
 * The `/` route. Renders the current functional dashboard by default, or one of
 * the alternative Apple-style home designs when the user picks one from the
 * top-bar design switcher. All designs are fully functional; the dashboard is
 * left completely untouched.
 */
export function HomeRoute() {
  const { mode } = useExperienceMode();
  const homeDesign = useSettingsStore((s) => s.homeDesign);
  if (mode === 'simple') return <SimpleHomePage />;
  if (homeDesign === 'dashboard') return <DashboardPage />;
  return <HomeDesign variant={homeDesign} />;
}
