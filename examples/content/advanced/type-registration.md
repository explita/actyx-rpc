---
sidebar_position: 7
title: Global Type Augmentation
---

# Global Type Augmentation

Actyx RPC provides ambient declaration merging via the `ActyxRPC` namespace and module augmentation. This allows you to define application-wide domain types once in a TypeScript declaration file (`.d.ts`), and have them automatically propagate across both backend procedures (`@explita/actyx-rpc`) and frontend React hooks (`@explita/actyx-rpc-react`).

---

## Why Global Type Augmentation?

In fullstack TypeScript applications, certain types are shared between server procedures and client hooks:
- **Custom Error Reasons:** Application-specific error codes (e.g. `"KYC_REQUIRED"`, `"INSUFFICIENT_FUNDS"`) should be strictly validated when returned by `createContext` or thrown on the server, and provide autocompletion on the client in `error.reason`.
- **Pagination Cursors:** The cursor type (e.g. `number`, `string`, or compound `{ id: string; createdAt: Date }`) must match between server procedure inputs (`input.cursor`) and client pagination state (`pageParam`, `getNextPageParam`).

Instead of manually importing and supplying generic arguments on every procedure and hook call, declare them globally once.

---

## 1. Registering Custom Error Reasons (`RegisterCustomErrors`)

By default, Actyx RPC includes standard HTTP error reasons such as `"UNAUTHORIZED"`, `"FORBIDDEN"`, `"NOT_FOUND"`, `"VALIDATION_ERROR"`, etc.

To register your own domain-specific error reasons, add a `types/actyx-rpc.d.ts` file in your project:

```ts
// types/actyx-rpc.d.ts
declare global {
  namespace ActyxRPC {
    interface RegisterCustomErrors {
      reasons:
        | "KYC_REQUIRED"
        | "INSUFFICIENT_FUNDS"
        | "ORGANIZATION_SUSPENDED"
        | "TWO_FACTOR_REQUIRED";
    }
  }
}

export {};
```

### Server-Side Usage

The server's `createContext`, middlewares, and error handlers will now autocomplete and enforce these reasons:

```ts
const procedure = createProcedure({
  async createContext() {
    const user = await getUser();

    if (!user.isKycVerified) {
      // ✅ Autocomplete suggestions include "KYC_REQUIRED"!
      return { ok: false, reason: "KYC_REQUIRED" };
    }

    return { ok: true, ctx: { user } };
  },
});
```

### Client-Side Usage

In `@explita/actyx-rpc-react`, `error.reason` automatically narrows to your registered custom reasons:

```tsx
const { mutate, error } = useMutation(transferMoney, {
  onError(err) {
    if (err.reason === "INSUFFICIENT_FUNDS") {
      showTopUpModal();
    } else if (err.reason === "KYC_REQUIRED") {
      navigateToVerification();
    }
  },
});
```

---

## 2. Registering the Global Cursor Type (`RegisterCursor`)

When building infinite scroll or cursor-paginated feeds, procedures receive a `cursor` property in their input. Without registration, `input.cursor` defaults to `unknown` to prevent type mismatches.

By registering `RegisterCursor`, the cursor type is strongly typed across your entire stack:

```ts
// types/actyx-rpc.d.ts
declare global {
  namespace ActyxRPC {
    interface RegisterCursor {
      cursor: number; // or string, or { id: string; createdAt: string }
    }
  }
}

export {};
```

### Server Procedure Usage

Procedures that accept `ExtraInput` or cursor-based inputs will automatically type `cursor` as `number`:

```ts
export const getTimeline = procedure
  .input(z.object({ limit: z.number().default(20) }))
  .query(async ({ input }) => {
    // input.cursor is strictly typed as: number | undefined
    const items = await db.posts.findMany({
      take: input.limit,
      skip: input.cursor ? 1 : 0,
      cursor: input.cursor ? { id: input.cursor } : undefined,
    });

    return {
      items,
      nextCursor: items.length === input.limit ? items[items.length - 1].id : null,
    };
  });
```

### React Hook Usage

In `@explita/actyx-rpc-react`, `useInfiniteQuery` and `useWSInfiniteQuery` infer the cursor type automatically:

```tsx
const { data, fetchNext, hasNext } = useInfiniteQuery(getTimeline, {
  input: { limit: 20 },
  // pageParam is strictly typed as `number | undefined`!
  getNextPageParam: (lastPage) => lastPage.nextCursor,
});
```

---

## Compound Object Cursors

Cursors do not have to be primitives. For complex multi-column sorting (such as sorting by `createdAt` and `id` to handle ties), register an object shape:

```ts
// types/actyx-rpc.d.ts
declare global {
  namespace ActyxRPC {
    interface RegisterCursor {
      cursor: {
        id: string;
        createdAt: string;
      };
    }
  }
}
```

Now `input.cursor` on the server and `pageParam` on the client are both typed as `{ id: string; createdAt: string } | undefined`.

---

## Module Augmentation Alternative

If your project does not use ambient `declare global`, you can augment the `@explita/actyx-rpc` package directly:

```ts
// types/actyx-rpc.d.ts
declare module "@explita/actyx-rpc" {
  interface RegisterCursor {
    cursor: string;
  }

  interface RegisterCustomErrors {
    reasons: "RATE_LIMITED" | "RESOURCE_EXHAUSTED";
  }
}
```

> [!TIP]
> In monorepos containing both backend and frontend packages, declaring in `namespace ActyxRPC` inside a shared `global.d.ts` is recommended because both `@explita/actyx-rpc` and `@explita/actyx-rpc-react` listen to the ambient `ActyxRPC` namespace.
