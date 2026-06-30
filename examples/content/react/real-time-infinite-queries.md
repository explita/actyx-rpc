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
import { useWSInfiniteQuery } from "@explita/actyx-rpc/react";
import { getFeedPosts } from "@/backend/procedures";

function LiveFeed() {
  const {
    data: posts,
    fetchNext,
    hasNext,
    isFetching,
    isConnected,
    error,
  } = useWSInfiniteQuery(getFeedPosts, {
    // Infinite query options
    queryOpts: {
      initialInput: { limit: 10 },
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      queryKey: ["feed"],
    },
    // WebSocket options
    url: "/api/ws/feed",
    // Called on each incoming WS message
    onData({ data: newPost, prepend }) {
      // Prepend incoming live posts to the cache
      prepend(newPost);
    },
  });

  return (
    <div>
      <p>Status: {isConnected ? "🟢 Live" : "🔴 Disconnected"}</p>
      <ul>
        {posts.map((post) => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
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
| `initialInput` | `WithoutCursor<TInput>` | — | Base input parameters for the first page fetch. |
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
| `initialData` | `data \| (() => data)` | — | Pre-populate cache on mount. |

**WebSocket Options** (all `useWS` options except `onData`):

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `url` | `string` | — | WebSocket server URL. |
| `initialData` | `TOutput[] \| (() => MaybePromise<TOutput[]>)` | — | Pre-populate the data array. |
| `enabled` | `boolean` | `true` | Set to `false` to prevent connecting. |
| `onData` | `(opts: WSEventContext) => void` | — | Callback receiving `{ data, action, allData, append, prepend, update }` for custom cache mutations. |
| `onError` | `(err) => void` | — | Connection error callback. |
| `onSubscribed` | `() => void` | — | Connection established callback. |
| `onUnsubscribed` | `() => void` | — | Connection closed callback. |
| `onWindowFocus` | `(opts: { data: TData[]; refetch: () => Promise<void> }) => void` | — | Callback when window regains focus. Receives infinite query data and a refetch function. |
| `onReconnect` | `(opts: { data: TData[]; refetch: () => Promise<void> }) => void` | — | Callback when network reconnects. Receives infinite query data and a refetch function. |

### Returned Properties

Returns all properties from `useInfiniteQuery` **plus** the following from `useWS`:

| Property | Type | Description |
| :--- | :--- | :--- |
| `send` | `(data) => void` | Send a message over the WebSocket. |
| `unsubscribe` | `() => void` | Manually close the WebSocket connection. |
| `status` | `"idle" \| "connecting" \| "connected" \| "error"` | Connection state. |

All cache mutation helpers (`remove`, `update`, `prepend`, `append`, `insert`, `setPages`, `snapshot`) from the underlying infinite query are also available.

---

## `useSSEInfiniteQuery`

Combines `useInfiniteQuery` with `useSSE` for one-way SSE-powered infinite lists.

```tsx
import { useSSEInfiniteQuery } from "@explita/actyx-rpc/react";
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
      initialInput: { limit: 20 },
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

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `url` | `string` | — | SSE endpoint URL. |
| `params` | `Record<string, string>` | — | Query parameters for the SSE URL. |
| `headers` | `Record<string, string>` | — | Custom request headers. |
| `enabled` | `boolean` | `true` | Toggle connection on/off. |
| `maxHistory` | `number` | — | Limit accumulated event history. |
| `onData` | `(opts: WSEventContext & { event?: string }) => void` | — | Callback receiving `{ data, allData, append, prepend, update, event }`. |
| `onError` | `(err) => void` | — | Connection error callback. |

### Returned Properties

Returns all properties from `useInfiniteQuery` **plus** the following from `useSSE`:

| Property | Type | Description |
| :--- | :--- | :--- |
| `lastData` | `TData \| undefined` | Most recent SSE event payload. |
| `event` | `string \| undefined` | Name of the most recent SSE event. |
| `isConnected` | `boolean` | Connection state. |
| `close` | `() => void` | Manually close the SSE connection. |
| `clear` | `() => void` | Clear accumulated data history. |

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
