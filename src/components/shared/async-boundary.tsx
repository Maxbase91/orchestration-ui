// Loading, empty and error — the three states an async surface actually has.
//
// The audit found 31 files rendering a loading state from a TanStack Query hook
// and **7** handling `isError`. The other 24 render the loaded view over
// `data ?? []`, so a failed read is indistinguishable from an empty result.
//
// Five of those are dashboard widgets, where "0 expiring contracts" and "the
// contracts table could not be read" look identical and one of them is a reason
// to act. This is not hypothetical: /admin/ai-analytics had exactly that shape
// and charted zeroes for every metric on a failed read until it was fixed.
//
// One component rather than 24 hand-rolled branches, so the decision about what
// a failure looks like is made once. It is the first consumer of the semantic
// tokens — no raw palette class appears below.
import type { ReactNode } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

/** The slice of a TanStack Query result this needs. Structural, so any query fits. */
export interface AsyncState {
  isLoading: boolean;
  isError?: boolean;
  error?: unknown;
}

export interface AsyncBoundaryProps {
  /** One query, or several — loading if any is loading, failed if any failed. */
  query: AsyncState | AsyncState[];
  /**
   * What is being loaded, lower case: "requests", "handover records". Rendered
   * as "Loading requests…" and "Requests could not be loaded", so it must read
   * as a plural noun rather than a sentence.
   */
  of: string;
  /**
   * True when the load succeeded and there is nothing to show. Passed in rather
   * than inferred from `data`, because "empty" differs per surface — an empty
   * array, a null, a filtered set with no matches — and guessing it here would
   * be the same conflation this component exists to end.
   */
  isEmpty?: boolean;
  /** Shown instead of the default empty line. */
  empty?: ReactNode;
  /**
   * Height for the LOADING state only, so a panel does not collapse and then
   * jump when its rows arrive. The empty state deliberately does not reserve
   * it: five widgets with nothing to report left five tall blank boxes on the
   * dashboard, and a hole in the grid reads as something failing to render.
   */
  minHeight?: number;
  children: ReactNode;
}

function firstError(queries: AsyncState[]): unknown {
  return queries.find((q) => q.isError)?.error;
}

/**
 * Why the error text says so little.
 *
 * A query error can carry a database message naming columns and constraints.
 * The house rule is that internals do not reach users (AGENTS.md), so the
 * surface states that the read failed and the console carries the detail — the
 * same split `api/` uses for its `{ error, code }` responses.
 */
export function AsyncBoundary({
  query, of, isEmpty = false, empty, minHeight = 120, children,
}: AsyncBoundaryProps) {
  const queries = Array.isArray(query) ? query : [query];
  const loading = queries.some((q) => q.isLoading);
  const failed = queries.some((q) => q.isError);

  if (failed) {
    const detail = firstError(queries);
    if (detail) console.warn(`[async] ${of} could not be loaded:`, detail);
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-md border border-stop-line bg-stop-soft p-3"
      >
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-stop" />
        <div>
          <p className="text-body font-medium text-stop">
            {of.charAt(0).toUpperCase() + of.slice(1)} could not be loaded
          </p>
          <p className="mt-0.5 text-caption text-ink-3">
            Nothing is shown rather than something wrong. Try again, and if it persists the
            data source is unreachable.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="flex items-center justify-center gap-2 text-ink-3"
        style={{ minHeight }}
        // Announced politely: a spinner that says nothing is invisible to a
        // screen reader, and this replaces the whole panel.
        role="status"
        aria-live="polite"
      >
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        <span className="text-body">Loading {of}…</span>
      </div>
    );
  }

  if (isEmpty) {
    // Left-aligned and one line tall: it sits under the widget's own title the
    // way a row would, rather than centring itself in reserved space.
    return <p className="py-1 text-caption text-ink-3">{empty ?? `No ${of} yet.`}</p>;
  }

  return <>{children}</>;
}
