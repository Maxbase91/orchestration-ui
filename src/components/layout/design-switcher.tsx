import { Check, Palette } from 'lucide-react';
import { useSettingsStore, type HomeDesign } from '@/stores/settings-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const OPTIONS: { id: HomeDesign; label: string; desc: string }[] = [
  { id: 'dashboard', label: 'Dashboard', desc: 'The default functional dashboard' },
  { id: '1a', label: 'Cupertino', desc: 'Centered hero + live pipeline' },
  { id: '1b', label: 'Bento', desc: 'Bento grid of live tiles' },
  { id: '1c', label: 'Editorial', desc: 'Big type + live vertical flow' },
];

/**
 * Home-design picker, placed next to the role-switcher in the top bar. Switches
 * what `/` renders (the current dashboard, or one of the Apple-style designs).
 * Persisted via settings-store, so the choice survives reloads.
 */
export function DesignSwitcher() {
  const homeDesign = useSettingsStore((s) => s.homeDesign);
  const setHomeDesign = useSettingsStore((s) => s.setHomeDesign);
  const active = OPTIONS.find((o) => o.id === homeDesign);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          title="Home design"
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-muted transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Palette className="size-4 text-text-muted" />
          <span className="hidden md:inline text-sm font-medium text-text-primary">{active?.label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2 py-1.5">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Home design</p>
        </div>
        <DropdownMenuSeparator />
        {OPTIONS.map((o) => (
          <DropdownMenuItem
            key={o.id}
            onClick={() => setHomeDesign(o.id)}
            className="flex items-start gap-2 py-2 cursor-pointer"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary">{o.label}</p>
              <p className="text-xs text-text-muted">{o.desc}</p>
            </div>
            {homeDesign === o.id && <Check className="h-4 w-4 text-status-success shrink-0 mt-0.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
