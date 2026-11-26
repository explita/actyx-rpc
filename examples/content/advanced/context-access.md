---
sidebar_position: 1
title: Context Access & Typing
---

# Context Access & Typing

Actyx RPC leverages Node.js's `AsyncLocalStorage` to store both the active procedure context (`rpcStorage`) and the ambient HTTP request scope (`httpStorage`).

This completely eliminates "prop-drilling" of request metadata (such as database client connections, current user IDs, tenancy scopes, headers, and cookies) through every layer of your application service stack.

---

## `InferContext<T>`

Extract the exact compiled context type from a procedure builder instance. This is useful for typing service handlers or helper functions:

```ts
import { InferContext } from "@explita/actyx-rpc";
import { myProcedure } from "./procedures";

// Extracts the fully typed context
type MyContext = InferContext<typeof myProcedure>;

function doSomething(ctx: MyContext) {
  console.log("Logged in user:", ctx.userId);
}
```

---

## Accessing Context inside Handlers

There are two primary methods to access procedure context during handler execution:

### 1. `procedure.context` (Recommended)

Access the context directly on your procedure builder instance. This is highly ergonomic because **type inference works automatically** without needing any manual generic declarations.

```ts
// rpc.ts
export const procedure = createProcedure({ createContext });

// services/posts.ts
import { procedure } from "@/rpc";

export async function getPostsList() {
  // ✅ Fully typed to match the rpc.ts builder context structure
  const { tenantId, db } = procedure.context; 
  return await db.posts.findMany({ where: { tenantId } });
}

// backend/handlers.ts
export const getPosts = procedure.query(async () => {
  return await getPostsList(); // No need to drill the context object!
});
```

### 2. `getContext<T>()`

A generic alternative when you do not have direct access to the procedure builder instance (such as inside a shared helper utility or external library).

```ts
import { getContext, type InferContext } from "@explita/actyx-rpc";
import { procedure } from "@/rpc";

type Ctx = InferContext<typeof procedure>;

export async function writeAuditLog(action: string) {
  const { userId, db } = getContext<Ctx>(); // Manual typing required
  await db.auditLog.create({ data: { action, userId } });
}
```

---

## Accessing the Ambient HTTP Request (`getRequest` & `getHttpContext`)

When procedures are executed over HTTP (such as through Next.js route handlers via `createHandler`), Actyx RPC maintains an ambient `httpStorage` store containing the raw Web standard `Request` object and route options.

### `getRequest()`

Access the active `Request` instance from anywhere in your backend stack:

```ts
import { getRequest } from "@explita/actyx-rpc";

export async function checkRateLimit() {
  const req = getRequest();
  
  if (req) {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    console.log("Client IP from ambient request:", ip);
  }
}
```

### `getHttpContext()`

Retrieves both the incoming `Request` and the route options/params:

```ts
import { getHttpContext } from "@explita/actyx-rpc";

export function getRouteParams() {
  const http = getHttpContext();
  console.log("Route params:", http?.context?.params);
  return http?.context?.params;
}
```

### Direct Access on `ctx.req`

Inside any terminal handler (`.query()`, `.mutation()`, `.stream()`, `.sse()`, `.ws()`), `ctx` also directly includes `req` and `context` if called in an HTTP scope:

```ts
export const uploadFile = procedure
  .mutation(async ({ ctx }) => {
    // ctx.req is the ambient Request object
    const contentType = ctx.req?.headers.get("content-type");
    return { contentType };
  });
```

---

## Summary of Context Utilities

| Utility | Description | Scope | Type Safety |
| :--- | :--- | :--- | :--- |
| `procedure.context` | Accesses the active procedure context on the builder instance. | Active procedure stack | **Automatic** (inferred from builder) |
| `getContext<T>()` | Standalone function to read active context anywhere. | Active procedure stack | Manual generic (`getContext<MyContext>()`) |
| `getRequest()` | Standalone function to read the ambient Web `Request`. | HTTP requests (`createHandler`) | Returns `Request \| undefined` |
| `getHttpContext()` | Accesses `{ req, context }` ambient storage. | HTTP requests (`createHandler`) | Returns `HttpContext \| undefined` |
| `ctx.req` | Ambient `Request` attached directly to procedure handler context. | Terminal handlers | `Request \| undefined` |

---

## Context Error Safeguards

Both `procedure.context` and `getContext()` will throw a descriptive runtime error if called outside an active handler invocation stack:

```
[Actyx RPC] No active procedure context found.
getContext() and procedure.context can only be used inside a handler (query, mutation, stream, or sse).
```
