# Actyx RPC

**Type-safe RPC for composable server actions in TypeScript.**

Actyx RPC lets you build server-side procedures with full type safety, minimal boilerplate, and a clean, composable API.

- 🔒 End-to-end type safety
- ⚡ Built for server actions
- 🧩 Composable middleware & plugins
- 🧠 Flexible input modes (strict, form, partial)
- 🛡️ Resilience with Retries, Timeouts, and Circuit Breakers
- 📊 Built-in OpenTelemetry instrumentation
- 🔌 Works with optional Zod, Valibot, ArkType, Joi, Yup resolvers, and custom resolver of your choice.

---

## Why Actyx?

Traditional APIs force you to choose between flexibility and type safety.

Actyx gives you both.

Define a procedure once, and get:

- fully typed inputs
- validated data
- reusable logic across your app

No codegen. No schemas leaking everywhere. Just clean, predictable actions.

#

## Installation

```bash
npm install @explita/actyx-rpc
```

Install the resolver library you want to use as a peer dependency: zod, valibot, arktype, joi, yup, or your own custom resolver.

#

## Quick Start

```ts
import { createProcedure } from "@explita/actyx-rpc";
import { z } from "zod";
import { zodResolver } from "@explita/actyx-rpc/resolver/zod";

const procedure = createProcedure({
  async createContext() {
    return {
      ok: true,
      ctx: {
        userId: "user_123",
        role: "admin",
      },
    };
  },
  enrichInput(ctx) {
    return { userId: ctx.userId };
  },
  async onError(props) {
    console.error("Procedure error", props);
  },
  inputMode: "form", // "strict" | "form" | "partial"
});

const createPost = procedure
  .input(
    zodResolver(
      z.object({
        title: z.string().min(1, "Title is required"),
        body: z.string().min(10, "Body is too short"),
      }),
    ),
  )
  .mutation(async ({ ctx, input }) => {
    // Your db operations here.
    // For example:
    // const post = await db.posts.create({
    //   data: {
    //     title: input.title,
    //     body: input.body,
    //     authorId: ctx.userId,
    //   },
    // });

    return {
      success: true,
      data: {
        id: "post_1",
        title: input.title,
        body: input.body,
        authorId: ctx.userId,
      },
    };
  });

const [result, error] = await createPost({
  title: "Hello world",
  body: "This is my first post.",
});

const getPost = procedure
  .input(
    zodResolver(
      z.object({
        id: z.string().min(1, "Post id is required"),
      }),
    ),
  )
  .query(async ({ ctx, input }, includeDrafts: boolean) => {
    // Your db operations here.
    // For example:
    // const post = await db.posts.findUnique({
    //   where: {
    //     id: input.id,
    //   },
    //   include: {
    //     author: true,
    //   },
    // });

    return {
      id: input.id,
      authorId: ctx.userId,
      includeDrafts,
    };
  });

const [post, error] = await getPost({ id: "post_1" }, true);
```

#

## Core Concepts

### `createProcedure()`

Creates a reusable procedure builder around shared server concerns.

```ts
import { createProcedure } from "@explita/actyx-rpc";

const procedure = createProcedure({
  async createContext() {
    const session = await getSession();

    if (!session) {
      return { ok: false, reason: "UNAUTHORIZED" };
    }

    return {
      ok: true,
      ctx: {
        userId: session.user.id,
      },
    };
  },
  onContextError({ reason }) {
    if (reason === "INVALID_SESSION") {
      return {
        _redirect: () => redirect("/login"),
        message: "Session expired",
      };
    }
  },
  onSuccess({ ctx, input, output, duration }) {
    console.log("Procedure completed", { ctx, input, output, duration });
  },
  inputMode: "strict", // "strict" | "patch" | "form" | "partial"
});
```

`inputMode` is the default input mode for all procedures created from this builder.
This can be overridden by the `.input()` method.

`onContextError` is called when `createContext` returns `{ ok: false }`. It receives the `reason` and current `ctx`. If it returns an object, that object is merged into the error response.

**Next.js Redirects**: You can return a `_redirect` callback to trigger a top-level redirect (e.g., using `next/navigation`). This is executed at the very start of the procedure response before returning to the caller.

The `ctx` object passed to handlers, middlewares, and plugins automatically includes `handlerName` (if provided via `.name()`).

`onSuccess` is a function that is called when the procedure completes successfully. It receives the context, input, output, and duration of the procedure.

`onError` is a function that is called when the procedure fails. It receives the context, input, error, and extra args passed to the procedure.

### Global Error Mapping

The `onError` hook is a powerful way to centralize error handling. The best way to use it is to **let your handlers throw naturally** instead of wrapping every handler in a `try/catch` block.

Mapping internal exceptions (like database errors) to user-friendly responses in one place keeps your handler logic clean and focused. If `onError` returns an object, that object becomes the official error response returned by the procedure.

```ts
const procedure = createProcedure({
  // ...
  onError({ error, ctx }) {
    // If the procedure has a .name("..."), it's available in ctx.handlerName
    console.error(`Error in ${ctx.handlerName}:`, error);

    // Map Prisma unique constraint violations globally
    if (error.code === "P2002") {
      return {
        success: false,
        message: "Conflict detected",
        reason: "VALIDATION_ERROR",
        errors: {
          [error.meta.target[0]]: "This value is already taken",
        },
      };
    }
  },
});

// Now handlers can be clean and simple:
const createUser = procedure.input(resolver).mutation(async ({ input }) => {
  // Just throw! No try/catch needed here.
  return await db.user.create({ data: input });
});
```

This ensures that your business logic isn't cluttered with repetitive error-handling boilerplate, while `actyx-rpc` ensures every error is transformed into a consistent format for your client.

#

`createProcedure()` also accepts optional root-level `middlewares` and `plugins`, which run for every procedure created from that builder.

```ts
const procedure = createProcedure({
  async createContext() {
    return {
      ok: true,
      ctx: { userId: "user_123" },
    };
  },
  middlewares: [({ next }) => next()],
  plugins: [
    {
      async onAfter(ctx, result) {
        console.log("Completed procedure", { ctx, result });
      },
    },
  ],
});
```

#

### `.extend()`

Create a new procedure builder by extending an existing one. This allows for powerful context and input inheritance.

- **`createContext`**: Receives the `previous` context from the parent, allowing you to chain or modify it.
- **`enrichInput`**: Receives an object containing both the current `ctx` and the `previous` enriched data.

```ts
const base = procedure.extend({
  createContext: async (previous) => {
    // Authenticate and add to context
    return { ok: true, ctx: { ...previous, user: { id: 1 } } };
  },
  enrichInput: async ({ ctx, previous }) => {
    // Access previous enrichment and current context
    return { ...previous, tenantId: ctx.user.tenantId };
  },
});
```

```ts
const baseProcedure = createProcedure({
  async createContext() {
    return {
      ok: true,
      ctx: {
        userId: "user_123",
        role: "member",
      },
    };
  },
  enrichInput(ctx) {
    return { userId: ctx.userId };
  },
});

const adminProcedure = baseProcedure.extend({
  middlewares: [
    ({ ctx, next }) => {
      if (ctx.role !== "admin") {
        return { role: "Admin access required" };
      }

      return next();
    },
  ],
  onError(props) {
    console.error("Admin procedure error", props);
  },
});

const deletePost = adminProcedure
  .input(
    zodResolver(
      z.object({
        id: z.string().min(1),
      }),
    ),
  )
  .mutation(async ({ ctx, input }) => {
    return {
      success: true,
      data: {
        deletedId: input.id,
        deletedBy: ctx.userId,
      },
    };
  });
```

`extend()` keeps the original procedure intact and returns a new one.

- `middlewares` are appended
- `plugins` are appended
- `createContext`, `onContextError`, `enrichInput`, and `onError` can be overridden

#

### `.name()`

Provides a unique identifier for the procedure. This name is automatically attached to the context as `handlerName` and included in error responses, making it invaluable for debugging and auditing.

> [!NOTE]
> Actyx-RPC strictly infers the exact string literal you provide here! The `ctx.handlerName` inside your handlers and plugins will be strongly typed to match the name (e.g. `"getUserProfile"` instead of `string`).

```ts
const getUser = procedure.name("getUserProfile").query(async ({ ctx }) => {
  // ctx.handlerName is strictly typed as "getUserProfile"
  // ...
});
```

### `.meta()`

Attaches arbitrary metadata to a procedure. This is useful for authorization roles, audit flags, or UI hints. Metadata is deeply merged with full type-safety during `.extend()` and `.meta()`. All handlers and lifecycle hooks instantly inherit the fully merged `ctx.meta` type.

```ts
const root = createProcedure({
  createContext: () => ({ ok: true, ctx: {} }),
  meta: { app: "store-api" },
});

const uploadImage = root
  .meta({ role: "admin", audit: true })
  .mutation(async ({ ctx }) => {
    console.log(ctx.meta.role); // "admin"
    console.log(ctx.meta.app); // "store-api"
  });
```

#

### `.circuitBreaker()`

Protects your system from cascading failures by "tripping" when a procedure fails repeatedly. When open, subsequent calls fail fast with `CIRCUIT_OPEN`.

| Option             | Type       | Default | Description                         |
| :----------------- | :--------- | :------ | :---------------------------------- |
| `failureThreshold` | `number`   | `5`     | Failures before opening the circuit |
| `resetTimeout`     | `number`   | `30000` | Cooldown in ms before trying again  |
| `onStateChange`    | `function` |         | Callback for state transitions      |

```ts
const fetchService = procedure
  .name("inventory")
  .circuitBreaker({
    failureThreshold: 3,
    resetTimeout: 60000, // 1 minute
    onStateChange: (state, name) => console.log(`${name} is now ${state}`)
  })
  .query(async () => { ... });
```

#

### `.telemetry()`

Enables built-in OpenTelemetry instrumentation for the procedure. It automatically creates spans for the request lifecycle, recording successes and exceptions.

> [!NOTE]
> Requires `@opentelemetry/api` to be installed in your project. If the package is missing, `.telemetry()` will safely fall back to a no-op mode (no data emitted, no runtime errors).

```ts
const tracedProc = procedure
  .name("processOrder")
  .telemetry()
  .mutation(async () => { ... });
```

#

### `.input()`

Adds a schema resolver to validate and infer input types.

```ts
const updateProfile = procedure
  .input(
    zodResolver(
      z.object({
        name: z.string().min(1),
        bio: z.string().optional(),
      }),
    ),
    { mode: "strict" },
  )
  .mutation(async ({ input }) => {
    return {
      success: true,
      data: input,
    };
  });
```

The payload can be a plain object or `FormData`. `FormData` is normalized with `Object.fromEntries(...)` before validation. If no payload is passed, the procedure internally treats the input as `{}`.

The optional second argument to `.input()` controls how the mutation input is typed. If set, it overrides global input mode.

- `strict` (Default): Uses the exact inferred schema shape.
- `patch`: Uses a partial object shape with strict inferred types for each key.
- `form`: Uses a loose object shape where every declared key is `unknown`.
- `partial`: Uses a loose partial object shape for maximum flexibility.

```ts
const schema = z.object({
  name: z.string().min(1),
  age: z.number(),
});

const strictAction = procedure
  .input(zodResolver(schema), { mode: "strict" }) // or omit it if global input mode is "strict"
  .mutation(async ({ input }) => {
    return { success: true, data: input };
  });

await strictAction({
  name: "Ade",
  age: 32,
});

const formAction = procedure
  .input(zodResolver(schema), { mode: "form" })
  .mutation(async ({ input }) => {
    return { success: true, data: input };
  });

await formAction({
  name: "Ade",
  age: "32",
});

const partialAction = procedure
  .input(zodResolver(schema), { mode: "partial" })
  .mutation(async ({ input }) => {
    return { success: true, data: input };
  });

await partialAction({
  name: "Ade",
});
```

Use `strict` when the caller already has correctly typed data, `form` when values may still be raw strings or browser form entries, and `partial` when you want a looser patch-style caller API.

Input mode set by `createProcedure()` is the default, and the chosen mode only changes the caller-side input type. The handler still receives the resolver-parsed `input`.

#

### `.mutation()` and `.query()`

Use `.mutation()` for write-style procedures and `.query()` for read-style procedures.

Both APIs support:

- a handler that receives `{ ctx, input }` as the first argument
- additional typed arguments after that first handler argument
- additional typed arguments at call time after the input payload

Mutation example:

```ts
const publishPost = procedure
  .input(
    zodResolver(
      z.object({
        id: z.string(),
      }),
    ),
  )
  .mutation(async ({ ctx, input }, notifyFollowers: boolean) => {
    return {
      success: true,
      data: {
        id: input.id,
        publishedBy: ctx.userId,
        notifyFollowers,
      },
    };
  });

await publishPost({ id: "post_1" }, true);
```

#

Query example:

```ts
const getPost = procedure
  .input(
    zodResolver(
      z.object({
        id: z.string(),
      }),
    ),
  )
  .query(async ({ ctx, input }, previewToken?: string) => {
    return {
      id: input.id,
      requestedBy: ctx.userId,
      previewToken: previewToken ?? null,
    };
  });

await getPost({ id: "post_1" }, "preview_123");
```

#

### `.middleware()`

Creates a reusable, fully typed middleware without attaching it immediately.

Use it when you want to define a middleware once and apply it to multiple procedures with `.use()` or to keep your procedure definition clean.

If your middleware depends on a specific input shape, you can strictly type it using the `ExpectedInput` generic:

```ts
const requirePostOwnership = procedure.middleware<{ postId: string }>(
  async ({ ctx, input, next }) => {
    // input.postId is strictly typed!
    const post = await db.post.find(input.postId);

    if (post.authorId !== ctx.userId) {
      return { _message: "Forbidden", _statusCode: 403 };
    }

    return next({ post });
  },
);
```

const requireSession = procedure.middleware(({ ctx, next }) => {
if (!ctx.userId) {
return { userId: "You must be signed in" };
}

return next();
});

const withTenant = procedure.middleware(async ({ ctx, next }) => {
const tenant = await getTenantForUser(ctx.userId);

if (!tenant) {
return { tenant: "Tenant not found" };
}

return next({
tenantId: tenant.id,
});
});

const [listProjects, error] = procedure
.use(requireSession)
.use(withTenant)
.query(async ({ ctx }) => {
return {
tenantId: ctx.tenantId,
items: [],
};
});

````

#

### `.plugin()`

Creates a reusable, fully typed plugin without attaching it immediately.

Use it when you want to define a plugin once and apply it to multiple procedures with `.use()` or to keep your procedure definition clean.

Just like middlewares, if your plugin depends on a specific input shape, you can strictly type it using the `ExpectedInput` generic:

```ts
const withAudit = procedure.plugin<{ postId: string }>({
  validate: (input) => {
    // input.postId is strictly typed!
    return {
      success: true,
      data: input,
    };
  },
  onBefore: ({ next }) => next({ myPlugin: "plugin" }),
  onAfter: (ctx, result) => {
    console.log("Procedure completed", { ctx, result });
  },
  onError: (props) => {
    console.log("Procedure failed", props);
  },
});
````

#

### `.use()`

Adds either a middleware or a plugin.

#

Middleware example:

```ts
const requireAdmin = procedure.middleware(({ ctx, next }) => {
  if (ctx.role !== "admin") {
    return { role: "Only admins can perform this action" };
  }

  return next();
});

const deletePost = procedure.use(requireAdmin).mutation(async ({ input }) => {
  return {
    success: true,
    data: { deleted: true, id: input.id },
  };
});
```

`next()` can also receive an additional object. That object is merged into the current context and passed to later middlewares and the handler with full type inference.

If a middleware returns a plain object instead of calling `next()`, that object becomes the response `errors`. Any keys in that object starting with a `_` prefix (e.g., `_message`, `_reason`, `_statusCode`) are promoted to the top-level of the error response, removing the underscore.

```ts
const withWorkspace = procedure.middleware(async ({ ctx, next }) => {
  const workspace = await getWorkspaceForUser(ctx.userId);

  if (!workspace) {
    return { _message: "Workspace not found" };
  }

  return next({
    workspaceId: workspace.id,
    workspaceRole: workspace.role,
  });
});

const withAudit = procedure.middleware(({ ctx, next }) => {
  console.log(ctx.workspaceId, ctx.workspaceRole);
  return next();
});

const updateWorkspace = procedure
  .use(withWorkspace)
  .use(withAudit)
  .mutation(async ({ ctx }) => {
    return {
      success: true,
      data: {
        workspaceId: ctx.workspaceId,
        workspaceRole: ctx.workspaceRole,
      },
    };
  });
```

#

Plugin example:

```ts
const auditPlugin = {
  async validate(input) {
    if (!input.userId) {
      return {
        success: false,
        errors: { userId: "Missing user id" },
      };
    }

    return { success: true, data: input };
  },
  async onAfter(ctx, result) {
    console.log("Audit log", { ctx, result });
  },
  async onError(props) {
    console.error("Plugin error", props);
  },
};

const action = procedure.use(auditPlugin).mutation(async ({ input }) => {
  return {
    success: true,
    data: input,
  };
});
```

### Plugin Lifecycle

Plugins can participate in the procedure lifecycle through these hooks:

- `validate(input)` runs before middleware execution
- `onBefore({ ctx, input, next }, ...args)` runs after plain middlewares and can also extend context
- `onAfter(ctx, result)` runs after the handler succeeds
- `onError(props)` runs when execution throws or returns an error object

Just like middleware, if `onBefore()` returns a plain object instead of calling `next()`, that object becomes the response `errors`. Any keys in that object starting with a `_` prefix (e.g., `_message`, `_reason`, `_statusCode`) are promoted to the top-level of the error response.

Execution order is:

1. `createContext()`
2. resolver parsing and input normalization
3. plugin `validate()`
4. plain middlewares
5. plugin `onBefore()`
6. handler
7. plugin `onAfter()`
8. global `onError()` and plugin `onError()` on thrown errors

---

### Builder Ordering

> [!IMPORTANT]
> To ensure your configuration hooks (like `.cache()` or `.rateLimit()`) have access to the fully enriched context and validated input types, always follow this order:
>
> 1. **Setup**: `.name()`, `.meta()`, `.input()`
> 2. **Middlewares**: `.use()`
> 3. **Execution Policies**: `.cache()`, `.retry()`, `.timeout()`, `.rateLimit()`, `.circuitBreaker()`, `.telemetry()`
> 4. **Terminal**: `.query()`, `.mutation()`
>
> Actyx RPC strictly enforces this order at the type level. Once you call an execution policy method, setup methods like `.use()` or `.input()` will no longer be available in the autocomplete for that chain.

#

`.cache()`

Add intelligent caching to your procedures with configurable TTL, stale-while-revalidate, and multiple backends.

### Basic Usage

```ts
import { MemoryCache } from "@explita/actyx-rpc";

const procedure = createProcedure({
  ctx: { userId: "user-123" },
  cache: new MemoryCache({ maxSize: 1000, defaultTTL: 60000 }),
});

const getUser = procedure
  .cache({
    ttl: 60000, // Cache for 60 seconds
    staleTime: 30000, // Become stale after 30 seconds
    staleWhileRevalidate: true, // Return stale while refreshing
    key: (input) => `user:${input.id}`,
    decompress: true, // If you have used .compress earlier, you need to decompress the response here
  })
  .input(z.object({ id: z.string() }))
  .query(async ({ input }) => {
    return db.users.findById(input.id);
  });

// First call - fetches from DB
const [user1] = await getUser({ id: "123" });

// Second call within 30s - returns cached
const [user2] = await getUser({ id: "123" });

// Third call at 45s - returns stale + background refresh
const [user3] = await getUser({ id: "123" });
```

### Cache Options

| Option                 | Type                  | Default          | Description                                            |
| ---------------------- | --------------------- | ---------------- | ------------------------------------------------------ |
| `ttl`                  | `number`              | `60000`          | Time until data is removed from cache (ms)             |
| `staleTime`            | `number`              | `0`              | Time until data becomes stale (ms, `0` = always stale) |
| `staleWhileRevalidate` | `boolean`             | `false`          | Return stale data while fetching fresh in background   |
| `key`                  | `(input) => string`   | `JSON.stringify` | Custom cache key generator                             |
| `onHit`                | `(key, data) => void` | -                | Called when cache hit occurs                           |
| `onMiss`               | `(key) => void`       | -                | Called when cache miss occurs                          |
| `decompress`           | `boolean`             | `false`          | Decompress response on cache hit                       |

#

### Redis Cache

```ts
import Redis from "ioredis";
import { RedisCache } from "@explita/actyx-rpc";

const redis = new Redis({ host: "localhost", port: 6379 });
const redisCache = new RedisCache(redis, {
  prefix: "myapp:cache:",
  defaultTTL: 300, // seconds
});

const procedure = createProcedure({
  cache: redisCache,
});
```

#

### Custom Cache Adapter

```ts
interface CacheAdapter {
  get<T>(key: string): Promise<T | undefined> | T | undefined;
  set<T>(
    key: string,
    data: T,
    options?: { ttl?: number; staleTime?: number },
  ): Promise<void> | void;
  isStale(key: string): Promise<boolean> | boolean;
  delete(key: string): Promise<boolean> | boolean;
  clear(): Promise<void> | void;
}
```

#

`.invalidate()`

Automatically invalidate cache entries after a successful mutation.

```ts
const updatePost = procedure
  .input(z.object({ id: z.string(), title: z.string() }))
  .invalidate({
    keys: ({ input }) => [`post:${input.id}`, "posts:list"],
    tags: ["posts"],
  })
  .mutation(async ({ input }) => {
    // ... update database
    return { success: true };
  });
```

### Invalidation Options

| Option     | Type                                  | Default | Description                                                |
| ---------- | ------------------------------------- | ------- | ---------------------------------------------------------- |
| `keys`     | `string \| string[] \| (opts) => ...` | -       | Single key or list of keys to remove from cache.           |
| `patterns` | `string \| string[] \| (opts) => ...` | -       | Glob patterns (if using a cache adapter that supports it). |
| `tags`     | `string \| string[] \| (opts) => ...` | -       | Tags to invalidate (if using tag-based caching).           |
| `delay`    | `number`                              | `0`     | Delay the invalidation in milliseconds.                    |

#

`.rateLimit()`

Protect your procedures from abuse by limiting the number of requests from a specific user or IP.
Rate limit uses the cache adapter passed to `createProcedure` to store the rate limit data. If you dont provide a key, we will check for `ctx.id` then `ctx.userId` then `ctx.ip` and use that as the key. If none are found, we will use `anonymous` as the key.

#### Basic Usage

```ts
const sendMessage = procedure
  .rateLimit({
    limit: 10,
    window: "1m",
    key: (ctx) => ctx.userId,
  })
  .mutation(async ({ input }) => {
    // ...
  });
```

#### Rate Limit Options

| Option          | Type                             | Default | Description                                            |
| --------------- | -------------------------------- | ------- | ------------------------------------------------------ |
| `limit`         | `number`                         | `100`   | Number of requests allowed per window.                 |
| `window`        | `WindowTime`                     | `"1m"`  | Time window (e.g., "1m", "5m", "1h", "1d").            |
| `key`           | `(ctx) => string`                | -       | Custom key generator (defaults to `userId` then `ip`). |
| `message`       | `string`                         | -       | Custom error message when limited.                     |
| `onRateLimited` | `(key, limit, windowMs) => void` | -       | Callback triggered when a rate limit is hit.           |

#

`.retry()`

Automatically retry failed operations with configurable backoff strategies.

### Basic Usage

```ts
const createOrder = procedure
  .retry({ attempts: 3 })
  .mutation(async ({ input }) => {
    const [result, err] = await api.createOrder(input);
    if (err) return [null, err];
    return [result, null];
  });
```

### Backoff Strategies

```ts
// Exponential backoff (default) - 100ms, 200ms, 400ms
const api1 = procedure.retry({
  attempts: 3,
  backoff: "exponential",
  initialDelay: 100,
  maxDelay: 5000,
});

// Linear backoff - 100ms, 200ms, 300ms, 400ms
const api2 = procedure.retry({
  attempts: 4,
  backoff: "linear",
  initialDelay: 100,
});

// Fixed backoff - 1000ms, 1000ms, 1000ms
const api3 = procedure.retry({
  attempts: 3,
  backoff: "fixed",
  initialDelay: 1000,
});
```

#

### Conditional Retry

```ts
const fetchUser = procedure
  .retry({
    attempts: 5,
    if: (error) => {
      // Only retry on network errors or rate limiting
      return (
        error.reason === "NETWORK_ERROR" ||
        error.reason === "RATE_LIMITED" ||
        error.status >= 500
      );
    },
    onRetry: (error, attempt, delay) => {
      console.log(`Retry ${attempt} after ${delay}ms`);
    },
    onFailed: (error, attempts) => {
      console.error(`Failed after ${attempts} attempts`);
    },
  })
  .query(async ({ input }) => {
    const [result, err] = await db.users.findById(input.id);
    if (err) return [null, err];
    return [result, null];
  });
```

### Retry Options

| Option         | Type                                   | Default         | Description                                          |
| -------------- | -------------------------------------- | --------------- | ---------------------------------------------------- |
| `attempts`     | `number`                               | `3`             | Maximum number of retry attempts                     |
| `backoff`      | `'fixed' \| 'linear' \| 'exponential'` | `'exponential'` | Backoff strategy                                     |
| `initialDelay` | `number`                               | `100`           | Initial delay in milliseconds                        |
| `maxDelay`     | `number`                               | `10000`         | Maximum delay in milliseconds                        |
| `factor`       | `number`                               | `2`             | Multiplication factor for exponential/linear backoff |
| `if`           | `(error) => boolean`                   | Always retry    | Condition to determine if retry should occur         |
| `onRetry`      | `(error, attempt, delay) => void`      | -               | Called before each retry                             |
| `onFailed`     | `(error, attempts) => void`            | -               | Called when all retries exhausted                    |

#

### Combining Cache and Retry

```ts
const getUser = procedure
  .retry({ attempts: 3 }) // Retry on failure
  .cache({ ttl: 60000 }) // Cache successful results
  .query(async ({ input }) => {
    const [result, err] = await db.users.findById(input.id);
    if (err) return [null, err];
    return [result, null];
  });
```

The cache wraps the retry layer, meaning it acts as a short-circuit gate: if a valid cached result exists, execution stops immediately and the retry logic is never reached. Only when there is a cache miss (or stale entry that requires recomputation) does the flow continue into retry and then finally the handler.

- Note: Input validation and middleware run BEFORE cache check.
- This ensures auth and rate limiting apply to all requests,
- including cached ones. Validation overhead is minimal.

#

## Execution Flow

### 🚀 Normal Request (Cache Hit)

request
↓
createContext()
↓
rate limit check
↓
resolver (validation + middleware + plugins)
↓
cache lookup
↓
✔ HIT → return cached result
↓
END (retry + handler are NEVER reached)

### 🔄 Normal Request (Cache Miss)

request
↓
createContext()
↓
rate limit check
↓
resolver (validation + middleware + plugins)
↓
cache lookup
↓
❌ MISS
↓
retry layer
↓
timeout layer
↓
handler execution (+ compression)
↓
result stored in cache
↓
return result

### Stale Cache (Revalidation Case)

`if staleWhileRevalidate is true`

request
↓
resolver (validation + middleware + plugins)
↓
cache lookup
↓
⚠️ STALE HIT
↓
return cached value immediately
↓
background:
retry → timeout → handler → compression → refresh cache

#

`.timeout()`

Set a maximum execution time for your procedures. If the procedure takes longer than the specified time, it will be aborted and return a timeout error.

#### Basic Usage

```ts
const fetchLargeData = procedure
  .timeout({ ms: 2000 }) // Timeout after 2 seconds
  .query(async () => {
    return await heavyTask();
  });
```

#### Timeout Options

| Option      | Type                 | Default             | Description                                    |
| ----------- | -------------------- | ------------------- | ---------------------------------------------- |
| `ms`        | `number`             | `5000`              | Timeout in milliseconds                        |
| `message`   | `string`             | `"Request timeout"` | Error message returned on timeout              |
| `reason`    | `FailureReason`      | `"TIMEOUT"`         | Error reason returned on timeout               |
| `onTimeout` | `(duration) => void` | -                   | Callback triggered when the timeout is reached |

#

`.compress()`

Enable response compression to reduce payload size. It also automatically handles decompression of incoming Buffer inputs.

#### Basic Usage

```ts
const getLargeReport = procedure
  .compress({
    algorithm: "gzip",
    threshold: 2048, // Only compress if response is > 2KB
    compressResponse: true,
  })
  .query(async () => {
    return await generateBigReport();
  });
```

#### Compression Options

| Option             | Type                              | Default  | Description                                         |
| ------------------ | --------------------------------- | -------- | --------------------------------------------------- |
| `algorithm`        | `'gzip' \| 'deflate' \| 'brotli'` | `'gzip'` | The compression algorithm to use                    |
| `threshold`        | `number`                          | `1024`   | Minimum size in bytes to trigger compression        |
| `level`            | `number`                          | `6`      | Compression level (1-9)                             |
| `compressResponse` | `boolean`                         | `false`  | Whether to compress responses                       |
| `onCompress`       | `(original, compressed) => void`  | -        | Callback with size info when compression is applied |

#

## Result Shape

Mutations return `MutationResult<T>`. Queries return `QueryResult<T>`.
Each of them is a tuple of `[data, error]`.

Success shape:

```ts
[
  {
    success: true,
    ...data,
  },
  null,
];
```

Error shape:

```ts
[
  null,
  {
    success: false,
    message: "Validation Error",
    reason: "VALIDATION_ERROR",
    errors: {
      field: "Field is required",
    },
  },
];
```

For middleware and `plugin.onBefore()`, returning a plain object produces this error shape automatically:

```ts
return {
  email: "Email is invalid",
  _message: "Please fix the highlighted fields",
};
```

Which becomes:

```ts
{
  success: false,
  message: "Please fix the highlighted fields",
  reason: "VALIDATION_ERROR",
  errors: {
    email: "Email is invalid",
    _message: "Please fix the highlighted fields",
  },
}
```

Known failure reasons include:

- `UNAUTHORIZED`
- `FORBIDDEN`
- `MAINTENANCE_MODE`
- `VALIDATION_ERROR`
- `UNEXPECTED_ERROR`
- `INVALID_SESSION`
- `ABORTED`
- `INVALID_CACHE_KEY`
- `TIMEOUT`
- `RETRY_EXHAUSTED`
- `CIRCUIT_OPEN`
- `RATE_LIMITED`

#

## RPC Handler Pattern

```ts

  RPC handlers return `[data, null]` on success and `[null, error]` on failure.

  const [data, error] = await createPost({ title: "Hello world" });
  if (error) console.error(error);

  // ✅ Do this (let RPC handle errors)
  const createPost = procedure.mutation(async ({ input }) => {
    const post = await db.posts.create(input);
    return post;
  });

  // ❌ Don't do this (unnecessary try/catch)
  const createPost = procedure.mutation(async ({ input }) => {
    try {
      const post = await db.posts.create(input);
      return post;
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // ⚠️ If you must catch, return an object with `success: false`
  const createPost = procedure.mutation(async ({ input }) => {
    if (input.title.length < 3) {
      return { success: false, message: "Title too short", reason: "VALIDATION_ERROR" };
    }
    return await db.posts.create(input);
  });

  // How it works:
  // - Thrown errors → [null, error] - throw new Error(), throw { success: false }, throw "some string"
  // - Returned { success: false } → [null, error]
  // - Everything else → [data, null]

  // Let your functions throw. RPC handles the rest.
  // You can customize how these errors are mapped to the client using
  // the global `onError` hook in `createProcedure`.
```

#

## Input Resolvers

### Zod

```ts
import { z } from "zod";
import { zodResolver } from "@explita/actyx-rpc/resolver/zod";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

const action = procedure
  .input(zodResolver(schema))
  .mutation(async ({ input }) => {
    return { success: true, data: input };
  });
```

### Valibot

```ts
import * as v from "valibot";
import { valibotResolver } from "@explita/actyx-rpc/resolver/valibot";

const schema = v.object({
  name: v.pipe(v.string(), v.minLength(1, "Name is required")),
  description: v.optional(v.string()),
});

const action = procedure
  .input(valibotResolver(schema))
  .mutation(async ({ input }) => {
    return { success: true, data: input };
  });
```

### ArkType

```ts
import { type } from "arktype";
import { arktypeResolver } from "@explita/actyx-rpc/resolver/arktype";

const schema = type({
  name: "string > 1",
  description: "string?",
});

const action = procedure
  .input(arktypeResolver<typeof schema>(schema))
  .mutation(async ({ input }) => {
    return { success: true, data: input };
  });
```

### Joi

```ts
import Joi from "joi";
import { joiResolver } from "@explita/actyx-rpc/resolver/joi";

const schema = Joi.object({
  name: Joi.string().min(1, "Name is required"),
  description: Joi.string().optional(),
});

const action = procedure
  .input(joiResolver<{ name: string; description?: string }>(schema))
  .mutation(async ({ input }) => {
    return { success: true, data: input };
  });
```

### Yup

```ts
import * as yup from "yup";
import { yupResolver } from "@explita/actyx-rpc/resolver/yup";

const schema = yup.object({
  name: yup.string().min(1, "Name is required"),
  description: yup.string().optional(),
});

const action = procedure
  .input(yupResolver(schema))
  .mutation(async ({ input }) => {
    return { success: true, data: input };
  });
```

### Custom Resolver

```ts
import { resolver } from "@explita/actyx-rpc/resolver";

const customResolver = resolver<{ slug: string }>((data) => {
  if (typeof data.slug !== "string" || data.slug.length === 0) {
    return {
      success: false,
      errors: { slug: "Slug is required" },
    };
  }

  return {
    success: true,
    data: { slug: data.slug },
  };
});
```

> Note that the shape of the data in the returned object becomes the shape of the input data.

#

## Why input resolvers do not allow primitives?

By design, every procedure receives enriched input that includes global context fields (e.g., `userId`, `tenant`, `correlationId`). These fields are merged with your schema, making the final input an object shape.

```ts
// Global enrichment
const procedure = createProcedure({
  enrichInput: { userId: "user-123", tenant: "tenant-456" },
});

// Your schema must be an object to merge with enrichment
procedure.input(z.object({ email: z.string() })).query(async ({ input }) => {
  input.userId; // ✅ Available from enrichment
  input.tenant; // ✅ Available from enrichment
  input.email; // ✅ Your schema field
});

// ❌ Primitive schemas don't work - nowhere to attach enrichment fields
procedure.input(z.string()).query(async ({ input }) => {
  // input would need to be: string & { userId: string, tenant: string }
  // This is impossible - primitives cannot hold additional properties
});
```

Therefore, input resolvers must always return an object schema. Primitive schemas like `z.string()`, `z.number()`, or `z.boolean()` are not supported.

#

## React Helper

The React entrypoint exports react hooks for handling async operation states on the client.

```ts
import { useMutation } from "@explita/actyx-rpc/react";

function CreatePostForm() {
  const mutation = useMutation(createPost, {
    optimisticUpdate: (input) => ({
      id: 'temp-id',
      title: input.title,
      body: input.body,
    }),
    onSuccess(data) {
      console.log("Created", data);
    },
    onError(message) {
      console.error(message);
    },
    onValidationErrors(errors) {
      console.log(errors);
    },
  });

  async function onSubmit() {
    await mutation.mutate({
      title: "Hello world",
      body: "This is my first post.",
    });
  }

  return (
    <button onClick={onSubmit} disabled={mutation.isPending}>
      {mutation.isPending ? "Creating..." : "Create post"}
    </button>
  );
}
```

`useMutation` returns:

- `mutate`
- `isPending`
- `data`
- `error`
- `validationErrors`
- `reset`
- `abort`

#

### useQuery

```tsx
function UserProfile({ userId }) {
  const { data, isLoading, error, refetch } = useQuery(
    () => getUser({ id: userId }),
    {
      enabled: !!userId,
      refetchOnWindowFocus: true,
      initialData: { id: "", name: "Loading..." },
    },
  );

  if (isLoading) return <Spinner />;
  if (error) return <Error message={error.message} />;

  return (
    <div>
      <h1>{data?.name}</h1>
      <button onClick={() => refetch()}>Refresh</button>
    </div>
  );
}
```

#

### useInfiniteQuery

```tsx
function PostsList() {
  const {
    data: allPosts,
    fetchNext,
    hasNext,
    isFetching,
  } = useInfiniteQuery(getPosts, {
    initialInput: { limit: 10 },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  if (isLoading) return <Spinner />;

  return (
    <div>
      {allPosts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      {hasNext && (
        <button onClick={fetchNext} disabled={isFetching}>
          {isFetching ? "Loading..." : "Load More"}
        </button>
      )}
    </div>
  );
}
```

<!-- ## Package Exports

- `@explita/actyx-rpc`
- `@explita/actyx-rpc/react`
- `@explita/actyx-rpc/resolver`
- `@explita/actyx-rpc/resolver/arktype`
- `@explita/actyx-rpc/resolver/joi`
- `@explita/actyx-rpc/resolver/valibot`
- `@explita/actyx-rpc/resolver/yup`
- `@explita/actyx-rpc/resolver/zod` -->

#

## License

MIT © [Explita](https://github.com/explita)
