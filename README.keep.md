# Actyx RPC

**Type-safe RPC for composable server actions in TypeScript.**

Actyx RPC lets you build server-side procedures with full type safety, minimal boilerplate, and a clean, composable API.

- 🔒 End-to-end type safety
- ⚡ Built for server actions
- 🧩 Composable middleware & plugins
- 🧠 Flexible input modes (strict, form, partial)
- 🛡️ Resilience with Retries, Timeouts, and Circuit Breakers
- 📊 Built-in OpenTelemetry instrumentation
- 📝 Automated OpenAPI (Swagger) generation
- 🔌 Works with optional Zod, Valibot, ArkType, Joi, Yup resolvers, and custom resolver of your choice.

---

## Table of Contents

- [Why Actyx?](#why-actyx)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
  - [`createProcedure()`](#createprocedure)
  - [Global Error Mapping](#global-error-mapping)
  - [`.extend()`](#extend)
  - [`.name()`](#name)
  - [`.meta()`](#meta)
  - [`.input()`](#input)
  - [`.mutation()` and `.query()`](#mutation-and-query)
  - [`.middleware()`](#middleware)
  - [`.plugin()`](#plugin)
  - [`.use()`](#use)
  - [Plugin Lifecycle](#plugin-lifecycle)
  - [Builder Ordering](#builder-ordering)
- [`.authorize()`](#authorize)
- [`.mock()`](#mock)
- [`.stream()`](#stream)
- [`.sse()`](#sse)
- [`.circuitBreaker()`](#circuitbreaker)
- [`.telemetry()`](#telemetry)
- [`.cache()`](#cache)
  - [Basic Usage](#basic-usage)
  - [Cache Options](#cache-options)
  - [Redis Cache](#redis-cache)
  - [Custom Cache Adapter](#custom-cache-adapter)
- [`.invalidate()`](#invalidate)
  - [Invalidation Options](#invalidation-options)
- [`.rateLimit()`](#ratelimit)
  - [Basic Usage](#basic-usage-1)
  - [Rate Limit Options](#rate-limit-options)
- [`.retry()`](#retry)
  - [Basic Usage](#basic-usage-2)
  - [Backoff Strategies](#backoff-strategies)
  - [Conditional Retry](#conditional-retry)
  - [Retry Options](#retry-options)
  - [Combining Cache and Retry](#combining-cache-and-retry)
- [Execution Flow](#execution-flow)
  - [Normal Request (Cache Hit)](#normal-request-cache-hit)
  - [Normal Request (Cache Miss)](#normal-request-cache-miss)
  - [Stale Cache (Revalidation Case)](#stale-cache-revalidation-case)
- [`.timeout()`](#timeout)
  - [Basic Usage](#basic-usage-3)
  - [Timeout Options](#timeout-options)
- [`.compress()`](#compress)
  - [Basic Usage](#basic-usage-4)
  - [Compression Options](#compression-options)
- [Result Shape](#result-shape)
- [RPC Handler Pattern](#rpc-handler-pattern)
- [Input Resolvers](#input-resolvers)
  - [Zod](#zod)
  - [Valibot](#valibot)
  - [ArkType](#arktype)
  - [Joi](#joi)
  - [Yup](#yup)
  - [Custom Resolver](#custom-resolver)
- [Why input resolvers do not allow primitives?](#why-input-resolvers-do-not-allow-primitives)
- [Mocking](#mocking)
- [Automated Documentation](#automated-documentation)
  - [`.summary()` & `.description()`](#summary--description)
  - [`.output()`](#output)
  - [`generateOpenApi()`](#generateopenapi)
- [Inter-Procedure Calling](#inter-procedure-calling)
- [Type Inference](#type-inference)
  - [`InferContext<T>`](#infercontextt)
  - [Context Access](#context-access)
    - [`procedure.context`](#procedurecontext)
    - [`getContext<T>()`](#getcontextt)
- [Observability](#observability)
- [React Helper](#react-helper)
  - [Why a Built-in Query Client? (vs. TanStack Query)](#why-a-built-in-query-client-vs-tanstack-query)
  - [`ActyxProvider` & `useQueryClient`](#actyxprovider--usequeryclient)
  - [`useQuery`](#usequery)
    - [Automatic Response Unwrapping](#automatic-response-unwrapping)
  - [`useMutation`](#usemutation)
  - [`useInfiniteQuery`](#useinfinitequery)
  - [`useSuspenseQuery`](#usesuspensequery)
  - [`useIsMutating`](#useismutating)
  - [`useSSE`](#usesse)
  - [Client-Only Subpaths](#client-only-subpaths)
  - [Progress Tracking](#progress-tracking)
- [Adapters](#adapters)
  - [Next.js — `nextAdapter()`](#nextjs--nextadapter)
    - [Returned Fields](#returned-fields)
    - [Middleware Setup](#middleware-setup)
- [💖 Support the Mission](#-support-the-mission)
- [License](#license)

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
import { zodResolver } from "@explita/actyx-rpc/resolvers/zod";

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
    // data: {
    // title: input.title,
    // body: input.body,
    // authorId: ctx.userId,
    // },
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
    // where: {
    // id: input.id,
    // },
    // include: {
    // author: true,
    // },
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

**Multi-file Uploads**: When using `FormData` with multiple files under the same key, Actyx-RPC automatically detects the duplicates and provides them as an array in the `input` (e.g., `input.files` will be `File[]`).

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
```

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
```

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
> 1. **Setup**: `.name()`, `.summary()`, `.description()`, `.meta()`, `.input()`, `.output()`
> 2. **Middlewares**: `.use()`
> 3. **Execution Policies**: `.authorize()`, `.mock()`, `.cache()`, `.retry()`, `.timeout()`, `.rateLimit()`, `.circuitBreaker()`, `.telemetry()`
> 4. **Terminal**: `.query()`, `.mutation()`, `.stream()`, `.sse()`
>
> Actyx RPC strictly enforces this order at the type level. Once you call an execution policy method, setup methods like `.use()` or `.input()` will no longer be available in the autocomplete for that chain.

#

### `.authorize()`

Add fine-grained authorization checks to your procedures. Unlike standard middleware, `.authorize()` is designed for simple boolean checks or permission lookups.

```ts
const deletePost = procedure
  .authorize((ctx) => ctx.user.role === "admin")
  .mutation(async ({ input }) => {
    // Only runs if user is admin
  });

// You can also return a custom error
const updateProject = procedure
  .authorize((ctx) => {
    if (ctx.user.isBanned) {
      return { success: false, message: "Your account is restricted" };
    }
    return true;
  })
  .mutation(async () => { ... });
```

If the check fails, the procedure returns a `FORBIDDEN` error (403).

#

### `.mock()`

Actyx-RPC uses **Output Stubbing** for mocks. This allows you to simulate a successful backend response without actually executing the handler or hitting your database.

```ts
const getUser = procedure
  .mock(({ ctx }) => ({
    id: "user_123",
    name: "John Doe (Mocked)",
    role: "admin",
  }))
  .query(async ({ input }) => {
    // This REAL handler will be SKIPPED if ACTYX_MOCK="true"
    return await db.users.find(input.id);
  });
```

### How it Works

When `ACTYX_MOCK="true"` is set in your environment:

1.  **Authorization** and **Middlewares** still run (to ensure the request is valid).
2.  The **Resolver** still runs (to ensure the input shape is correct).
3.  The **Real Handler** is skipped.
4.  Your `.mock()` function provides the final result returned to the client.

This allows you to build frontends against "perfect" data even if your backend logic isn't finished yet.

> [!TIP]
> When `.mock()` is used, the **input validation is skipped** at runtime, and the input argument becomes **optional** in TypeScript. This allows you to call procedures in development like `createUser()` without passing any data!

### Testing Error States

You can also throw inside a mock to test how your UI handles specific failure scenarios:

```ts
const getUser = procedure
  .mock(() => {
    throw { success: false, message: "Database is down!", reason: "DB_ERROR" };
  })
  .query(async () => { ... });
```

### Mocking File Uploads

You can even mock binary data. This is extremely useful for testing file processing without manually selecting files in the browser every time:

```ts
const uploadAvatar = procedure
  .mock(() => ({
    userId: "user_1",
    file: new Blob(["fake-image-content"], { type: "image/png" }),
  }))
  .mutation(async ({ input }) => {
    // This handler receives the mocked Blob/File
    await storage.upload(input.file);
  });
```

#

### `.stream()`

Terminal method for procedures that return an `AsyncIterable`. Perfect for AI streaming or long-running progress updates.

```ts
const generateContent = procedure
  .input(z.object({ prompt: z.string() }))
  .stream(async function* ({ input }) {
    yield "Thinking...";
    const stream = await ai.stream(input.prompt);
    for await (const chunk of stream) {
      yield chunk;
    }
  });

// Consuming on the client
for await (const chunk of generateContent({ prompt: "Hello" })) {
  console.log(chunk);
}
```

#

### `.sse()`

For real-time, one-way data streams (like notification feeds, stock tickers, or progress bars), use `.sse()`. This method specifically targets the **Server-Sent Events** protocol.

On the server, you simply `yield` event objects. You can then use the `createSSEResponse` helper to turn that generator into a web-standard `Response`.

```ts
const watchStock = procedure
  .input(z.object({ symbol: z.string() }))
  .sse(async function* ({ input }) {
    while (true) {
      const price = await getLatestPrice(input.symbol);

      yield {
        event: "price-update",
        data: { price, at: new Date() },
      };

      await new Promise((r) => setTimeout(r, 5000));
    }
  });

// In a Next.js Route Handler:
export async function GET(req: Request) {
  const stream = watchStock({ symbol: "AAPL" });
  return createSSEResponse(stream);
}
```

On the client, use the `SSEClient` helper to open the connection. It handles the protocol parsing and yields typed events:

```ts
import { SSEClient } from "@explita/actyx-rpc";

// In your component or useEffect:
const stock = await SSEClient({
  url: "/api/sse",
  params: { symbol: "AAPL" },
});

for await (const { event, data } of stock) {
  if (event === "price-update") {
    console.log("New price:", data.price);
  }
}

// To stop the stream manually:
stock.close();
```

<!-- #

### `.subscription()`

Terminal method for creating type-safe, topic-based subscriptions over WebSockets. Perfect for chat, live notifications, or dashboards.

When Redis is configured, subscriptions work across multiple server instances (distributed PubSub).

```typescript
// 1. Define a subscription
export const onRoomEvent = procedure
  .input(z.object({ roomId: z.string() }))
  .subscription(async ({ ctx, input, emit }) => {
    // Subscribe to a topic using the built-in pubsub
    // Uses Redis if configured in createProcedure, otherwise Memory
    const unsubscribe = await ctx.pubsub.subscribe(
      `room:${input.roomId}`,
      (data) => {
        emit(data); // Push data to the client
      },
    );

    return unsubscribe; // Return the cleanup function
  });

// 2. Trigger events from any other procedure
export const sendEvent = procedure
  .input(z.object({ roomId: z.string(), message: z.string() }))
  .mutation(async ({ ctx, input }) => {
    await ctx.pubsub.publish(`room:${input.roomId}`, {
      text: input.message,
      sender: "System",
    });
    return { success: true };
  });
```

#

#### Distributed PubSub (Redis)

When your application scales across multiple servers, you can use Redis to synchronize subscriptions. Actyx RPC automatically handles this if you provide a `RedisCache` instance to `createProcedure`.

```typescript
import { createProcedure, RedisCache } from "@explita/actyx-rpc";
import Redis from "ioredis";

const redis = new Redis();

const procedure = createProcedure({
  // PubSub will automatically reuse this Redis instance
  cache: new RedisCache(redis),
});
```

#

#### Client Usage (React)

```tsx
import { useSubscription } from "@explita/actyx-rpc/react";
import { onRoomEvent } from "./procedures";

function Room({ id }) {
  // Automatically handles connection, cleanup, and state updates
  const { data, status } = useSubscription(onRoomEvent({ roomId: id }), {
    wsUrl: "ws://localhost:3001/rpc",
  });

  return (
    <div>
      Status: {status}
      {data && <p>New Message: {data.text}</p>}
    </div>
  );
}
```

#### WebSocket Server Setup

To handle WebSocket subscriptions, you need a running WebSocket server. You can use the `applyWSHandler` adapter to connect your Actyx procedures to a standard WebSocket instance (e.g., using the `ws` library).

```typescript
import { WebSocketServer } from "ws";
import { applyWSHandler } from "@explita/actyx-rpc/adapters/ws";
import { onRoomEvent } from "./procedures";

const wss = new WebSocketServer({ port: 3001 });

wss.on("connection", (ws) => {
  // Attach the procedure to the websocket
  // We pass the pre-bound procedure (executor) as the first argument
  applyWSHandler(onRoomEvent({ roomId: "main-lobby" }), {
    ws: ws,
  });
});

console.log("WebSocket RPC server running on ws://localhost:3001");
```

> [!TIP]
> **Next.js Integration**: Since standard Next.js route handlers do not support WebSockets, you can either run a standalone server (as shown above) or use a **Custom Next.js Server** (`server.js`) to host both your Next.js app and your WebSocket RPC handlers on the same port. -->

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

### `.cache()`

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

### `.invalidate()`

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

### `.rateLimit()`

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

### `.retry()`

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

### Normal Request (Cache Hit)

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

### Normal Request (Cache Miss)

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

### `.timeout()`

Set a maximum execution time for your procedures. If the procedure takes longer than the specified time, it will be aborted and return a timeout error.

> [!NOTE]
> **Mutation Safety**: The `.timeout()` method is **disabled for mutations**. Applying a timeout to a mutation is unsafe as it can lead to partial data creation (the client aborts, but the database transaction might still commit). Timeouts are only available for `.query()` and `.subscription()` procedures.

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

### `.compress()`

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
import { zodResolver } from "@explita/actyx-rpc/resolvers/zod";

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
import { valibotResolver } from "@explita/actyx-rpc/resolvers/valibot";

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
import { arktypeResolver } from "@explita/actyx-rpc/resolvers/arktype";

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
import { joiResolver } from "@explita/actyx-rpc/resolvers/joi";

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
import { yupResolver } from "@explita/actyx-rpc/resolvers/yup";

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
import { resolver } from "@explita/actyx-rpc/resolvers";

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

## Automated Documentation

Actyx RPC is designed to be self-documenting. By providing metadata to your procedures, you can automatically generate high-quality OpenAPI (Swagger) specifications without maintaining separate documentation files.

### `.summary()` & `.description()`

These methods allow you to add human-readable context to your procedures.

- **`.summary(text)`**: A short, one-line summary of what the procedure does.
- **`.description(text)`**: A detailed, multi-line explanation of the procedure's behavior, side effects, or business logic.

```ts
const createUser = procedure
  .name("createUser")
  .summary("Create a new system user")
  .description("Registers a new user in the database and sends a welcome email. Requires admin privileges.")
  .input(zodResolver(userSchema))
  .mutation(async ({ input }) => { ... });
```

### `.output()`

While `.output()` is essential for OpenAPI generation, its primary purpose is **Contract Enforcement** and **End-to-End Type Safety**. It acts as a strict boundary between your server logic and the client.

- **Contract Enforcement**: It restricts the TypeScript return type of your procedure, ensuring your frontend receives exactly the type it expects—no more, no less.
- **Runtime Sanitization**: It acts as a whitelist during execution, stripping away any extra or sensitive fields (like `passwordHash` or `internalFlags`) that your handler might accidentally return before the payload hits the network.
- **Transformation**: You can use your resolver to format dates, round numbers, or transform data on the fly.
- **Documentation**: It provides the exact schema of your response to the OpenAPI generator.

```ts
const getProfile = procedure
  .output(
    zodResolver(
      z.object({
        id: z.string(),
        name: z.string(),
        email: z.string().email(),
      }),
    ),
  )
  .query(async ({ input }) => {
    const user = await db.user.find(input.id);
    return user; // Even if 'user' has 50 fields, only 3 will be sent to the client.
  });
```

#

## Inter-Procedure Calling

Actyx RPC allows procedures to call each other directly as regular functions. This is extremely efficient because it **automatically shares the same context** and skips redundant context creation if a call is already in progress.

### Example: Direct Calls

```typescript
const getAuditLog = procedure
  .input(z.object({ userId: z.string() }))
  .query(async ({ input }) => {
    return await db.auditLog.findMany({ where: { userId: input.userId } });
  });

export const getUserDetails = procedure
  .input(z.object({ id: z.string() }))
  .query(async ({ input }) => {
    // 1. Fetch the user normally
    const user = await db.user.findUnique({ where: { id: input.id } });

    // 2. Call another procedure directly!
    // The target procedure automatically inherits 'ctx' and skips re-authentication
    const [logs, err] = await getAuditLog({ userId: input.id });

    if (err) throw err;

    return { ...user, logs };
  });
```

### How it Works

Actyx RPC uses `AsyncLocalStorage` (Node.js) to track the current execution context. When one procedure calls another:

1.  **Context Bypass**: The child procedure detects the existing context and skips `createContext()`.
2.  **Authorization Integrity**: Even with context bypass, the child's `.authorize()` and middlewares still run to ensure security is never compromised.
3.  **Zero Overhead**: No network requests, no re-serialization, just direct function execution.

#

## Type Inference

### `InferContext<T>`

Extract the exact context shape from any procedure instance. This works identically to `z.infer<T>`, but for extracting the merged output of `createContext` and any added `meta` properties of your procedure.

```ts
import { InferContext } from "@explita/actyx-rpc";
import { myProcedure } from "./procedures";

// Extracts the fully typed context
type MyContext = InferContext<typeof myProcedure>;

function doSomethingWithContext(ctx: MyContext) {
  console.log(ctx.userId, ctx.tenantId);
}
```

#

## Context Access

Once a procedure handler is executing, its context is available anywhere in the call stack — no need to thread `ctx` through every service function.

Actyx RPC stores the context in [`AsyncLocalStorage`](https://nodejs.org/api/async_context.html#class-asynclocalstorage) for the lifetime of each handler invocation. Two ergonomic APIs let you read it.

### `procedure.context`

The recommended approach. Access the fully-typed context directly on the procedure instance — no generic argument required, because the type is inferred from your procedure definition.

```ts
// rpc.ts
export const procedure = createProcedure({ createContext });

// services/customer/get-all.ts
import { procedure } from "@/rpc";

export async function getAllCustomers() {
  const { companyId, prisma } = procedure.context; // ✅ fully typed
  return prisma.customer.findMany({ where: { companyId } });
}

// controllers/customer/get-all.ts
export const getAll = procedure.query(async ({ input }) => {
  return getAllCustomers(); // no ctx argument needed
});
```

Compare this to the traditional approach where every service function carries a `ctx` parameter:

```ts
// ❌ Before — ctx has to be drilled into every service
const customers = await getAllCustomers({
  companyId: ctx.companyId,
  prisma: ctx.prisma,
});

// ✅ After — services are self-contained
const customers = await getAllCustomers();
```

Service function signatures now only describe their own domain arguments, not the infrastructure they need to run.

### `getContext<T>()`

A standalone alternative for when you do not have direct access to the procedure instance (e.g., in a deeply nested utility or a shared library).

```ts
import { getContext, type InferContext } from "@explita/actyx-rpc";
import { procedure } from "@/rpc";

type Ctx = InferContext<typeof procedure>;

export async function auditLog(action: string) {
  const { userId, companyId } = getContext<Ctx>();
  await db.auditLog.create({ data: { action, userId, companyId } });
}
```

Both APIs throw a descriptive error if called outside a handler:

```
[Actyx RPC] No active procedure context found.
getContext() and procedure.context can only be used inside a handler (query, mutation, stream, or sse).
```

> **Note:** `procedure.context` is preferred when you have the procedure in scope, because the type is inferred automatically without any generic argument. Use `getContext<T>()` for shared utilities that are decoupled from a specific procedure.

#

### `generateOpenApi()`

Once your procedures are defined, you can export your entire API as a standard OpenAPI 3.0 specification. While procedures carry their own metadata, you can **manually override** HTTP methods, tags, and summaries at the call site to fine-tune your documentation.

```ts
import { generateOpenApi } from "@explita/actyx-rpc";

const openapi = generateOpenApi(
  {
    // Simple registration
    "get-profile": getProfile,

    // Registration with documentation overrides
    "update-user": {
      procedure: updateUser,
      method: "put", // Force PUT instead of default POST
      tags: ["Admin", "User"], // Custom grouping
      summary: "Admin update", // Override summary
    },

    "delete-post": {
      procedure: deletePost,
      method: "delete",
      tags: ["Posts"],
    },
  },
  {
    title: "My Awesome API",
    version: "1.0.0",
    baseUrl: "https://api.example.com/v1",
    security: true, // Enables default Bearer Auth (JWT), or a Record for custom schemes
    output: "./openapi.json",
  },
);
```

The generator automatically handles:

- **Recursive Schema Mapping**: Works with Zod, ArkType, Valibot, Yup, and Joi.
- **Smart Examples**: Automatically generates mock data for all inputs and parameters.
- **Custom Security**: Injects JWT security schemes automatically when set to `true`, or custom schemes when provided as a Record.
- **Method Overrides**: Explicitly map actions to `PUT`, `PATCH`, `DELETE`, etc.
- **Tag Grouping**: Organize your procedures into logical sections in Swagger UI.
- **Parameter Mapping**: Automatically converts Query inputs to URL parameters and Mutation inputs to Request Bodies.

#

## React Helper

The React entrypoint exports react hooks for handling async operation states on the client.

### Why a Built-in Query Client? (vs. TanStack Query)

While libraries like TanStack Query (React Query) are excellent, Actyx RPC includes its own lightweight, zero-dependency caching and state management system for two main reasons:

1. **Seamless Procedure Integration (Tuple Return):** Actyx RPC procedures return a standardized `[data, error]` tuple to ensure type-safe and runtime-safe error handling without `try/catch` boilerplate. TanStack Query is designed around thrown errors and rejected promises. Our built-in `QueryClient` natively understands the tuple format, allowing you to drop procedure handlers directly into hooks (e.g. `useQuery(getUserProfile)`) with full type safety and zero boilerplate wrapper functions.
2. **Zero-Dependency Essentials:** You shouldn't have to install, configure, and maintain a heavy external library for basic caching capabilities. Out of the box, Actyx RPC provides request deduplication, cache invalidation, optimistic updates, prefetching, and network reconnect/window focus refetching without needing any additional packages.

#

### `ActyxProvider` & `useQueryClient`

To enable global query caching, query invalidation, and mutation tracking, wrap your application in the `ActyxProvider` and pass it a `QueryClient` instance.

```tsx
import { QueryClient, ActyxProvider } from "@explita/actyx-rpc/react";

const queryClient = new QueryClient();

function App() {
  return (
    <ActyxProvider client={queryClient}>
      <MyComponents />
    </ActyxProvider>
  );
}
```

You can retrieve the query client in any child component using the `useQueryClient` hook:

```tsx
import { useQueryClient } from "@explita/actyx-rpc/react";

function InvalidateButton() {
  const queryClient = useQueryClient();

  return (
    <button onClick={() => queryClient.invalidate(["userProfile"])}>
      Force Refresh Profile
    </button>
  );
}
```

#### `QueryClient` API

- **`invalidate(queryKey)`**: Marks matching cache entries as stale (triggering an immediate refetch for any active hooks with matching keys).
- **`setQueryData(queryKey, data | updater)`**: Manually updates cached query data. Handy for optimistic updates. Returns a tuple containing the `[oldData, newData]`.
- **`prefetchQuery(queryKey, proc)`**: Fetches data from the server and caches it. Useful for prefetching data on hover or route transitions.
- **`clear()`**: Clears all query cache entries and active timers.

#

### `useMutation`

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

````

`useMutation` returns:

- `mutate`
- `isPending`
- `data`
- `error`
- `validationErrors`
- `reset`
- `abort`

#

## Progress Tracking

Actyx RPC provides native support for real-time upload progress tracking. While standard Next.js Server Actions encapsulate the request body and don't provide progress events, you can use **URL-based mutations** to bypass this limitation.

### 1. Setup the Route Handler

Create a dedicated Route Handler (e.g., `api/rpc/test-upload/route.ts`) using the `createNextHandler` adapter.

```ts
import { createNextHandler } from "@explita/actyx-rpc/adapters/next";
import { testUpload } from "@/backend/controllers/test/upload";

export const POST = createNextHandler(testUpload);
````

### 2. Use `useMutation` with a URL

Instead of passing the procedure directly, pass the URL of your Route Handler.

> [!IMPORTANT]
> When using a URL-based mutation, the `mutate` function **only supports a single argument**, which becomes the request body. Variadic arguments are only supported for direct procedure calls (Server Actions).

```tsx
function UploadComponent() {
  const upload = useMutation("/api/rpc/test-upload", {
    onProgress: (p) => {
      console.log(`Upload progress: ${p}%`);
    },
    onSuccess: (data) => {
      console.log("Upload complete!", data);
    },
  });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // You can pass the File directly...
    await upload.mutate(file);

    // ...or an object containing files. Actyx will automatically
    // convert it to FormData and handle nested fields!
    await upload.mutate({
      name: "Profile Picture",
      file: file,
      metadata: { size: file.size },
    });
  };

  return (
    <input type="file" onChange={handleFile} disabled={upload.isPending} />
  );
}
```

### How it Works

- **Binary Mode**: If you pass a `File` or `Blob` directly, Actyx sends it as `application/octet-stream`. This is the most efficient way to stream huge files (800MB+) as it avoids all parsing overhead on the server.
- **Auto-FormData**: If you pass an object containing `File`/`Blob` instances, Actyx automatically converts it to a `multipart/form-data` request.
- **Universal Ingestion**: The `createNextHandler` and your procedure handlers are smart enough to recover the file data regardless of how it was sent.

### Receiving Files in Procedures

In your procedure, the file data can be accessed either from the `input` (for object/FormData) or from the second argument (for direct binary streams).

```ts
export const testUpload = procedure
  .input(z.object({ file: z.instanceof(File) }))
  .mutation(async ({ input, ctx }, fileDataArg: File) => {
    // Robust file recovery logic
    const fileData = fileDataArg || (input as any)?.file;

    if (!fileData) throw new Error("No file provided");

    // Use standard Node/Web streams to save the file
    const stream =
      typeof fileData.stream === "function" ? fileData.stream() : fileData;

    // ... process stream
  });
```

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

> [!NOTE]
> Unlike TanStack Query, `useQuery` in Actyx RPC does not require a `queryKey` for basic usage. However, you can provide an optional `queryKey` in the options if you need to deduplicate simultaneous requests across multiple components.

#### Automatic Response Unwrapping

If your procedures return a standardized response object (for example, a `{ data: ... }` wrapper), `useQuery` can automatically strip this for you to reduce boilerplate in your components.

When `unwrap: true` is set:

1.  The `data` returned by the hook is the **inner payload** directly.
2.  `initialData` (if provided) also expects the **unwrapped shape**.
3.  Type inference automatically adjusts to the inner payload type.

```tsx
function CompanyProfile() {
  const { data } = useQuery(getSettings, {
    unwrap: true, // Enable automatic stripping
    initialData: {
      name: "Explita",
      branches: [],
    },
  });

  // data is now the unwrapped payload!
  return <h1>{data?.name}</h1>;
}
```

> [!TIP]
> This feature is currently only available for `useQuery` to keep data retrieval clean while maintaining full control over `useMutation` and `useInfiniteQuery` results.

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

#

### useSSE

Reactive hook for subscribing to Server-Sent Event (SSE) streams. It automatically manages connection lifecycles (opening on mount, cleaning up on unmount or dependency change) and accumulates a history of event payloads.

```tsx
import { useSSE } from "@explita/actyx-rpc/react";

function StockTicker({ symbol }) {
  const {
    data: history,
    lastData: latest,
    isConnected,
    error,
  } = useSSE({
    url: "/api/rpc/stock-ticker",
    params: { symbol },
    maxHistory: 10, // Optional: limit history size to prevent memory leaks
  });

  if (error) return <p>Error connecting: {error.message}</p>;

  return (
    <div>
      <h3>Status: {isConnected ? "Live" : "Connecting..."}</h3>
      {latest && <p>Latest Price: ${latest.price}</p>}

      <h4>Recent Updates:</h4>
      <ul>
        {history.map((update, i) => (
          <li key={i}>${update.price}</li>
        ))}
      </ul>
    </div>
  );
}
```

`useSSE` Options:

- `url`: The SSE endpoint URL.
- `params`: Optional record of query parameters.
- `headers`: Optional record of custom request headers.
- `signal`: Optional external `AbortSignal`.
- `enabled`: Optional boolean to conditionally connect/disconnect (defaults to `true`).
- `maxHistory`: Optional number limiting the length of the accumulated `data` array.
- `onData`: Optional callback triggered on every event: `(data: T, event: string | undefined) => void`.
- `onError`: Optional callback triggered on connection error: `(error: ErrorResponse) => void`.

Returns:

- `data`: An array of all accumulated event payloads (oldest first).
- `lastData`: The most recently received event payload.
- `event`: The name of the most recently received event.
- `isConnected`: Boolean connection state.
- `error`: `ErrorResponse` if the connection fails.
- `close()`: Function to manually close the connection.
- `clear()`: Function to clear the accumulated `data` history.

#

### useSuspenseQuery

A hook that integrates with React Suspense for data loading. It throws the data-loading promise, allowing you to use a `<Suspense>` boundary in parent components.

```tsx
import { useSuspenseQuery } from "@explita/actyx-rpc/react";
import { Suspense } from "react";

function TodoList() {
  const { data: todos } = useSuspenseQuery(() => getTodos(), {
    queryKey: ["todos"],
  });

  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>{todo.text}</li>
      ))}
    </ul>
  );
}

function Page() {
  return (
    <Suspense fallback={<div>Loading todos...</div>}>
      <TodoList />
    </Suspense>
  );
}
```

#

### useIsMutating

A hook that tracks the number of active mutations in your application. This is useful for displaying global sync spinners or loading states in headers.

```tsx
import { useIsMutating } from "@explita/actyx-rpc/react";

function GlobalSpinner() {
  // Returns true if ANY mutation is currently executing in the app
  const isMutating = useIsMutating();

  // Or filter specifically by mutation key:
  // const isAddingTodo = useIsMutating(["addTodo"]);

  if (!isMutating) return null;

  return <div>Syncing with server...</div>;
}
```

#

### Client-Only Subpaths

If you are developing inside browser-only environments (such as Next.js Client Components) and want to keep your JS bundle size minimal, you can import client-only helpers directly from subpaths. This avoids referencing node-only/server-side dependencies (like `fs`, `node:async_hooks`, etc.) inside the client bundle.

```tsx
// Safely import SSEClient without pulling in server/node code:
import { SSEClient } from "@explita/actyx-rpc/client/sse";

// Safely import WebSocket client:
import { WSClient } from "@explita/actyx-rpc/client/ws";
```

#

<!-- #

### useSubscription

```tsx
function Room({ id }) {
  const { data, status } = useSubscription(onRoomEvent({ roomId: id }), {
    wsUrl: "ws://localhost:3000/api/rpc",
  });

  return (
    <div>
      Status: {status}
      {data && <p>New Message: {data.text}</p>}
    </div>
  );
}
``` -->

<!-- ## Package Exports

- `@explita/actyx-rpc`
- `@explita/actyx-rpc/react`
- `@explita/actyx-rpc/resolvers`
- `@explita/actyx-rpc/resolvers/arktype`
- `@explita/actyx-rpc/resolvers/joi`
- `@explita/actyx-rpc/resolvers/valibot`
- `@explita/actyx-rpc/resolvers/yup`
- `@explita/actyx-rpc/resolvers/zod` -->

#

## Observability

Track procedure latency, success rates, and errors using the `observabilityPlugin`.

```ts
import { createProcedure, observabilityPlugin } from "@explita/actyx-rpc";

const procedure = createProcedure({
  plugins: [
    observabilityPlugin({
      onCall: ({ name, duration, success, error }) => {
        console.log(`${name} took ${duration}ms (Success: ${success})`);
        if (error) reportToSentry(error);
      },
    }),
  ],
});
```

#

## Adapters

### Next.js — `nextAdapter()`

A ready-made context adapter for Next.js Server Actions and Route Handlers.

```ts
import { nextAdapter } from "@explita/actyx-rpc/adapters/next";
```

Use it inside `createContext` to populate your procedure context with request metadata:

```ts
import { createProcedure } from "@explita/actyx-rpc";
import { nextAdapter } from "@explita/actyx-rpc/adapters/next";

const procedure = createProcedure({
  async createContext() {
    const {
      ip,
      host,
      pathname,
      userAgent,
      browser,
      platform,
      cookies,
      ...rest
    } = await nextAdapter();

    return {
      ok: true,
      ctx: {
        ip,
        host,
        pathname,
        userAgent,
        browser,
        platform,
      },
    };
  },
});
```

#### Returned Fields

| Field          | Source header(s)                          | Description                                                           |
| -------------- | ----------------------------------------- | --------------------------------------------------------------------- |
| `ip`           | `x-forwarded-for`                         | Client IP address                                                     |
| `host`         | `x-forwarded-host` → `host`               | Public hostname                                                       |
| `origin`       | `origin` → `proto://host`                 | Request origin, falls back to constructed value                       |
| `referer`      | `referer`                                 | Referring page URL                                                    |
| `pathname`     | `x-pathname` _(middleware-injected)_      | Current URL pathname — [requires middleware](#middleware-setup)       |
| `searchParams` | `x-search-params` _(middleware-injected)_ | Parsed query params object — [requires middleware](#middleware-setup) |
| `proto`        | `x-forwarded-proto`                       | `"http"` or `"https"`                                                 |
| `userAgent`    | `user-agent`                              | Full user agent string                                                |
| `browser`      | `sec-ch-ua`                               | Parsed browser name and version (e.g. `"Google Chrome/147"`)          |
| `platform`     | `sec-ch-ua-platform`                      | OS platform (e.g. `"Windows"`, `"macOS"`)                             |
| `locale`       | `accept-language`                         | First preferred locale (e.g. `"en-US"`)                               |
| `contentType`  | `content-type`                            | Request content type                                                  |
| `headers`      | —                                         | The raw `ReadonlyHeaders` object                                      |
| `cookies`      | —                                         | The raw `ReadonlyRequestCookies` object                               |

#### Middleware Setup

`pathname` and `searchParams` are injected by your Next.js proxy. Without this, both fields will be empty strings / empty objects.

Create or update your `proxy.ts` at the root of your project:

```ts
// proxy.ts
import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const url = request.nextUrl;

  const nextResponseConfig = {
    headers: {
      "x-pathname": url.pathname,
      "x-search-params": JSON.stringify(Object.fromEntries(url.searchParams)),
    },
  };

  return NextResponse.next(nextResponseConfig);
}
```

> [!NOTE]
> `next` must be installed in your consuming project. It is listed as an optional peer dependency of `@explita/actyx-rpc` and is not bundled.

#

## 💖 Support the Mission

Actyx RPC is built to simplify building type-safe, distributed systems with minimal boilerplate. If it has helped you build better APIs faster, please consider supporting the project to ensure its continued growth and maintenance!

<p align="left">
  <a href="https://github.com/sponsors/explita">
    <img src="https://img.shields.io/badge/Sponsor_on_GitHub-EA4AAA?style=for-the-badge&logo=github-sponsors&logoColor=white" />
  </a>
  <a href="https://ko-fi.com/explita">
    <img src="https://img.shields.io/badge/Buy_Me_A_Coffee-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white" />
  </a>
</p>

### 🚀 Ways to Contribute

- **Give us a ⭐**: It helps others discover the project.
- **Join the Discussion**: Report [bugs](https://github.com/explita/actyx-rpc/issues) or suggest new [features](https://github.com/explita/actyx-rpc/discussions).
- **Spread the Word**: Share your experience with Actyx RPC on social media.

### 🙏 Our Amazing Supporters

_A huge thank you to everyone helping us build the future of type-safe server actions!_

[![Contributors](https://contrib.rocks/image?repo=explita/actyx-rpc)](https://github.com/explita/actyx-rpc/graphs/contributors)

#

## License

MIT © [Explita](https://github.com/explita)
