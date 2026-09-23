// A row of related figures, without a card around each one.
//
// The dashboard drew a bordered, shadowed tile for every number, then put three
// of them inside another bordered tile — card in card, so the frame around
// "Active Users" carried the same visual weight as the panel it belonged to.
// Border, fill and shadow each say "separate object"; spent on every figure
// they say nothing at all.
//
// Here the group is the object. Facts sit in one surface, separated by a
// hairline, and the only emphasis left is the one that means something: a tone
// on a value that is bad news.
import type { ReactNode } from 'react';

export interface Fact {
  label: string;
  value: ReactNode;
  /** Colour the value only where the value itself is the warning. */
  tone?: 'ink' | 'ok' | 'warn' | 'stop';
  /** One quiet line under the value — a unit, a caveat, what it was measured from. */
  note?: ReactNode;
}

const TONE: Record<NonNullable<Fact['tone']>, string> = {
  ink: 'text-ink', ok: 'text-ok', warn: 'text-warn', stop: 'text-stop',
};

/** Tailwind needs whole class names, so the column counts are spelled out. */
const COLUMNS: Record<number, string> = {
  2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4',
};

export function FactGrid({ facts, columns = 3 }: { facts: Fact[]; columns?: 2 | 3 | 4 }) {
  return (
    <dl className={`grid ${COLUMNS[columns] ?? COLUMNS[3]} divide-x divide-line`}>
      {facts.map((fact) => (
        <div key={fact.label} className="px-4 first:pl-0 last:pr-0">
          <dt className="text-caption font-medium text-ink-3">{fact.label}</dt>
          {/* Tabular figures: a row of numbers is read across, and proportional
              digits make the column edges ragged. */}
          <dd className={`mt-1 text-heading font-semibold tabular-nums ${TONE[fact.tone ?? 'ink']}`}>
            {fact.value}
          </dd>
          {fact.note && <p className="mt-0.5 text-caption text-ink-3">{fact.note}</p>}
        </div>
      ))}
    </dl>
  );
}
