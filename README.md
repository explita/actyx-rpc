# Actyx RPC Monorepo

**Type-safe RPC and React query toolkit for composable server actions in TypeScript.**

[![License](https://img.shields.io/npm/l/@explita/actyx-rpc?style=flat-square&color=lightgray)](https://github.com/explita/actyx-rpc/blob/master/LICENSE)
[![Documentation](https://img.shields.io/badge/docs-actyx.explita.ng-blueviolet?style=flat-square)](https://actyx.explita.ng)

---

## 📖 Complete Documentation

Visit our full documentation portal and interactive playground:

👉 **[actyx.explita.ng](https://actyx.explita.ng)**

---

## Packages in this Monorepo

| Package                                                      | Version                                                                                                                                              | Description                                                                                                                      |
| :----------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------- |
| [**`@explita/actyx-rpc`**](./packages/server/README.md)      | [![npm](https://img.shields.io/npm/v/@explita/actyx-rpc?style=flat-square&color=blue)](https://www.npmjs.com/package/@explita/actyx-rpc)             | Core RPC engine, procedure builders, middleware, execution policies, validation resolvers, and server adapters                   |
| [**`@explita/actyx-rpc-react`**](./packages/react/README.md) | [![npm](https://img.shields.io/npm/v/@explita/actyx-rpc-react?style=flat-square&color=blue)](https://www.npmjs.com/package/@explita/actyx-rpc-react) | First-class React client, zero-dependency `QueryClient`, reactive hooks (`useQuery`, `useMutation`, etc.), and streaming clients |

---

## Installation

```bash
# Fullstack (Next.js / Remix / TanStack Start):
npm install @explita/actyx-rpc @explita/actyx-rpc-react

# Server / Backend API Only:
npm install @explita/actyx-rpc

# React Frontend Only:
npm install @explita/actyx-rpc-react
```

---

## Quick Overview

### 1. Define Server Procedures (`@explita/actyx-rpc`)

```ts
// server/procedures.ts
import { createProcedure } from "@explita/actyx-rpc";
import { z } from "zod";
import { zodResolver } from "@explita/actyx-rpc/resolvers/zod";

const procedure = createProcedure({
  async createContext() {
    return { ok: true, ctx: { userId: "user_123" } };
  },
});

export const getUser = procedure
  .input(zodResolver(z.object({ id: z.string() })))
  .query(async ({ ctx, input }) => {
    return { id: input.id, name: "Ade Explita", userId: ctx.userId };
  });
```

### 2. Consume in React (`@explita/actyx-rpc-react`)

```tsx
// app/users.tsx
"use client";

import { useQuery } from "@explita/actyx-rpc-react";
import { getUser } from "@/server/procedures";

export function UserProfile({ id }: { id: string }) {
  const {
    data: user,
    isLoading,
    error,
  } = useQuery(() => getUser({ id }), { queryKey: ["user", id] });

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;
  return <h1>{user.name}</h1>;
}
```

---

## License

MIT © [Explita](https://github.com/explita)
