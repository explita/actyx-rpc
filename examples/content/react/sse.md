---
sidebar_position: 8
title: Server-Sent Events (SSE)
---

# Server-Sent Events (SSE)

Actyx RPC provides native client-side hooks to connect to Server-Sent Event (SSE) streams, automatically managing connection lifecycles (opening on mount, cleaning up on unmount or dependency updates).

---

## `useSSE`

Connect and subscribe to a reactive backend SSE stream:

```tsx
import { useSSE } from "@explita/actyx-rpc-react";

function StockTicker({ symbol }) {
  const {
    data: history,
    lastData: latest,
    isConnected,
    error,
  } = useSSE({
    url: "/api/rpc/stock-ticker",
    params: { symbol },
    maxHistory: 10, // Keep historical list capped at 10 items
  });

  if (error) return <p>Error connecting: {error.message}</p>;

  return (
    <div>
      <h3>Connection Status: {isConnected ? "Live 🟢" : "Connecting... 🟡"}</h3>
      {latest && <p>Latest Price: ${latest.price}</p>}

      <h4>Recent Updates:</h4>
      <ul>
        {history.map((update, index) => (
          <li key={index}>${update.price}</li>
        ))}
      </ul>
    </div>
  );
}
```

### Options Configuration

| Option       | Type                     | Default | Description                                                                 |
| :----------- | :----------------------- | :------ | :-------------------------------------------------------------------------- |
| `url`        | `string`                 | —       | The HTTP SSE endpoint.                                                      |
| `params`     | `Record<string, string>` | —       | Query parameters to append to the URL.                                      |
| `headers`    | `Record<string, string>` | —       | Custom headers to pass with request.                                        |
| `enabled`    | `boolean`                | `true`  | Toggle to conditionally connect/disconnect.                                 |
| `maxHistory` | `number`                 | —       | Number of event payloads to accumulate in the `data` array before eviction. |
| `onData`     | `(data, event) => void`  | —       | Callback run on each event.                                                 |
| `onError`    | `(error) => void`        | —       | Callback run on connection error.                                           |

### Returned Properties

- **`data`**: Array of accumulated event payloads (oldest first).
- **`lastData`**: The most recently received event payload.
- **`event`**: The event name string of the most recently received event.
- **`isConnected`**: Boolean tracking active connection state.
- **`error`**: Error response object if connection fails.
- **`close()`**: Function to manually close the connection.
- **`clear()`**: Function to clear the accumulated history list.

---

## Client Proxy Integration

When using the **Client Proxy SDK** (`createClient`), any procedure defined with `.sse()` or `.stream()` exposes `.useSSE()` directly without needing manual URL configuration:

```tsx
import { rpc } from "@/lib/rpc";

function NotificationFeed() {
  const { lastData, isConnected } = rpc.notif.useSSE();

  return (
    <div>
      <p>Connection: {isConnected ? "Live 🟢" : "Connecting... 🟡"}</p>
      {lastData && <p>Update: {lastData.data}</p>}
    </div>
  );
}
```

Or consume it directly as an `AsyncIterable`:

```ts
for await (const chunk of rpc.notif()) {
  console.log("Direct chunk:", chunk);
}
```
