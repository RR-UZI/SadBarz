// A fake Supabase for the function tests: tables in memory, the query builder calls the functions use,
// and users for auth.getUser. Tests read `fake.tables` to see what a function saved.

type Row = Record<string, unknown>;
type Filter = (r: Row) => boolean;

export interface FakeUser {
  id: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

export const fake = {
  tables: {} as Record<string, Row[]>,
  /** jwt -> user */
  users: {} as Record<string, FakeUser>,
  /** Tables that don't exist (a migration not run yet): every query on them errors. */
  missing: new Set<string>(),
  reset() {
    this.tables = {};
    this.users = {};
    this.missing = new Set();
  },
};

let seq = 0;

// "a->b" reads JSON a.b; "a->>b" the same as text.
function read(row: Row, path: string): unknown {
  const parts = path.split(/->>?/);
  let v: unknown = row[parts[0]];
  for (const p of parts.slice(1)) v = v && typeof v === 'object' ? (v as Row)[p] : undefined;
  return path.includes('->>') && v != null && typeof v !== 'string' ? String(v) : v;
}

// "id, status, batch:input->batch" or "*"
function pick(row: Row, columns: string): Row {
  if (columns.trim() === '*') return { ...row };
  const out: Row = {};
  for (const c of columns.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [alias, path] = c.includes(':') ? c.split(':') : [c.split(/->>?/).pop()!, c];
    out[alias] = read(row, path) ?? null;
  }
  return out;
}

class Query implements PromiseLike<{ data: unknown; error: { message: string } | null; count?: number | null }> {
  private filters: Filter[] = [];
  private orders: { col: string; asc: boolean; nullsFirst: boolean }[] = [];
  private max?: number;
  private columns = '*';
  private head = false;
  private counting = false;
  private one: 'single' | 'maybe' | null = null;
  private action: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private payload: Row[] = [];
  private patch: Row = {};
  private conflict: string[] = [];
  private returning = false;

  constructor(private table: string) {}

  select(columns = '*', opts?: { count?: string; head?: boolean }) {
    this.columns = columns;
    if (this.action !== 'select') this.returning = true;
    if (opts?.count) this.counting = true;
    if (opts?.head) this.head = true;
    return this;
  }
  insert(rows: Row | Row[]) {
    this.action = 'insert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
    this.action = 'upsert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    this.conflict = (opts?.onConflict ?? 'id').split(',').map((s) => s.trim());
    return this;
  }
  update(patch: Row) {
    this.action = 'update';
    this.patch = patch;
    return this;
  }
  delete() {
    this.action = 'delete';
    return this;
  }
  eq(col: string, v: unknown) {
    this.filters.push((r) => read(r, col) === v);
    return this;
  }
  neq(col: string, v: unknown) {
    this.filters.push((r) => read(r, col) !== v);
    return this;
  }
  gt(col: string, v: string | number) {
    this.filters.push((r) => (read(r, col) as string | number) > v);
    return this;
  }
  gte(col: string, v: string | number) {
    this.filters.push((r) => (read(r, col) as string | number) >= v);
    return this;
  }
  lt(col: string, v: string | number) {
    this.filters.push((r) => (read(r, col) as string | number) < v);
    return this;
  }
  lte(col: string, v: string | number) {
    this.filters.push((r) => (read(r, col) as string | number) <= v);
    return this;
  }
  in(col: string, vs: unknown[]) {
    this.filters.push((r) => vs.includes(read(r, col)));
    return this;
  }
  is(col: string, v: null) {
    this.filters.push((r) => (read(r, col) ?? null) === v);
    return this;
  }
  not(col: string, op: string, v: unknown) {
    if (op !== 'is') throw new Error(`fake supabase: not(${op}) not supported`);
    this.filters.push((r) => (read(r, col) ?? null) !== v);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orders.push({ col, asc: opts?.ascending ?? true, nullsFirst: opts?.nullsFirst ?? false });
    return this;
  }
  limit(n: number) {
    this.max = n;
    return this;
  }
  single() {
    this.one = 'single';
    return this;
  }
  maybeSingle() {
    this.one = 'maybe';
    return this;
  }

  private run(): { data: unknown; error: { message: string } | null; count?: number | null } {
    if (fake.missing.has(this.table)) return { data: null, error: { message: `relation "public.${this.table}" does not exist` } };
    const rows = (fake.tables[this.table] ??= []);
    const now = new Date().toISOString();
    let result: Row[] = [];

    if (this.action === 'insert') {
      result = this.payload.map((r) => ({ id: `${this.table}_${++seq}`, created_at: now, updated_at: now, ...r }));
      rows.push(...result);
    } else if (this.action === 'upsert') {
      for (const r of this.payload) {
        const at = rows.findIndex((x) => this.conflict.every((c) => x[c] === r[c]));
        if (at >= 0) rows[at] = { ...rows[at], ...r };
        else rows.push({ created_at: now, ...r });
        result.push(at >= 0 ? rows[at] : rows[rows.length - 1]);
      }
    } else {
      const matching = rows.filter((r) => this.filters.every((f) => f(r)));
      if (this.action === 'update') {
        for (const r of matching) Object.assign(r, this.patch);
        result = matching;
      } else if (this.action === 'delete') {
        fake.tables[this.table] = rows.filter((r) => !matching.includes(r));
        result = matching;
      } else {
        result = matching;
      }
    }

    if (this.action === 'select' || this.returning) {
      result = [...result].sort((a, b) => {
        for (const o of this.orders) {
          const x = read(a, o.col) as string | number | null, y = read(b, o.col) as string | number | null;
          if (x === y) continue;
          if (x == null) return o.nullsFirst ? -1 : 1;
          if (y == null) return o.nullsFirst ? 1 : -1;
          return (x < y ? -1 : 1) * (o.asc ? 1 : -1);
        }
        return 0;
      });
      const count = result.length;
      if (this.max !== undefined) result = result.slice(0, this.max);
      const data = this.head ? null : result.map((r) => pick(r, this.columns));
      if (this.one) {
        if (this.one === 'single' && (data as Row[]).length !== 1) return { data: null, error: { message: 'not exactly one row' } };
        return { data: (data as Row[])[0] ?? null, error: null };
      }
      return { data, error: null, ...(this.counting ? { count } : {}) };
    }
    return { data: null, error: null };
  }

  then<A = { data: unknown; error: { message: string } | null }, B = never>(
    ok?: ((v: { data: unknown; error: { message: string } | null; count?: number | null }) => A | PromiseLike<A>) | null,
    bad?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve()
      .then(() => this.run())
      .then(ok, bad);
  }
}

export function createClient(_url: string, _key: string, _opts?: unknown) {
  return {
    from: (table: string) => new Query(table),
    rpc: async (name: string) => ({ data: null, error: { message: `fake supabase: no rpc ${name}` } }),
    auth: {
      getUser: async (jwt: string) => {
        const user = fake.users[jwt];
        return user ? { data: { user }, error: null } : { data: { user: null }, error: { message: 'invalid jwt' } };
      },
    },
  };
}

export type SupabaseClient = ReturnType<typeof createClient>;
