---
sidebar_position: 7
title: WebSocket Subscriptions
---

# WebSocket Subscriptions

For real-time event-driven communication (such as chat rooms, live dashboard updates, and notification pushes), Actyx RPC provides a dedicated `useSubscription` React hook.

This hook manages opening the WebSocket client connection, sending subscribe handshake requests, handling reconnect signals, and cleaning up connections when the component unmounts.

---

## `useSubscription`

To establish a client-side subscription:

```tsx
import { useSubscription } from "@explita/actyx-rpc/react";
import { onRoomEvent } from "@/backend/procedures";

function ChatRoom({ roomId }) {
  // Pass the pre-bound subscription procedure (with input arguments)
  const { data, status, error, unsubscribe } = useSubscription(
    onRoomEvent({ roomId }),
    {
      wsUrl: "ws://localhost:3001/rpc",
      enabled: !!roomId,
      onData(message) {
        console.log("New message received over socket:", message);
      },
      onSubscribed() {
        console.log("Successfully connected to room:", roomId);
      },
      onUnsubscribed() {
        console.log("Disconnected from room");
      },
    }
  );

  if (status === "connecting") return <p>Connecting to chat server...</p>;
  if (status === "error") return <p>Connection error: {error?.message}</p>;

  return (
    <div>
      <h3>Room Status: {status}</h3>
      {data && <p>Latest Message: {data.text}</p>}
      
      <button onClick={unsubscribe}>Disconnect</button>
    </div>
  );
}
```

---

## Configuration Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `wsUrl` | `string` | — | The WebSocket server URL (e.g., `ws://localhost:3001/rpc`). Protocol will auto-correct to `ws:`/`wss:` depending on browser context. |
| `enabled` | `boolean` | `true` | Set to `false` to prevent opening the socket connection automatically. |
| `onData` | `(data) => void` | — | Callback run whenever a new event payload is received. |
| `onError` | `(err) => void` | — | Callback run when a connection or event error occurs. |
| `onSubscribed` | `() => void` | — | Callback run when the subscription handshake successfully resolves. |
| `onUnsubscribed` | `() => void` | — | Callback run when the socket connection is closed. |

---

## Returned Properties

* **`data`**: The most recently received event payload, or `undefined` if no messages have arrived yet.
* **`status`**: Current connection state: `"idle" \| "connecting" \| "connected" \| "error"`.
* **`error`**: The error response object (if status is `"error"`).
* **`unsubscribe()`**: Function to cleanly disconnect and close the active WebSocket subscription.
