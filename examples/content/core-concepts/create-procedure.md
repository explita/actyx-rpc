---
sidebar_position: 1
title: Creating Procedures
---

# Creating Procedures

Procedures in Actyx RPC are constructed using a procedure builder created by `createProcedure()`. This allows you to encapsulate and reuse shared server concerns, such as authentication, logging, global context, and centralized error mapping.

## `createProcedure()`

To get started, instantiate a base procedure builder:

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
        role: session.user.role,
      },
    };
  },
  onContextError({ reason }) {
    if (reason === "UNAUTHORIZED") {
      return {
        _redirect: () => redirect("/login"),
        message: "Session expired or invalid",
      };
    }
  },
  onSuccess({ ctx, input, output, duration }) {
    console.log("Procedure completed successfully", { 
      handler: ctx.handlerName, 
      duration 
    });
  },
  inputMode: "strict", // "strict" | "form" | "partial"
});
```

### Configuration Options

| Option | Type | Description |
| :--- | :--- | :--- |
| `createContext` | `(prev) => Promise<ContextResult>` | Runs at the start of the request lifecycle to generate a shared context. Can return `{ ok: false, reason: string }` on failure. |
| `onContextError` | `(err) => any` | Called if `createContext` fails. Useful for global redirects or constructing unified error payloads. |
| `enrichInput` | `(ctx) => Promise<TEnrich> \| TEnrich` | Runs after context creation to attach global context keys (e.g., `userId`) into all procedure input objects. |
| `onSuccess` | `(props) => void` | Runs when a procedure finishes successfully. Receives context, input, output, and execution duration. |
| `onError` | `(props) => any` | Runs when a procedure throws or returns an error. Returns mapped error format. |
| `inputMode` | `InputMode` | The default caller input mode for procedures (`strict`, `form`, `partial`). |
| `middlewares` | `Middleware[]` | Array of global middlewares applied to all procedures generated from this builder. |
| `plugins` | `Plugin[]` | Array of global plugins applied to all procedures. |
| `cache` | `CacheAdapter` | The global cache adapter used for caching queries and rate-limit tracking (defaults to `MemoryCache`). |
| `compression` | `Compressor` | The global compressor instance used for response compression (defaults to `Compressor`). |
| `meta` | `TMeta` | Default global metadata attached to all child procedures. |

---

## Global Error Mapping

The `onError` hook is a powerful way to centralize error handling. Instead of polluting every query or mutation handler with identical `try/catch` blocks, **let your handlers throw naturally**.

When `onError` returns an object, that object becomes the official error response returned by the procedure to the client.

```ts
const procedure = createProcedure({
  // ...
  onError({ error, ctx }) {
    // If the procedure has a .name("..."), it's available in ctx.handlerName
    console.error(`Error in ${ctx.handlerName}:`, error);

    // Map database unique constraint violations globally
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
```

Now your actual query and mutation handlers can be clean and free of boilerplate:

```ts
const createUser = procedure.input(userResolver).mutation(async ({ input }) => {
  // Just throw! No try/catch needed here.
  return await db.user.create({ data: input });
});
```

---

## Framework Redirects in Context Failures

Most modern frameworks support throwing specific routing errors to handle navigation control flow natively (for example, calling Next.js's `redirect("/login")`). In 99% of cases, you can simply invoke these native framework functions directly inside your procedure callbacks:

```ts
import { redirect } from "next/navigation";

const procedure = createProcedure({
  createContext: () => {
    // Triggers standard native framework redirect logic directly
    redirect("/login");
  }
});
```

However, if native framework redirect signals do not execute automatically (e.g. if they are caught or suppressed by nested pipeline wrappers), Actyx RPC provides a fallback `_redirect` callback mechanism inside `onContextError` or custom middlewares to guarantee navigation executes cleanly:

```ts
onContextError({ reason }) {
  if (reason === "INVALID_SESSION") {
    return {
      message: "Session expired",
      _redirect: () => redirect("/login"), // Safe callback fallback wrapper
    };
  }
}
```

This is executed at the very start of the procedure responses before returning to the caller.
