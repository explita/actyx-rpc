---
sidebar_position: 9
title: React Utilities
---

# React Utilities

Additional helper hooks and client utilities to streamline state tracking and client-side streaming.

---

## `useIsMutating`

Track active mutations globally or filter specifically by a mutation key. This is useful for displaying global syncing spinners, loading bars, or button disables.

```tsx
import { useIsMutating } from "@explita/actyx-rpc-react";

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
import { useIsFetching } from "@explita/actyx-rpc-react";

function GlobalLoader() {
  const isFetching = useIsFetching();

  // Or filter by key prefix:
  // const isTodosFetching = useIsFetching("todos");

  if (!isFetching) return null;

  return <div className="loader">Loading data...</div>;
}
```

---

## `getCachedQueryClient()`

Access the active `QueryClient` outside of React components (such as within external event handlers or vanilla JS utilities) without violating React hook rules:

```ts
import { getCachedQueryClient } from "@explita/actyx-rpc-react";

export function handleExternalEvent() {
  const queryClient = getCachedQueryClient();
  if (queryClient) {
    queryClient.invalidate(["todos"]);
  }
}
```

---

## Standalone Streaming Clients (`SSEClient` & `WSClient`)

The `@explita/actyx-rpc-react` package includes lightweight, zero-dependency browser clients for SSE and WebSocket connections that can be used directly with or without React hooks:

```tsx
import { SSEClient, WSClient } from "@explita/actyx-rpc-react";

// Native browser SSE client with typed events and reconnect handling:
const sse = new SSEClient("/api/rpc/sse");
sse.onMessage((data) => console.log("SSE update:", data));

// Native browser WebSocket client:
const ws = new WSClient("wss://example.com/api/ws");
ws.send("chat:join", { roomId: "general" });
```
