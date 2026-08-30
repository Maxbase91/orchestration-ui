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
  single?: boolean;
  body?: unknown;
  conflict?: string;
}

interface CompatibilityResult {
  data: unknown;
  error: { message: string } | null;
}

export type NeonRequestExecutor = (payload: RequestPayload) => Promise<unknown>;

class NeonQueryBuilder implements PromiseLike<CompatibilityResult> {
  private readonly payload: RequestPayload;
  private readonly executor?: NeonRequestExecutor;

  constructor(table: string, executor?: NeonRequestExecutor) {
    this.payload = { operation: 'select', table, filters: [], orFilters: [], orders: [] };
    this.executor = executor;
  }

  select(columns = '*'): this {
    this.payload.select = columns;
    return this;
  }

  eq(column: string, value: unknown): this { return this.addFilter(column, 'eq', value); }
  neq(column: string, value: unknown): this { return this.addFilter(column, 'neq', value); }
  gt(column: string, value: unknown): this { return this.addFilter(column, 'gt', value); }
  gte(column: string, value: unknown): this { return this.addFilter(column, 'gte', value); }
  lt(column: string, value: unknown): this { return this.addFilter(column, 'lt', value); }
  lte(column: string, value: unknown): this { return this.addFilter(column, 'lte', value); }
  ilike(column: string, value: unknown): this { return this.addFilter(column, 'ilike', value); }
  is(column: string, value: unknown): this { return this.addFilter(column, 'is', value); }
  in(column: string, value: unknown[]): this { return this.addFilter(column, 'in', value); }
  filter(column: string, operator: string, value: unknown): this { return this.addFilter(column, operator, value); }

  or(expression: string): this {
    const parsed = expression.split(',').flatMap((part) => {
      const match = /^([A-Za-z_][A-Za-z0-9_]*)\.(eq|neq|ilike|gt|gte|lt|lte)\.(.*)$/.exec(part);
      return match ? [{ column: match[1], operator: match[2], value: match[3] }] : [];
    });
    this.payload.orFilters?.push(...parsed);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.payload.orders?.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(value: number): this { this.payload.limit = value; return this; }
  single(): this { this.payload.single = true; return this; }
  maybeSingle(): this { this.payload.single = true; return this; }

  insert(body: unknown): this { this.payload.operation = 'insert'; this.payload.body = body; return this; }
  update(body: unknown): this { this.payload.operation = 'update'; this.payload.body = body; return this; }
  upsert(body: unknown, options?: { onConflict?: string }): this {
    this.payload.operation = 'upsert';
    this.payload.body = body;
    this.payload.conflict = options?.onConflict;
    return this;
  }
  delete(): this { this.payload.operation = 'delete'; return this; }

  then<TResult1 = CompatibilityResult, TResult2 = never>(
    onfulfilled?: ((value: CompatibilityResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private addFilter(column: string, operator: string, value: unknown): this {
    this.payload.filters?.push({ column, operator, value });
    return this;
  }

  private async execute(): Promise<CompatibilityResult> {
    try {
      if (this.executor) {
        const data = await this.executor(this.payload);
        return { data, error: null };
      }
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.payload),
        signal: AbortSignal.timeout(10000),
      });
      const body = await response.json() as { data?: unknown; error?: string };
      if (!response.ok) return { data: null, error: { message: body.error ?? `Database request failed (${response.status})` } };
      return { data: body.data ?? null, error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Database request failed';
      return { data: null, error: { message } };
    }
  }
}

class NeonRpcBuilder implements PromiseLike<CompatibilityResult> {
  private readonly functionName: string;
  private readonly args?: Record<string, unknown>;
  private readonly executor?: NeonRequestExecutor;

  constructor(functionName: string, args?: Record<string, unknown>, executor?: NeonRequestExecutor) {
    this.functionName = functionName;
    this.args = args;
    this.executor = executor;
  }

  then<TResult1 = CompatibilityResult, TResult2 = never>(
    onfulfilled?: ((value: CompatibilityResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    const execute = async (): Promise<CompatibilityResult> => {
      if (this.executor) {
        const data = await this.executor({ operation: 'rpc', functionName: this.functionName, args: this.args });
        return { data, error: null };
      }
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'rpc', functionName: this.functionName, args: this.args }),
        signal: AbortSignal.timeout(10000),
      });
      const body = await response.json() as { data?: unknown; error?: string };
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
