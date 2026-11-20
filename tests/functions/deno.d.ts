// What the functions use from Deno, so `npm run typecheck` can read them (their npm: imports are mapped to the
// same packages in node_modules by tests/tsconfig.json; in the tests themselves they are the fakes).
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};
