/**
 * mock-supabase.ts — a tiny chainable fake of the supabase-js client for
 * unit tests. Every query builder call is recorded; awaiting the chain asks
 * the test's handler for the result. SQL behaviour itself is tested against
 * real Postgres in supabase/tests/.
 */
export interface MockResult {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
}

export interface RecordedQuery {
  table: string;
  calls: Array<{ method: string; args: unknown[] }>;
  /** Convenience: first-arg values of every call to `method` */
  argsOf(method: string): unknown[];
  has(method: string): boolean;
}

type FromHandler = (q: RecordedQuery) => MockResult;
type RpcHandler = (args: Record<string, unknown>) => MockResult;

export function mockSupabase(opts: {
  from?: FromHandler;
  rpc?: Record<string, RpcHandler>;
}) {
  const queries: RecordedQuery[] = [];
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];

  function builder(table: string) {
    const q: RecordedQuery = {
      table,
      calls: [],
      argsOf: (m) => q.calls.filter((c) => c.method === m).map((c) => c.args[0]),
      has: (m) => q.calls.some((c) => c.method === m),
    };
    queries.push(q);
    const resolve = () => {
      const r = opts.from ? opts.from(q) : {};
      return { data: r.data ?? null, error: r.error ?? null, count: r.count ?? null };
    };
    const proxy: unknown = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === 'then') {
            return (ok: (v: unknown) => unknown, fail: (e: unknown) => unknown) =>
              Promise.resolve(resolve()).then(ok, fail);
          }
          return (...args: unknown[]) => {
            q.calls.push({ method: prop, args });
            return proxy;
          };
        },
      },
    );
    return proxy;
  }

  const client = {
    from: jest.fn((table: string) => builder(table)),
    rpc: jest.fn(async (fn: string, args: Record<string, unknown> = {}) => {
      rpcCalls.push({ fn, args });
      const handler = opts.rpc?.[fn];
      if (!handler) throw new Error(`unexpected rpc ${fn}`);
      const r = handler(args);
      return { data: r.data ?? null, error: r.error ?? null };
    }),
    auth: {
      signInWithOtp: jest.fn(),
      verifyOtp: jest.fn(),
      getUser: jest.fn(),
    },
  };

  return { client, queries, rpcCalls };
}

/** SupabaseProvider stand-in. `authClient` is what createAuthClient() returns. */
export function mockProvider(client: unknown, authClient: unknown = client) {
  return { getClient: () => client, createAuthClient: jest.fn(() => authClient) };
}
