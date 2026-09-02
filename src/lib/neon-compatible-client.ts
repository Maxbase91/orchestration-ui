// Browser-safe compatibility client for the private Neon migration.
// It preserves the small Supabase query surface used by existing modules while
// routing every operation through the allowlisted server endpoint.

type Filter = { column: string; operator: string; value: unknown };
type Order = { column: string; ascending: boolean };

export interface RequestPayload {
  operation: 'select' | 'insert' | 'update' | 'upsert' | 'delete' | 'rpc';
  table?: string;
  functionName?: string;
  args?: Record<string, unknown>;
  select?: string;
  filters?: Filter[];
  orFilters?: Filter[];
  orders?: Order[];
  limit?: number;
  /**
   * `one` errors when no row matches; `maybe` returns null. They were a single
   * boolean, which collapsed supabase-js's `.single()` and `.maybeSingle()` into
   * the same request — so a `.single()` that found nothing came back as
   * `{ data: null, error: null }` and the caller's `if (error) throw` never
   * fired, handing null to a mapper instead of raising.
   */
  single?: 'one' | 'maybe';
  body?: unknown;
  conflict?: string;
  /** `.upsert(..., { ignoreDuplicates: true })` — DO NOTHING instead of DO UPDATE. */
  ignoreDuplicates?: boolean;
  /** `.select('*', { count: 'exact' })` — return a total alongside the rows. */
  count?: 'exact';
  /** `.select('*', { head: true })` — count only, no rows. */
  head?: boolean;
}

/** A row as the endpoint returns it — column names, untyped values. */
export type DbRow = Record<string, unknown>;

/**
 * The `{ data, error }` pair the data modules destructure.
 *
 * Generic over the row shape so `data` is `DbRow[]` for a list read and
 * `DbRow | null` after `.single()`/`.maybeSingle()`. It was `unknown`, which
 * forced every call site to cast before mapping and hid whether a query
 * returned one row or many.
 */
export interface CompatibilityResult<TData = DbRow[]> {
  data: TData;
  error: { message: string } | null;
  /** Set only when the query asked for one via `select(..., { count: 'exact' })`. */
  count?: number;
}

export type NeonRequestExecutor = (payload: RequestPayload) => Promise<unknown>;

class NeonQueryBuilder<TData = DbRow[]> implements PromiseLike<CompatibilityResult<TData>> {
  private readonly payload: RequestPayload;
  private readonly executor?: NeonRequestExecutor;

  constructor(table: string, executor?: NeonRequestExecutor) {
    this.payload = { operation: 'select', table, filters: [], orFilters: [], orders: [] };
    this.executor = executor;
  }

  // The options argument used to be dropped: `select('*', { count: 'exact',
  // head: true })` returned no count and fetched every row instead of a HEAD
  // count, so a caller reading `{ count }` silently got undefined.
  select(columns = '*', options?: { count?: 'exact'; head?: boolean }): this {
    this.payload.select = columns;
    if (options?.count) this.payload.count = options.count;
    if (options?.head) this.payload.head = options.head;
    return this;
  }

  eq(column: string, value: unknown): this { return this.addFilter(column, 'eq', value); }
  neq(column: string, value: unknown): this { return this.addFilter(column, 'neq', value); }
  gt(column: string, value: unknown): this { return this.addFilter(column, 'gt', value); }
  gte(column: string, value: unknown): this { return this.addFilter(column, 'gte', value); }
  lt(column: string, value: unknown): this { return this.addFilter(column, 'lt', value); }
  lte(column: string, value: unknown): this { return this.addFilter(column, 'lte', value); }
  like(column: string, value: unknown): this { return this.addFilter(column, 'like', value); }
  ilike(column: string, value: unknown): this { return this.addFilter(column, 'ilike', value); }
  is(column: string, value: unknown): this { return this.addFilter(column, 'is', value); }
  in(column: string, value: unknown[]): this { return this.addFilter(column, 'in', value); }
  filter(column: string, operator: string, value: unknown): this { return this.addFilter(column, operator, value); }
  /** Array/JSONB containment (`@>`). Used for `mentions` on comments. */
  contains(column: string, value: unknown): this { return this.addFilter(column, 'cs', value); }

  /**
   * PostgREST-style `or` — `col.eq.x,other.ilike.%y%`.
   *
   * A fragment that does not parse now throws. It used to be dropped, and when
   * every fragment was dropped the OR clause vanished from the WHERE entirely,
   * so the query quietly returned the whole table instead of failing. Splitting
   * on every comma also broke any value containing one, so the split stops at
   * the operator: `a.eq.Acme, Inc` stays one fragment.
   */
  or(expression: string): this {
    const fragments = expression.split(/,(?=[A-Za-z_][A-Za-z0-9_]*\.[a-z]+\.)/);
    for (const part of fragments) {
      const match = /^([A-Za-z_][A-Za-z0-9_]*)\.(eq|neq|ilike|gt|gte|lt|lte|is|in|cs)\.(.*)$/.exec(part.trim());
      if (!match) throw new Error(`Unsupported or() fragment: ${part}`);
      this.payload.orFilters?.push({ column: match[1], operator: match[2], value: match[3] });
    }
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.payload.orders?.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(value: number): this { this.payload.limit = value; return this; }

  // Both narrow the awaited result from many rows to one. The casts are the
  // builder telling the type system what it just did to its own payload —
  // contained here, rather than pushed onto every call site as they were before.
  //
  // `single()` is typed non-null because the endpoint now errors when nothing
  // matched, exactly as supabase-js does; `maybeSingle()` keeps the null.
  single(): NeonQueryBuilder<DbRow> {
    this.payload.single = 'one';
    return this as unknown as NeonQueryBuilder<DbRow>;
  }

  maybeSingle(): NeonQueryBuilder<DbRow | null> {
    this.payload.single = 'maybe';
    return this as unknown as NeonQueryBuilder<DbRow | null>;
  }

  insert(body: unknown): this { this.payload.operation = 'insert'; this.payload.body = body; return this; }
  update(body: unknown): this { this.payload.operation = 'update'; this.payload.body = body; return this; }
  upsert(body: unknown, options?: { onConflict?: string; ignoreDuplicates?: boolean }): this {
    this.payload.operation = 'upsert';
    this.payload.body = body;
    this.payload.conflict = options?.onConflict;
    this.payload.ignoreDuplicates = options?.ignoreDuplicates;
    return this;
  }
  delete(): this { this.payload.operation = 'delete'; return this; }

  then<TResult1 = CompatibilityResult<TData>, TResult2 = never>(
    onfulfilled?: ((value: CompatibilityResult<TData>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private addFilter(column: string, operator: string, value: unknown): this {
    this.payload.filters?.push({ column, operator, value });
    return this;
  }

  private async execute(): Promise<CompatibilityResult<TData>> {
    try {
      if (this.executor) {
        const data = await this.executor(this.payload);
        return { data: data as TData, error: null };
      }
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.payload),
        // Match the server wake-up budget; a cold Neon branch can take longer
        // than ten seconds when several first-render queries arrive together.
        signal: AbortSignal.timeout(30000),
      });
      const body = await response.json() as { data?: unknown; error?: string; count?: number };
      // On failure `data` is null whatever TData says: callers check `error`
      // first, which is the contract the data modules already follow.
      if (!response.ok) return { data: null as TData, error: { message: body.error ?? `Database request failed (${response.status})` } };
      return { data: (body.data ?? null) as TData, error: null, count: body.count };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Database request failed';
      return { data: null as TData, error: { message } };
    }
  }
}

class NeonRpcBuilder implements PromiseLike<CompatibilityResult<unknown>> {
  private readonly functionName: string;
  private readonly args?: Record<string, unknown>;
  private readonly executor?: NeonRequestExecutor;

  constructor(functionName: string, args?: Record<string, unknown>, executor?: NeonRequestExecutor) {
    this.functionName = functionName;
    this.args = args;
    this.executor = executor;
  }

  then<TResult1 = CompatibilityResult<unknown>, TResult2 = never>(
    onfulfilled?: ((value: CompatibilityResult<unknown>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    const execute = async (): Promise<CompatibilityResult<unknown>> => {
      if (this.executor) {
        const data = await this.executor({ operation: 'rpc', functionName: this.functionName, args: this.args });
        return { data, error: null };
      }
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'rpc', functionName: this.functionName, args: this.args }),
        signal: AbortSignal.timeout(30000),
      });
      const body = await response.json() as { data?: unknown; error?: string; count?: number };
      if (!response.ok) throw new Error(body.error ?? `Database request failed (${response.status})`);
      return { data: body.data ?? null, error: null };
    };
    return execute().then(onfulfilled, onrejected);
  }
}

export class NeonCompatibleClient {
  private readonly executor?: NeonRequestExecutor;

  constructor(executor?: NeonRequestExecutor) {
    this.executor = executor;
  }
  from(table: string): NeonQueryBuilder { return new NeonQueryBuilder(table, this.executor); }
  rpc(functionName: string, args?: Record<string, unknown>): NeonRpcBuilder { return new NeonRpcBuilder(functionName, args, this.executor); }
}
