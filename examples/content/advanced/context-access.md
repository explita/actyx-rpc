---
sidebar_position: 1
title: Context Access & Typing
---

# Context Access & Typing

Actyx RPC leverages Node.js's `AsyncLocalStorage` to store the active procedure context. This eliminates "prop-drilling" of request metadata (such as database client connections, current user IDs, or tenancy scopes) through every layer of your application service stack.

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

There are two primary methods to access context during handler execution:

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

## Context Error Safeguards

Both `procedure.context` and `getContext()` will throw a descriptive runtime error if called outside an active handler invocation stack:

```
[Actyx RPC] No active procedure context found.
getContext() and procedure.context can only be used inside a handler (query, mutation, stream, or sse).
```
