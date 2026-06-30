---
sidebar_position: 9
title: React Utilities
---

# React Utilities

Additional helper hooks and path imports to streamline state tracking and client bundler optimization.

---

## `useIsMutating`

Track active mutations globally or filter specifically by a mutation key. This is useful for displaying global syncing spinners, loading bars, or button disables.

```tsx
import { useIsMutating } from "@explita/actyx-rpc/react";

function GlobalSpinner() {
  const isMutating = useIsMutating();

  // Or filter specifically by mutation key:
  // const isAddingTodo = useIsMutating(["addTodo"]);

  if (!isMutating) return null;

  return <div className="spinner">Syncing with database...</div>;
}
```

---

## `useIsFetching`

Track whether any query is currently fetching globally or filtered by a specific key prefix:

```tsx
import { useIsFetching } from "@explita/actyx-rpc/react";

function GlobalLoader() {
  const isFetching = useIsFetching();

  // Or filter by key prefix:
  // const isTodosFetching = useIsFetching("todos");

  if (!isFetching) return null;

  return <div className="loader">Loading data...</div>;
}
```

---

## Client-Only Subpaths

When developing for browser environments (such as Next.js Client Components) or building single-page applications, you can import clients directly from subpaths. 

This prevents your client bundlers from pulling in node-only/server-side dependencies (like `fs`, `node:async_hooks`, etc.), keeping your JS bundle size minimal.

```tsx
// Safely import SSEClient without pulling in server/node code:
import { SSEClient } from "@explita/actyx-rpc/client/sse";

// Safely import WebSocket client:
import { WSClient } from "@explita/actyx-rpc/client/ws";
```
