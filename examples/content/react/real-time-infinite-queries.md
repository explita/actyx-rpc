---
sidebar_position: 8
title: Real-Time Infinite Queries
---

# Real-Time Infinite Queries

For scenarios where you need paginated, infinite-scrolling data combined with real-time live updates, Actyx RPC provides two combination hooks: `useWSInfiniteQuery` (WebSocket) and `useSSEInfiniteQuery` (Server-Sent Events).

These hooks attach a real-time transport stream on top of the `useInfiniteQuery` pagination engine. Incoming live events are automatically appended to the cached page data and can also trigger custom cache mutations (prepend, update, remove) before the data reaches your component.

---

## `useWSInfiniteQuery`

Combines `useInfiniteQuery` with `useWS` for bi-directional WebSocket-powered infinite lists.

```tsx
import { useWSInfiniteQuery } from "@explita/actyx-rpc-react";
import { getFeedPosts } from "@/backend/procedures";
import { useState, useCallback } from "react";

function LiveFeed() {
  const [input, setInput] = useState("");

  const {
    data: posts,
    fetchNext,
    hasNext,
    isFetching,
    status,
    connect,
    disconnect,
    send,
    isTyping,
    typingUsers,
    sendTyping,
    error,
    queryError,
  } = useWSInfiniteQuery(getFeedPosts, {
    // Infinite query options
    queryOpts: {
      input: { limit: 10 },
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      queryKey: ["feed"],
    },
    // WebSocket options
    url: "/api/ws/feed",
    typing: {
      timeout: "2s",
      throttle: "1.5s",
      currentUserId: "user-123", // Filters out self and stamps outgoing typing events
      getUser: (data) => data.user,
    },
    // Called on each incoming WS message
    onData({ event, prepend }) {
      // Prepend incoming live posts to the cache
      const post = event?.data ?? event;
      prepend(post);
    },
    onConnected() {
      console.log("WebSocket connected to feed!");
    },
    onDisconnected(evt) {
      console.log("WebSocket disconnected from feed, code:", evt.code);
    },
  });

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInput(e.target.value);
      if (e.target.value.trim()) {
        sendTyping();
      }
    },
    [sendTyping],
  );

  return (
    <div>
      <div className="status-bar">
        <p>Status: {status === "connected" ? "🟢 Live" : `🔴 ${status}`}</p>
        {status === "connected" ? (
          <button onClick={disconnect}>Disconnect Stream</button>
        ) : (
          <button onClick={connect}>Connect Stream</button>
        )}
      </div>

      <ul>
        {posts.map((post) => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>

      {isTyping && (
        <p className="typing">
          {typingUsers.map((u) => u.name ?? u.id).join(", ")} is typing...
        </p>
      )}

      {hasNext && (
        <button onClick={() => fetchNext()} disabled={isFetching}>
          {isFetching ? "Loading..." : "Load More"}
        </button>
      )}
    </div>
  );
}
```

### Configuration

`useWSInfiniteQuery` accepts a combined options object with two groups:

**Infinite Query Options** (`queryOpts`):

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `input` | `WithoutCursor<TInput>` | — | Base input parameters for the first page fetch. |
| `initialPageParam` | `string \| number` | `undefined` | Cursor for the first page. |
| `getNextPageParam` | `(lastPage, allPages) => cursor` | — | Determines the next cursor. |
| `queryKey` | `unknown[]` | — | Cache identification key. |
| `maxPages` | `number` | — | Maximum pages to keep in cache. |
| `enabled` | `boolean` | `true` | Enable/disable fetching on mount. |
| `staleTime` | `number \| string` | `0` | Time before data is considered stale. |
| `gcTime` | `number \| string` | `5min` | Time before unused cache is garbage collected. |
| `refetchInterval` | `number` | `0` | Polling interval in ms. |
| `refetchOnWindowFocus` | `boolean` | `false` | Refetch on window focus. |
| `refetchOnReconnect` | `boolean \| "always"` | `true` | Refetch on network restore. |
| `keepPreviousData` | `boolean` | `true` | Keep old data visible during refetch instead of flashing an empty state. |
| `dedupKey` | `(item: TPage) => any` | — | Key selector function for automatic in-place upsert deduplication when appending or prepending incoming messages. |
| `initialData` | `data \| (() => data)` | — | Pre-populate cache on mount. |

**WebSocket Options** (all `useWS` options except raw `initialData`):

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `url` | `string` | — | WebSocket server URL. |
| `enabled` | `boolean` | `true` | Set to `false` to prevent connecting automatically. |
| `typing` | `false \| WSTypingOptions` | `false` | Enables built-in typing indicator management (`isTyping`, `typingUsers`, `sendTyping`). Requires `currentUserId`. |
| `events` | `TEvent` | — | Type marker for discriminating incoming event union shapes. |
| `schema` | `TData` | — | Type witness used to infer the WebSocket live item shape without explicit generics. |
| `onData` | `(opts: WSEventContext) => void` | — | Callback receiving `{ event, action, items, append, prepend, insert, update }` for custom cache mutations. |
| `onError` | `(err: ErrorResponse) => void` | — | WebSocket connection error callback. |
| `onConnected` | `() => void` | — | Connection established callback. *(Also supports `onSubscribed` for backwards compatibility).* |
| `onDisconnected` | `(evt: CloseEvent) => void` | — | Connection closed callback. Receives the `CloseEvent`. *(Also supports `onUnsubscribed` for backwards compatibility).* |
| `onWindowFocus` | `(opts: InfiniteQueryContext) => void` | — | Callback when window regains focus. Receives extended context `{ data, pages, pageParams, refetch, reset, prepend, append, insert, update, remove, setPages, snapshot }`. |
| `onReconnect` | `(opts: InfiniteQueryContext) => void` | — | Callback when network reconnects. Receives the same extended infinite query context as `onWindowFocus`. |

### Returned Properties

Returns all properties from `useInfiniteQuery` **plus** WebSocket controls and typing indicators:

| Property | Type | Description |
| :--- | :--- | :--- |
| `data` | `TData[]` | Flattened collection of items across all pages, reactively merged with incoming WebSocket events. |
| `send` | `(data) => void` | Send a message over the WebSocket connection. |
| `connect` | `() => void` | Initiates or re-establishes the WebSocket connection. |
| `disconnect` | `() => void` | Cleanly closes the WebSocket connection. |
| `status` | `WsStatus` | Current socket connection state: `"idle" \| "connecting" \| "reconnecting" \| "connected" \| "error"`. |
| `error` | `ErrorResponse \| undefined` | Active WebSocket connection error. |
| `queryError` | `ErrorResponse \| null` | Error from the underlying infinite query HTTP fetch, if any. |
| `isTyping` | `boolean` | Whether any other user is currently typing. |
| `typingUsers` | `TTypingUser[]` | List of other users actively typing. |
| `sendTyping` | `(payload?) => void` | Sends a throttled typing indicator event over the active socket. |

All cache mutation helpers (`remove`, `update`, `prepend`, `append`, `insert`, `setPages`, `snapshot`) from the underlying infinite query are also directly available on the returned object.

---

## `useSSEInfiniteQuery`

Combines `useInfiniteQuery` with `useSSE` for one-way SSE-powered infinite lists.

```tsx
import { useSSEInfiniteQuery } from "@explita/actyx-rpc-react";
import { getNotifications } from "@/backend/procedures";

function NotificationFeed() {
  const {
    data: notifications,
    fetchNext,
    hasNext,
    isConnected,
    lastData: latestNotification,
    event: lastEvent,
    error,
  } = useSSEInfiniteQuery(getNotifications, {
    // Infinite query options
    queryOpts: {
      input: { limit: 20 },
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      queryKey: ["notifications"],
    },
    // SSE options
    url: "/api/sse/notifications",
    maxHistory: 50,
    // Called on each SSE event
    onData({ data: notification, prepend, event }) {
      console.log(`Received event: ${event}`);
      prepend(notification);
    },
  });

  return (
    <div>
      <p>Status: {isConnected ? "🟢 Connected" : "🔴 Disconnected"}</p>
      {latestNotification && (
        <p className="latest">Latest: {latestNotification.title}</p>
      )}
      <ul>
        {notifications.map((n) => (
          <li key={n.id}>{n.title}</li>
        ))}
      </ul>
      {hasNext && (
        <button onClick={() => fetchNext()} disabled={isFetching}>
          Load Older
        </button>
      )}
    </div>
  );
}
```

### Configuration

**Infinite Query Options** (`queryOpts`): Same as `useWSInfiniteQuery` above.

**SSE Options** (all `useSSE` options except `onData`):

| Option       | Type                                                  | Default | Description                                                             |
| :----------- | :---------------------------------------------------- | :------ | :---------------------------------------------------------------------- |
| `url`        | `string`                                              | —       | SSE endpoint URL.                                                       |
| `params`     | `Record<string, string>`                              | —       | Query parameters for the SSE URL.                                       |
| `headers`    | `Record<string, string>`                              | —       | Custom request headers.                                                 |
| `enabled`    | `boolean`                                             | `true`  | Toggle connection on/off.                                               |
| `maxHistory` | `number`                                              | —       | Limit accumulated event history.                                        |
| `onData`     | `(opts: WSEventContext & { event?: string }) => void` | —       | Callback receiving `{ data, allData, append, prepend, update, event }`. |
| `onError`    | `(err) => void`                                       | —       | Connection error callback.                                              |

### Returned Properties

Returns all properties from `useInfiniteQuery` **plus** the following from `useSSE`:

| Property      | Type                  | Description                        |
| :------------ | :-------------------- | :--------------------------------- |
| `lastData`    | `TData \| undefined`  | Most recent SSE event payload.     |
| `event`       | `string \| undefined` | Name of the most recent SSE event. |
| `isConnected` | `boolean`             | Connection state.                  |
| `close`       | `() => void`          | Manually close the SSE connection. |
| `clear`       | `() => void`          | Clear accumulated data history.    |

---

## `onData` Callback

Both hooks accept an `onData` callback that fires on every incoming event/message. It provides the raw payload along with helper functions to manipulate the infinite query cache directly:

```ts
onData({ data, action, allData, append, prepend, update, event }) {
  // data       - The incoming event payload
  // action     - `"added"` or `"updated"` (dedup key matched an existing item)
  // allData    - The current flattened data array from all pages
  // append     - Append item to the last page
  // prepend    - Prepend item to the first page
  // update     - Update a matching item by index or predicate
  // event      - (SSE only) The SSE event name string
}
```

If `onData` is **not provided**, the hooks default to calling `append(data)` automatically on each incoming event/message.

---

## Client Proxy Integration

When using the **Client Proxy SDK** (`createClient`), infinite query procedures provide `.useSSEInfiniteQuery` and `.useWSInfiniteQuery` directly. Because real-time streaming connects to an active stream rather than the query endpoint, the streaming target is specified via `stream` (or `ws`):

```tsx
import { rpc } from "@/lib/rpc/client";

function LiveTodoList() {
  const { data: todos, fetchNext, hasNext } = rpc.todos.list.useSSEInfiniteQuery({
    // Pass another proxy procedure directly (type-safe)
    stream: rpc.notif.sse,

    // Or pass an explicit URL string:
    // stream: "/api/rpc/notif.sse",

    queryOpts: {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  });

  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>{todo.text}</li>
      ))}
    </ul>
  );
}
```

