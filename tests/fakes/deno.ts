// What the Supabase functions expect from Deno and the edge runtime, for the function tests.
// Call setupDeno() before importing a function: it keeps the request handler the function registers.

type Handler = (req: Request) => Promise<Response> | Response;

export const edge = {
  handler: null as Handler | null,
  env: {} as Record<string, string>,
  /** Work a function started after answering (EdgeRuntime.waitUntil). */
  background: [] as Promise<unknown>[],
};

export function setupDeno(env: Record<string, string>) {
  edge.env = { SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service', ...env };
  (globalThis as Record<string, unknown>).Deno = {
    env: { get: (k: string) => edge.env[k] },
    serve: (h: Handler) => {
      edge.handler = h;
    },
  };
  (globalThis as Record<string, unknown>).EdgeRuntime = {
    waitUntil: (p: Promise<unknown>) => {
      edge.background.push(p);
    },
  };
}

/** A POST to the function, as the app sends it (supabase.functions.invoke). */
export async function call(body: unknown, jwt = 'athlete-jwt'): Promise<{ status: number; json: Record<string, unknown> }> {
  if (!edge.handler) throw new Error('no function loaded');
  const res = await edge.handler(
    new Request('https://fake.supabase.co/functions/v1/fn', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

/** Waits for the background work the last calls started. */
export async function settle() {
  const work = edge.background.splice(0);
  await Promise.all(work);
}
