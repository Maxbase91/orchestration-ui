import type { HomeDesign as HomeDesignVariant } from '@/stores/settings-store';
import { DesignCupertino } from './design-cupertino';
import { DesignBento } from './design-bento';
import { DesignEditorial } from './design-editorial';

/**
 * Renders one of the alternative, fully-functional Apple-style home designs.
 * The `-m-6` cancels the app shell's `<main>` padding so the design bleeds
 * edge-to-edge within the content region (the sidebar + top bar stay). The
 * `lp-apple-scope` class carries the Apple tokens/font, scoped to here only.
 */
export function HomeDesign({ variant }: { variant: Exclude<HomeDesignVariant, 'dashboard'> }) {
  return (
    <div className="lp-apple-scope -m-6">
      {variant === '1a' && <DesignCupertino />}
      {variant === '1b' && <DesignBento />}
      {variant === '1c' && <DesignEditorial />}
    </div>
  );
}
