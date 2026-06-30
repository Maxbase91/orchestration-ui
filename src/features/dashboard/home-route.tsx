import { useSettingsStore } from '@/stores/settings-store';
import { DashboardPage } from './dashboard-page';
import { HomeDesign } from './home-designs/home-design';

/**
 * The `/` route. Renders the current functional dashboard by default, or one of
 * the alternative Apple-style home designs when the user picks one from the
 * top-bar design switcher. All designs are fully functional; the dashboard is
 * left completely untouched.
 */
export function HomeRoute() {
  const homeDesign = useSettingsStore((s) => s.homeDesign);
  if (homeDesign === 'dashboard') return <DashboardPage />;
  return <HomeDesign variant={homeDesign} />;
}
