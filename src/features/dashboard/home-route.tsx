import { DashboardPage } from './dashboard-page';

/**
 * The `/` route.
 *
 * There is one home. It used to fork on the Simple/Expert switch — a requester
 * got a stripped entry point, everyone else the operational dashboard — which
 * meant two pages of the same data and a decision the user had to make before
 * they could see their work. The dashboard now does both jobs: each role opens
 * on a default widget layout that covers what that role actually does, and a
 * requester's is their own requests, not KPIs.
 */
export function HomeRoute() {
  return <DashboardPage />;
}
