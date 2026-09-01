// Switches the requester between Simple and Expert intake.
//
// Presentation density only: both modes submit through the same shared
// decisioning helpers and reach the same governance decision (asserted by
// test:mode-equivalence). This is not an authorization boundary — what a user
// may do is unchanged by which mode they are in.
import { Check, SlidersHorizontal, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useExperienceMode } from '@/hooks/use-experience-mode';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** Lets users change presentation density while keeping role permissions intact. */
export function ExperienceModeSwitcher() {
  const { mode, canUseSimple, setMode } = useExperienceMode();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Experience view: ${mode}. Change view`}
          className="px-2 sm:px-3"
        >
          {mode === 'simple' ? <Sparkles className="size-3.5" /> : <SlidersHorizontal className="size-3.5" />}
          <span className="hidden sm:inline">{mode === 'simple' ? 'Simple view' : 'Expert view'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Experience view</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setMode('simple')} disabled={!canUseSimple}>
          <Sparkles className="size-4" />
          <span className="flex-1">
            <span className="block font-medium">Simple view</span>
            <span className="block text-xs text-muted-foreground">Focused requester journey</span>
          </span>
          {mode === 'simple' && <Check className="size-4" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setMode('expert')}>
          <SlidersHorizontal className="size-4" />
          <span className="flex-1">
            <span className="block font-medium">Expert view</span>
            <span className="block text-xs text-muted-foreground">Full workflow and governance detail</span>
          </span>
          {mode === 'expert' && <Check className="size-4" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
