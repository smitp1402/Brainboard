# TypeScript concepts used in this codebase

A short tour of the TypeScript features `brainboard-mcp` relies on, each anchored to
the line that uses it. Read it alongside the source — every example below is real code
from `src/`, not a toy.

**The one idea to hold onto:** TypeScript types exist only at compile time. They are
erased from the emitted JavaScript. Anything that must be true *at runtime* — an env
var is present, an API response has the right shape — needs a real runtime check
(`instanceof`, `Object.freeze`, Zod). Types catch your mistakes; validators catch the
world's.

---

## 1. Type annotations and inference

```ts
const main = async (): Promise<void> => { ... }
```

[`src/index.ts:14`](../src/index.ts#L14)

`: Promise<void>` is the **return type**. An `async` function always returns a Promise;
`void` means "resolves with nothing useful".

You don't annotate everything. `const config = loadConfig()` needs no annotation —
TypeScript **infers** `Config` from the function's return type. The rule of thumb in
this codebase: annotate function signatures (the contract), let bodies infer.

---

## 2. `interface` — the shape of an object

```ts
export interface Config {
  readonly apiKey: string;
  readonly region: Region;
  readonly baseUrl: string;
  readonly authScheme: AuthScheme;
  readonly requestTimeoutMs: number;
}
```

[`src/config.ts:27`](../src/config.ts#L27)

A compile-time contract describing a plain object. `readonly` stops reassignment —
`config.apiKey = "x"` is a compile error.

`readonly` is compile-time only, which is why [`config.ts:85`](../src/config.ts#L85)
also calls `Object.freeze(...)`: the interface protects you from your own typos, the
freeze protects the object at runtime.

`RequestOptions` at [`client.ts:24`](../src/client.ts#L24) shows optional members:

```ts
readonly body?: unknown;
readonly form?: FormData;
```

The `?` means the key may be absent, so the type is really `unknown | undefined`.
Consumers must handle the missing case — see the `if (options.form)` branch at
[`client.ts:99`](../src/client.ts#L99).

---

## 3. Union types and string literal types

```ts
export type AuthScheme = "auto" | "raw" | "bearer";
```

[`src/config.ts:25`](../src/config.ts#L25)

A value of this type must be **exactly one of those three strings**. `"Bearer"` is a
type error. This is TypeScript's idiomatic replacement for `enum`: it compiles to
nothing, and the values are ordinary strings you can log, compare, and put in JSON.

The same pattern appears inline on `RequestOptions.method`:
`readonly method: "GET" | "POST"` — [`client.ts:25`](../src/client.ts#L25).

**Why it pays off:** a `switch` over a union is exhaustively checkable. If you add
`"digest"` to `AuthScheme`, every place that handles all three cases starts failing to
compile until you handle the fourth.

---

## 4. `as const` + `keyof typeof` — deriving a type from data

```ts
export const REGION_HOSTS = {
  us1: "https://api.us1.brainboard.co",
  apac1: "https://api.apac1.brainboard.co",
} as const;

export type Region = keyof typeof REGION_HOSTS;   // "us1" | "apac1"
```

[`src/config.ts:10-15`](../src/config.ts#L10-L15)

Read the type expression inside-out:

| piece | meaning |
| --- | --- |
| `REGION_HOSTS` | the **value** (a real object at runtime) |
| `typeof REGION_HOSTS` | its **type**, in type-space |
| `keyof ...` | the union of its key names → `"us1"` or `"apac1"` |

`as const` tells TypeScript to keep the literal types (`"https://api.us1..."`) instead
of widening them to `string`, and to mark every property `readonly`.

**Why this matters:** the list of regions is written once. Add `eu1` to the object and
`Region` gains `"eu1"` automatically — no second list to forget. `cloneRequestFields` at
[`schemas.ts:24-34`](../src/schemas.ts#L24-L34) uses `as const` for the same reason: one
definition, reused across three tools.

---

## 5. Type guards — teaching the compiler what you just proved

```ts
const isRegion = (value: string): value is Region => value in REGION_HOSTS;
```

[`src/config.ts:42`](../src/config.ts#L42)

`value is Region` is a **type predicate**. It says: "if this function returns true, the
caller may treat `value` as a `Region`."

That unlocks the code that follows:

```ts
if (!isRegion(rawRegion)) throw new ConfigError(...);
// from here on, rawRegion is Region, not string
const baseUrl = env.BRAINBOARD_BASE_URL?.trim() || REGION_HOSTS[rawRegion];
```

[`src/config.ts:70-83`](../src/config.ts#L70-L83)

Without the predicate, `REGION_HOSTS[rawRegion]` would not compile — an arbitrary
`string` is not a valid key. This is **narrowing**: shrinking a broad type to a precise
one by way of a check the compiler understands.

---

## 6. `unknown` vs `any` — and narrowing with `instanceof`

```ts
const describe = (error: unknown): string => {
  if (error instanceof BrainboardApiError) {
    switch (error.status) { ... }        // error.status is available here
  }
  return error instanceof Error ? error.message : String(error);
};
```

[`src/result.ts:25-44`](../src/result.ts#L25-L44)

| | meaning |
| --- | --- |
| `any` | "stop type-checking this" — every operation is allowed, every bug slips through |
| `unknown` | "could be anything, and you must prove what it is before touching it" |

Catch blocks and `.catch()` handlers get `unknown` because JavaScript lets you `throw`
literally any value — a string, `null`, an object. `instanceof` is the runtime check
that narrows it, and TypeScript follows along: inside the `if`, `error.status` and
`error.path` are known to exist.

The same trick drives startup error handling — `error instanceof ConfigError` at
[`index.ts:30`](../src/index.ts#L30) separates "you forgot the API key" from "something
else exploded", so each gets its own message.

**Rule:** prefer `unknown` at every boundary. Reach for `any` only to silence a broken
third-party type, and comment why.

---

## 7. Optional chaining `?.` and nullish coalescing `??`

```ts
const apiKey = env.BRAINBOARD_API_KEY?.trim();          // string | undefined
const rawRegion = (env.BRAINBOARD_REGION ?? "us1").trim().toLowerCase();
```

[`src/config.ts:60-69`](../src/config.ts#L60-L69)

- `?.` — call `.trim()` only if the left side isn't `null`/`undefined`; otherwise the
  whole expression is `undefined`. No `TypeError`.
- `??` — supply a default **only** for `null`/`undefined`.

`??` is not `||`. `||` also fires on `""`, `0`, and `false`. For env vars that
distinction matters: `BRAINBOARD_TIMEOUT_MS=0` should be rejected as invalid, not
silently replaced by a default.

Note the deliberate exception at [`config.ts:83`](../src/config.ts#L83): `||` is used for
`baseUrl` precisely *because* an empty string should fall through to the region default.

`??` also appears as a read-only accessor default:
`return this.resolvedScheme ?? "auto"` — [`client.ts:61`](../src/client.ts#L61).

---

## 8. Generics — types that take a parameter

```ts
async request<T>(options: RequestOptions): Promise<T>

get<T>(path: string): Promise<T> {
  return this.request<T>({ method: "GET", path });
}
```

[`src/client.ts:64`](../src/client.ts#L64), [`client.ts:146`](../src/client.ts#L146)

`<T>` is a **type parameter** — a placeholder the caller fills in.
`client.get<Project[]>("/projects")` returns `Promise<Project[]>`; the same function with
a different `T` returns something else. One implementation, many precise signatures.

You have already been using generics: `Promise<void>`, `Array<Exclude<AuthScheme, "auto">>`
([`client.ts:65`](../src/client.ts#L65)), `Record<string, string>`
([`client.ts:93`](../src/client.ts#L93)). A generic is just a type with a slot in it.

**The honest caveat**, visible at [`client.ts:76`](../src/client.ts#L76):

```ts
return (await this.parse(response)) as T;
```

`as T` is an **assertion** — a promise to the compiler, not a check. The HTTP response is
genuinely `unknown`, and nothing verifies it matches `T`. Generics document intent here;
they do not validate. That job belongs to Zod (§12).

---

## 9. Utility types — `Exclude`, `Record`

```ts
private resolvedScheme: Exclude<AuthScheme, "auto"> | undefined;
```

[`src/client.ts:46`](../src/client.ts#L46)

`Exclude<AuthScheme, "auto">` subtracts a member from a union, giving `"raw" | "bearer"`.
It encodes a real invariant: `"auto"` is a *configuration* value meaning "figure it out",
never a *resolved* value you can put in a header. The type makes it impossible to confuse
the two.

`Record<string, string>` at [`client.ts:93`](../src/client.ts#L93) is an object whose keys
and values are all strings — the shape of an HTTP header bag.

Both are built into TypeScript. Others worth knowing: `Partial<T>`, `Required<T>`,
`Pick<T, K>`, `Omit<T, K>`, `ReturnType<F>`.

---

## 10. Functions as parameters (higher-order functions)

```ts
export const runTool = async (fn: () => Promise<unknown>): Promise<ToolResult> => {
  try {
    return ok(await fn());
  } catch (error) {
    return text(describe(error), true);
  }
};
```

[`src/result.ts:47`](../src/result.ts#L47)

`fn: () => Promise<unknown>` is a **function type**: takes no arguments, returns a
Promise. Callers pass a thunk:

```ts
async () => runTool(() => client.get("/projects"))
```

[`src/tools/projects.ts:19`](../src/tools/projects.ts#L19)

The arrow `() => client.get(...)` defers the call so `runTool` can wrap it in one
try/catch. Every tool in the server routes through this single function, which is why an
API failure reaches the model as readable text instead of crashing the tool call.

`registerAllTools(server, client)` at [`tools/index.ts:11`](../src/tools/index.ts#L11) is
the same idea one level up: functions passed around and composed, typed by their
signatures.

---

## 11. Classes: `extends`, `private`, `readonly`, getters

```ts
export class BrainboardApiError extends Error {
  readonly status: number;
  readonly path: string;
  readonly body: string;

  constructor(status: number, path: string, body: string) {
    super(...);
    this.name = "BrainboardApiError";
    ...
  }
}
```

[`src/client.ts:10`](../src/client.ts#L10)

Subclassing `Error` creates a distinct type that survives to runtime, so
`error instanceof BrainboardApiError` works and the extra fields (`status`, `path`) are
typed. `ConfigError` at [`config.ts:35`](../src/config.ts#L35) does the same for startup
failures. Two error classes, two different handlers — no string matching on messages.

`BrainboardClient` shows the rest:

- `private readonly config: Config` — [`client.ts:39`](../src/client.ts#L39). `private` is
  compile-time encapsulation; nothing outside the class may read it.
- `private resolvedScheme` — [`client.ts:46`](../src/client.ts#L46). Mutable *internal*
  state, deliberately not exposed.
- `get baseUrl(): string` — [`client.ts:55`](../src/client.ts#L55). A **getter**: reads
  like a property (`client.baseUrl`), runs like a method. Used here to publish a read-only
  view of private state.

---

## 12. Zod — runtime validation that also produces types

```ts
export const uuid = z.string().uuid();
export const visibility = z.enum(["public", "organization"]);
export const projectRole = z.enum(["admin", "guest"]);
```

[`src/schemas.ts`](../src/schemas.ts)

This is the payoff of the opening idea. Types vanish at compile time, so they cannot check
data that arrives at runtime — an MCP client's tool arguments, an HTTP body, an env var.
Zod schemas are **values**: they exist at runtime and actually inspect the data.

```ts
inputSchema: z.object({
  project_uuid: uuid.describe("Project UUID, from brainboard_list_projects."),
}),
```

[`src/tools/projects.ts:28-30`](../src/tools/projects.ts#L28-L30)

Three things happen at once here:

1. **Runtime validation** — a malformed UUID is rejected before it reaches the API.
2. **Static typing** — the handler's `({ project_uuid })` parameter is typed `string`,
   inferred from the schema. One definition, no drift between check and type.
3. **Documentation** — `.describe()` text is sent to the model as the parameter's
   description, so the schema doubles as the tool's API docs.

`z.infer<typeof projectRole>` would give you `"admin" | "guest"` — the static type
extracted from the runtime validator. That's the direction to prefer: define the schema,
derive the type. Never maintain both by hand.

**Where each belongs in this codebase:** Zod at the boundaries (tool inputs), plain
interfaces internally (`Config`, `ToolResult`, `RequestOptions`).

---

## 13. Index signatures

```ts
export interface ToolResult {
  readonly content: Array<{ type: "text"; text: string }>;
  readonly isError?: boolean;
  [key: string]: unknown;
}
```

[`src/result.ts:10-14`](../src/result.ts#L10-L14)

`[key: string]: unknown` means "any additional string key is permitted, with an `unknown`
value." It exists here to satisfy the MCP SDK's looser expected result shape while keeping
`content` and `isError` precisely typed.

Use it sparingly — it weakens typo detection, since any key is now legal.

Also note the inline object type inside the array: `{ type: "text"; text: string }`. The
`type` field is pinned to the literal `"text"`, so `{ type: "txt", ... }` won't compile.

---

## 14. `import type` — erased imports

```ts
import type { AuthScheme, Config } from "./config.js";
```

[`src/client.ts:8`](../src/client.ts#L8)

`import type` imports only the types and is fully removed from the emitted JavaScript. No
runtime module is loaded.

Compare [`config.ts`](../src/config.ts), which is imported *both* ways across the project:
`import { ConfigError, loadConfig }` in [`index.ts:11`](../src/index.ts#L11) (values —
needed at runtime), `import type { Config }` in `client.ts` (types only).

Using it deliberately prevents accidental circular imports and keeps the compiled output
honest about what it actually depends on.

---

## 15. `.js` extensions on `.ts` imports

```ts
import { BrainboardClient } from "./client.js";
```

[`src/index.ts:10`](../src/index.ts#L10)

The file on disk is `client.ts`, but the import says `.js`. That is correct, not a typo:
this project emits native ES modules, and Node's ESM resolver requires the extension of the
file that will exist *after* compilation. TypeScript deliberately does not rewrite import
paths, so you write the output name yourself.

---

## Quick reference

| Concept | Where to look |
| --- | --- |
| Return type annotation | [`index.ts:14`](../src/index.ts#L14) |
| `interface` + `readonly` | [`config.ts:27`](../src/config.ts#L27) |
| String literal union | [`config.ts:25`](../src/config.ts#L25) |
| `as const` + `keyof typeof` | [`config.ts:10-15`](../src/config.ts#L10-L15) |
| Type guard (`x is T`) | [`config.ts:42`](../src/config.ts#L42) |
| `unknown` + `instanceof` narrowing | [`result.ts:25`](../src/result.ts#L25) |
| `?.` and `??` | [`config.ts:60`](../src/config.ts#L60) |
| Generic method `<T>` | [`client.ts:64`](../src/client.ts#L64) |
| `Exclude` / `Record` | [`client.ts:46`](../src/client.ts#L46), [`client.ts:93`](../src/client.ts#L93) |
| Function-typed parameter | [`result.ts:47`](../src/result.ts#L47) |
| `class ... extends Error` | [`client.ts:10`](../src/client.ts#L10) |
| `private` / getters | [`client.ts:39`](../src/client.ts#L39), [`client.ts:55`](../src/client.ts#L55) |
| Zod schema to runtime + static type | [`schemas.ts`](../src/schemas.ts), [`tools/projects.ts:28`](../src/tools/projects.ts#L28) |
| Index signature | [`result.ts:13`](../src/result.ts#L13) |
| `import type` | [`client.ts:8`](../src/client.ts#L8) |
| `.js` extension in imports | [`index.ts:10`](../src/index.ts#L10) |
