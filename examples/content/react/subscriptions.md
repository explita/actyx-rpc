---
sidebar_position: 7
title: WebSocket Subscriptions
---

# WebSocket Subscriptions

For real-time event-driven communication (such as chat rooms, live dashboard updates, and notification pushes), Actyx RPC provides a dedicated `useWS` React hook.

This hook manages opening the WebSocket client connection, sending/receiving messages, fetching initial data, handling reconnect signals, and cleaning up connections when the component unmounts.

---

## `useWS`

To establish a client-side subscription or bi-directional socket connection:

```tsx
import { useWS } from "@explita/actyx-rpc/react";
import { onRoomEvent } from "@/backend/procedures";

function ChatRoom({ roomId }) {
  const { data, status, error, unsubscribe, send, isFetchingInitialData } = useWS({
    url: "/api/ws",
    enabled: !!roomId,
    initialData: async () => {
      // Option to fetch initial message history
      const res = await fetch(`/api/history?room=${roomId}`);
      return res.json();
    },
    onData(message) {
      console.log("New message received over socket:", message);
    },
    onSubscribed() {
      console.log("Successfully connected to room:", roomId);
    },
    onUnsubscribed() {
      console.log("Disconnected from room");
    },
  });

  if (isFetchingInitialData) return <p>Loading chat history...</p>;
  if (status === "connecting") return <p>Connecting to chat server...</p>;
  if (status === "error") return <p>Connection error: {error?.message}</p>;

  return (
    <div>
      <h3>Room Status: {status}</h3>
      <div className="messages">
        {data.map((msg, i) => (
          <p key={i}>{msg.text}</p>
        ))}
      </div>
      
      <button onClick={() => send({ text: "Hello!" })}>Send Message</button>
      <button onClick={unsubscribe}>Disconnect</button>
    </div>
  );
}
```

---

## Configuration Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `url` | `string` | — | The WebSocket server URL (e.g., `/api/ws` or `ws://localhost:3001/rpc`). Protocol will auto-correct to `ws:`/`wss:` depending on browser context. |
| `initialData` | `TOutput[] \| (() => MaybePromise<TOutput[]>)` | — | Initial data to prepopulate the data array with. |
| `enabled` | `boolean` | `true` | Set to `false` to prevent opening the socket connection automatically. |
| `onData` | `(data: TOutput) => void` | — | Callback run whenever a new event payload is received. |
| `onError` | `(err) => void` | — | Callback run when a connection or event error occurs. |
| `onSubscribed` | `() => void` | — | Callback run when the socket connection is successfully established. |
| `onUnsubscribed` | `() => void` | — | Callback run when the socket connection is closed. |

---

## Returned Properties

* **`data`**: An array containing all received event payloads and initial data, accumulated in order of arrival.
* **`status`**: Current connection state: `"idle" \| "connecting" \| "connected" \| "error"`.
* **`error`**: The error response object (if status is `"error"`).
* **`unsubscribe()`**: Function to cleanly disconnect and close the active WebSocket connection.
* **`send(data)`**: Sends a JSON-stringified message over the WebSocket. Safe to call before the connection is established (message will be queued and sent on open).
* **`isFetchingInitialData`**: `boolean` indicating whether the `initialData` promise is currently being resolved.
