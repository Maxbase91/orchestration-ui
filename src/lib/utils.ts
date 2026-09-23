// `cn()` — conditional class names, merged so a later utility wins over an
// earlier one it conflicts with.
//
// tailwind-merge only knows Tailwind's own sizes. The six role-named sizes in
// globals.css (`text-caption`, `text-body`, …) looked to it like text COLOURS,
// so `cn('text-caption', 'text-ink-2')` dropped the size as a conflict and kept
// the colour. Every component that passed a role size and a colour through
// `cn()` rendered at the inherited size instead: the request stepper's stage
// names came out at 17px. Registering them as font sizes fixes it once, here.
// `test:design-tokens` fails if this list and the stylesheet disagree.
import { type ClassValue, clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

export const TYPE_SCALE = ["eyebrow", "caption", "body", "prose", "heading", "display"] as const

const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: [...TYPE_SCALE] }] } },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
