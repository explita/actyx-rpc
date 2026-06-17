---
sidebar_position: 2
title: Builder Chaining
---

# Builder Chaining

Procedure builders are designed around chainable configuration methods. Every method in the chain returns a new builder instance, leaving original builders unmodified. 

To ensure type-safety and context resolution, Actyx RPC strictly enforces execution policy ordering (see [Middleware & Plugins](./middleware-plugins.md#builder-ordering)).

---

## `.extend()`

Create a new procedure builder by extending an existing one. This allows for powerful context and input inheritance:
* **`createContext`**: Receives the `previous` context from the parent, allowing you to chain or modify it.
* **`enrichInput`**: Receives an object containing both the current `ctx` and the `previous` enriched data.

```ts
const baseProcedure = createProcedure({
  async createContext() {
    return {
      ok: true,
      ctx: { userId: "user_123", role: "member" },
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
```

---

## `.name()`

Provides a unique identifier for the procedure. This name is automatically attached to the context as `handlerName` and included in error logs and telemetry.

> [!NOTE]
> Actyx RPC strictly infers the exact string literal you provide here! The `ctx.handlerName` inside your handlers and plugins will be strongly typed to match the name (e.g. `"getUserProfile"` instead of `string`).

```ts
const getUser = procedure.name("getUserProfile").query(async ({ ctx }) => {
  // ctx.handlerName is strictly typed as "getUserProfile"
});
```

---

## `.meta()`

Attaches arbitrary metadata (e.g., authorization roles, audit flags) to a procedure. Metadata is deeply merged with full type-safety during `.extend()` and `.meta()`.

```ts
const root = createProcedure({
  createContext: () => ({ ok: true, ctx: {} }),
  meta: { app: "store-api" },
});

const uploadImage = root
  .meta({ role: "admin", audit: true })
  .mutation(async ({ ctx }) => {
    console.log(ctx.meta.role); // "admin"
    console.log(ctx.meta.app);  // "store-api"
  });
```

---

## `.input()`

Adds a schema resolver to validate payloads and infer input types.

```ts
const updateProfile = procedure
  .input(
    zodResolver(
      z.object({
        name: z.string().min(1),
        bio: z.string().optional(),
      })
    ),
    { mode: "strict" }
  )
  .mutation(async ({ input }) => {
    return { success: true, data: input };
  });
```

The payload can be a plain object or a `FormData` object. `FormData` is normalized into a standard object via `Object.fromEntries(...)` before validation.

### Input Modes

The optional second argument to `.input()` overrides the global input mode configuration:

| Mode | Caller Type | Description |
| :--- | :--- | :--- |
| `strict` (Default) | Inferred schema shape | Uses the exact types from the resolver. |
| `patch` | Partial object | Uses a partial object with strict types for each key. |
| `form` | Loose object | declared keys are typed as `unknown` for browser/form inputs. |
| `partial` | Loose partial object | Loose, partial object shape for patch-style APIs. |

#### Multi-file Uploads
When using `FormData` with multiple files under the same key, Actyx RPC automatically detects duplicates and parses them as an array (e.g., `input.files` becomes `File[]`).

---

## `.output()`

While `.output()` is essential for OpenAPI documentation, its primary purpose is **Contract Enforcement**, **Transformation**, and **Runtime Sanitization**.

* **Contract Enforcement**: Restricts the TypeScript return type of your procedure.
* **Runtime Sanitization**: Strips away sensitive fields (like `passwordHash` or internal flags) from the return payload before it is serialized over the network.
* **Transformation**: Formats dates, numbers, or maps payload shapes on the fly.

```ts
const getProfile = procedure
  .output(
    zodResolver(
      z.object({
        id: z.string(),
        name: z.string(),
        email: z.string().email(),
      })
    )
  )
  .query(async ({ input }) => {
    const user = await db.user.find(input.id);
    return user; // Even if 'user' has 50 fields, only these 3 will be returned.
  });
```
