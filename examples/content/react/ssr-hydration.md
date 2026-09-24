---
sidebar_position: 3
title: SSR Hydration & Persistence
---

# Universal SSR Hydration & State Persistence

`@explita/actyx-rpc-react` provides universal support for server-side prefetching, zero-flicker client hydration, and offline state persistence across **Next.js**, **Remix**, **Astro**, **custom SSR**, and **browser storage**.

---

## The Hydration Lifecycle

When fetching data solely on the client, users experience an initial loading skeleton flash:

```
Without Hydration:
[Server HTML (Empty / Skeleton)] ──> [Client JS Boots] ──> [Client Fetch Dispatched] ──> [UI Renders Data]
                                                               ↑ Visible Loading Flash ↑

With Actyx Hydration:
[Server Prefetch + Render Data] ──> [Client Hydrates from Cache] ──> [UI Rendered Instantly (No Flash)]
```

`<HydrationBoundary>` acts as a universal bridge between serialized server state and the client `QueryClient`:
1. **Server Phase**: Prefetches queries directly into an isolated server `QueryClient` during request or build time.
2. **Dehydration**: Serializes the populated cache into a plain JSON snapshot via `dehydrate(queryClient)`.
3. **Hydration**: `<HydrationBoundary state={dehydratedState}>` injects the snapshot synchronously into the client cache during initial render.
4. **Instant Resolution**: `useQuery` immediately finds the cached data (`isLoading: false`, `isSuccess: true`), rendering real content with zero loading flicker.

---

## 1. Next.js App Router (Server Components)

In Next.js App Router, prefetch directly in your Server Component (`page.tsx` or `layout.tsx`) and wrap client children:

```tsx
// app/todos/page.tsx (Server Component)
import { QueryClient, dehydrate, HydrationBoundary } from "@explita/actyx-rpc-react";
import { appRouter } from "@/lib/rpc/router";
import { TodosClientView } from "./todos-client-view";

export default async function TodosPage() {
  const queryClient = new QueryClient();

  // Prefetch queries on the server (calls router procedures directly)
  await Promise.all([
    queryClient.prefetchQuery(["todos", "list"], () => appRouter.todos.list()),
    queryClient.prefetchQuery(["health"], () => appRouter.health()),
  ]);

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <TodosClientView />
    </HydrationBoundary>
  );
}
```

```tsx
// app/todos/todos-client-view.tsx (Client Component)
"use client";

import { rpc } from "@/lib/rpc/client";

export function TodosClientView() {
  // Renders immediately with prefetched data — no loading skeleton flash!
  const { data: todos, isLoading } = rpc.todos.list.useQuery();

  return (
    <ul>
      {todos?.data.map((todo) => (
        <li key={todo.id}>{todo.text}</li>
      ))}
    </ul>
  );
}
```

---

## 2. Remix & React Router v7

In Remix or React Router v7, prefetch in your server `loader` and pass the dehydrated state to your route component:

```tsx
// app/routes/todos.tsx
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { QueryClient, dehydrate, HydrationBoundary } from "@explita/actyx-rpc-react";
import { appRouter } from "@/backend/router";
import { rpc } from "@/lib/rpc/client";

export async function loader({ request }: LoaderFunctionArgs) {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery(["todos", "list"], () => appRouter.todos.list());

  return json({
    dehydratedState: dehydrate(queryClient),
  });
}

export default function TodosRoute() {
  const { dehydratedState } = useLoaderData<typeof loader>();

  return (
    <HydrationBoundary state={dehydratedState}>
      <TodosList />
    </HydrationBoundary>
  );
}

function TodosList() {
  const { data: todos } = rpc.todos.list.useQuery();
  return <div>{todos?.data.length} todos loaded instantly</div>;
}
```

---

## 3. Astro (React Islands)

In Astro, prefetch in the component frontmatter and pass the plain JSON state to your React island:

```astro
---
// src/pages/dashboard.astro (Astro Server Frontmatter)
import { QueryClient, dehydrate } from "@explita/actyx-rpc-react";
import { appRouter } from "../backend/router";
import DashboardIsland from "../components/DashboardIsland.tsx";

const queryClient = new QueryClient();
await queryClient.prefetchQuery(["health"], () => appRouter.health());
const dehydratedState = dehydrate(queryClient);
---

<DashboardIsland state={dehydratedState} client:load />
```

```tsx
// src/components/DashboardIsland.tsx (React Island)
import { HydrationBoundary } from "@explita/actyx-rpc-react";
import { rpc } from "../lib/rpc/client";

export default function DashboardIsland({ state }: { state: any }) {
  return (
    <HydrationBoundary state={state}>
      <StatusWidget />
    </HydrationBoundary>
  );
}

function StatusWidget() {
  const { data } = rpc.health.useQuery();
  return <span>Status: {data?.status}</span>;
}
```

---

## 4. Hydrating Unwrapped Queries (`unwrap: true`)

When a client component consumes a query with `unwrap: true`, Actyx RPC strips the outer response envelope (`{ data: ... }`) so that `query.data` yields the raw payload directly (e.g. `Item[]`, `Item`, or `[]`).

> [!IMPORTANT]
> **Matching Server & Client Payload Shapes**:
> When/if the client's `useQuery` uses `unwrap: true`, the server prefetch **must await the call and return only the inner data/data[]/[]** (or supply `unwrap: true` to `prefetchQuery`). If the server dehydrates the raw `{ data: ... }` envelope, the client cache will hold mismatched types upon hydration.

### Pattern 1: Await and Return Inner Payload (Recommended)

In your server component or route loader, await the procedure tuple and return only `res?.data`:

```tsx
// app/todos/page.tsx (Server Component)
import { QueryClient, dehydrate, HydrationBoundary } from "@explita/actyx-rpc-react";
import { appRouter } from "@/lib/rpc/router";
import { TodosList } from "./todos-list";

export default async function TodosPage() {
  const queryClient = new QueryClient();

  // ⚡ When client uses unwrap: true, server awaits the call and returns only data/data[]/[]
  await queryClient.prefetchQuery(["todos", "list"], async () => {
    const [res] = await appRouter.todos.list();
    return res?.data ?? [];
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TodosList />
    </HydrationBoundary>
  );
}
```

```tsx
// app/todos/todos-list.tsx (Client Component)
"use client";

import { rpc } from "@/lib/rpc/client";

export function TodosList() {
  // data is typed directly as Todo[] (or [] on empty)
  const { data: todos = [] } = rpc.todos.list.useQuery({ unwrap: true });

  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  );
}
```

### Pattern 2: Passing `unwrap: true` to `prefetchQuery`

Alternatively, pass `unwrap: true` directly to `queryClient.prefetchQuery`:

```tsx
// Server Component / Loader
await queryClient.prefetchQuery(
  ["todos", "list"],
  () => appRouter.todos.list(),
  { unwrap: true }
);

// Or using object options:
await queryClient.prefetchQuery({
  queryKey: ["todos", "list"],
  queryFn: () => appRouter.todos.list(),
  unwrap: true,
});
```

When `unwrap: true` is provided, `prefetchQuery` automatically extracts the inner `.data` property from the resolved procedure result before storing it in the cache, guaranteeing zero hydration discrepancies.

### Comparison: Standard vs Unwrapped Hydration

| Setting | Server Prefetch Return | Cached Value | Client Access |
| :--- | :--- | :--- | :--- |
| **Standard** (`unwrap: false`) | `() => appRouter.todos.list()` | `{ data: Todo[] }` | `todos?.data.map(...)` |
| **Unwrapped** (`unwrap: true`) | `async () => (await appRouter.todos.list())[0]?.data ?? []`<br/>*or* `{ unwrap: true }` | `Todo[]` or `[]` | `todos?.map(...)` |

---

## 5. Offline State Persistence (LocalStorage / IndexedDB)

`<HydrationBoundary>` works in client-only apps to restore previously saved sessions or enable offline-first browsing:

```tsx
import { useEffect, useState } from "react";
import { QueryClient, dehydrate, HydrationBoundary } from "@explita/actyx-rpc-react";

export function OfflineApp({ children }: { children: React.ReactNode }) {
  const [savedState, setSavedState] = useState<any>(null);

  // 1. Restore previous cache on boot
  useEffect(() => {
    const raw = localStorage.getItem("APP_CACHE");
    if (raw) setSavedState(JSON.parse(raw));
  }, []);

  // 2. Persist cache to disk before page unload
  useEffect(() => {
    const onUnload = () => {
      const state = dehydrate(queryClient);
      localStorage.setItem("APP_CACHE", JSON.stringify(state));
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  return (
    <HydrationBoundary state={savedState}>
      {children}
    </HydrationBoundary>
  );
}
```

---

## Cache Garbage Collection (`gcTime`)

Unobserved queries (prefetched or previously viewed queries where all components unmounted) are automatically garbage collected:

```tsx
const queryClient = new QueryClient({
  queries: {
    staleTime: "1m", // Data considered fresh for 1 minute
    gcTime: "5m",    // Unused cache entries purged after 5 minutes of inactivity
  },
});
```

- When all components observing a query key unmount, a garbage collection timer starts (`gcTime`, default: **5 minutes**).
- If a component remounts before `gcTime` expires, the GC timer is automatically cancelled and the cached data is reused.
- Setting `gcTime: Infinity` disables garbage collection for that query.

---

## LRU Cache Eviction (`maxCacheSize`)

To prevent memory leaks in long-running single-page applications or dashboard environments, `QueryClient` enforces an LRU (Least Recently Used) cache limit:

```tsx
const queryClient = new QueryClient({
  maxCacheSize: 100, // Limit cache to 100 entries (default: 250)
});
```

When cache entries exceed `maxCacheSize`, the oldest inactive queries (queries with **0 active observers**) are pruned in order of their `updatedAt` timestamp. Active queries currently mounted on screen are never evicted.

---

## Manual Cache Eviction

You can manually remove queries from cache using `removeQueries` on `QueryClient` or `.remove()` on your procedure proxy:

```tsx
// 1. Via QueryClient
queryClient.removeQueries(["todos"]); // Purges all queries starting with "todos"
queryClient.removeQueries((entry) => entry.isStale); // Custom predicate

// 2. Via Procedure Proxy
rpc.todos.list.remove();
```
