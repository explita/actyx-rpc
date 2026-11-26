---
sidebar_position: 7
title: WebSocket Subscriptions
---

# WebSocket Subscriptions

For real-time event-driven communication (such as chat rooms, live dashboard updates, and notification pushes), Actyx RPC provides a dedicated `useWS` React hook.

This hook manages opening the WebSocket client connection, bidirectional messaging, automatic reconnection, data deduplication, initial history loading, and built-in typing indicator management.

---

## `useWS`

To establish a client-side subscription or bi-directional socket connection:

```tsx
import { useWS } from "@explita/actyx-rpc-react";
import { useState, useCallback } from "react";

type ChatMessage = {
  id: string;
  text: string;
  user: { id: string; name: string };
};

function ChatRoom({ roomId }: { roomId: string }) {
  const [input, setInput] = useState("");

  const {
    data: messages,
    status,
    error,
    connect,
    disconnect,
    send,
    isTyping,
    typingUsers,
    sendTyping,
    isFetchingInitialData,
  } = useWS({
    url: "/api/ws",
    enabled: !!roomId,
    // Automatic typing indicators
    typing: {
      timeout: "2s",
      throttle: "1.5s",
      currentUserId: "user-123", // Filters out self and stamps outgoing typing events
      getUser: (data) => data.user,
    },
    // Automatic exponential backoff reconnection
    reconnect: {
      maxAttempts: 10,
      delay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 30000),
    },
    // Optional initial message history loader
    initialData: async () => {
      const res = await fetch(`/api/history?room=${roomId}`);
      return res.json();
    },
    onConnected() {
      console.log("Connected to room:", roomId);
    },
    onDisconnected(evt) {
      console.log("Disconnected, code:", evt.code, "clean:", evt.wasClean);
    },
    onData(message, action) {
      console.log(`Message ${action}:`, message);
    },
    // Deduplicate incoming messages by unique id
    dedupKey: (item: ChatMessage) => item.id,
    schema: {} as ChatMessage,
  });

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (e.target.value.trim()) {
      sendTyping();
    }
  }, [sendTyping]);

  const handleSend = () => {
    if (!input.trim()) return;
    send({ text: input.trim() });
    setInput("");
  };

  if (isFetchingInitialData) return <p>Loading chat history...</p>;
  if (status === "connecting") return <p>Connecting to chat server...</p>;
  if (status === "reconnecting") return <p>Connection lost. Reconnecting...</p>;
  if (status === "error") return <p>Connection error: {error?.message}</p>;

  return (
    <div>
      <div className="header">
        <h3>Room: {roomId} ({status})</h3>
        {status === "connected" ? (
          <button onClick={disconnect}>Disconnect</button>
        ) : (
          <button onClick={connect}>Connect</button>
        )}
      </div>

      <div className="messages">
        {messages.map((msg) => (
          <p key={msg.id}>
            <strong>{msg.user.name}:</strong> {msg.text}
          </p>
        ))}
      </div>

      {/* Typing indicator */}
      {isTyping && (
        <p className="typing-indicator">
          {typingUsers.map((u) => u.name).join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
        </p>
      )}

      <div className="input-row">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Type a message..."
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button onClick={handleSend} disabled={status !== "connected"}>
          Send
        </button>
      </div>
    </div>
  );
}
```

---

## Connection Lifecycle Controls

Instead of permanently closing on unmount without recovery, `useWS` provides explicit connection lifecycle methods:

* **`connect()`**: Establishes or manually re-opens the WebSocket connection.
* **`disconnect()`**: Cleanly closes the active WebSocket connection and sets `status` to `"idle"`. Automatic reconnection attempts are cancelled until `connect()` is explicitly called again.

### Connection States (`status`)

The `status` property tracks the exact lifecycle of the WebSocket client:

| Status | Description |
| :--- | :--- |
| `"idle"` | The socket is disconnected or not yet started (e.g. `enabled: false` or after `disconnect()`). |
| `"connecting"` | The browser is currently attempting to establish the initial connection. |
| `"reconnecting"` | The connection was lost unexpectedly and the client is currently waiting or trying to reconnect. |
| `"connected"` | The connection is open and active. |
| `"error"` | A connection error occurred or reconnect attempts were exhausted. |

---

## Configuration Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `url` | `string` | — | The WebSocket server URL (e.g., `/api/ws` or `ws://localhost:3001/rpc`). Automatically resolves `ws:`/`wss:` relative to the browser origin. |
| `enabled` | `boolean` | `true` | Set to `false` to prevent opening the socket connection automatically on mount. |
| `initialData` | `TOutput[] \| (() => MaybePromise<TOutput[]>)` | — | Initial data array or async function returning a promise. |
| `typing` | `boolean \| WSTypingOptions` | `false` | Enables automatic typing indicator interception and state management. See [Typing Indicators](./typing-indicators) for full details. |
| `reconnect` | `{ maxAttempts?: number, delay?: WindowTime \| ((attempt: number) => WindowTime) }` | `{ maxAttempts: 5 }` | Reconnection strategy on unexpected closure. `delay` supports numbers in ms, window strings (`"2s"`, `"500ms"`), or backoff functions. |
| `schema` | `TData` | — | Type witness or schema object used to infer the message shape `TOutput` without verbose generic parameters. |
| `events` | `TEvent` | — | Type marker representing a discriminated union of incoming events (e.g. `{ type: "message" \| "typing" }`). |
| `onConnected` | `() => void` | — | Fired when the WebSocket connection is successfully established. *(Also supports `onSubscribed` for backwards compatibility).* |
| `onDisconnected` | `(evt: CloseEvent) => void` | — | Fired when the WebSocket connection closes. Receives the native `CloseEvent`. *(Also supports `onUnsubscribed` for backwards compatibility).* |
| `onData` | `(data: TEvent, action: "added" \| "updated") => void` | — | Callback run when an incoming message is received. `action` indicates if the item was newly appended or replaced an existing deduped item. |
| `onError` | `(err: ErrorResponse) => void` | — | Fired when a socket or protocol error occurs. |
| `onReconnectAttempt` | `(attempt: number) => void` | — | Fired before each reconnection attempt (1-indexed). |
| `onReconnectFailed` | `() => void` | — | Fired when all reconnection attempts have been exhausted. |
| `onReconnect` | `(data: TOutput[]) => void` | — | Fired when the browser restores online network connectivity. |
| `onWindowFocus` | `(data: TOutput[]) => void` | — | Fired when the browser tab regains focus. |
| `dedupKey` | `(item: TOutput) => string \| number` | — | Deduplication key extractor. Incoming items matching an existing key update in-place instead of creating a duplicate row. |
| `arrange` | `(data: TOutput[]) => TOutput[]` | — | Optional function to sort, filter, or reorder the accumulated data array before rendering. |
| `filter` | `(data: TOutput) => boolean` | — | Optional predicate to decide whether an item should be merged into state. `onData` still fires regardless. |

---

## Returned Properties

| Property | Type | Description |
| :--- | :--- | :--- |
| `data` | `TOutput[]` | All received messages accumulated in order of arrival (minus filtered typing events). |
| `status` | `WsStatus` | `"idle" \| "connecting" \| "reconnecting" \| "connected" \| "error"`. |
| `error` | `ErrorResponse \| undefined` | The active error if `status === "error"`. |
| `connect` | `() => void` | Initiates or re-establishes the WebSocket connection. |
| `disconnect` | `() => void` | Cleanly closes the socket and halts reconnection timers. |
| `send` | `<TData>(data: TData) => void` | Safely sends a JSON-stringified message. Queues the message if called while connecting. |
| `isTyping` | `boolean` | `true` if any other client is currently typing. |
| `typingUsers` | `TTypingUser[]` | List of other users currently typing (automatically excluding the current user). |
| `sendTyping` | `(payload?) => void` | Sends a throttled typing indicator event over the WebSocket. |
| `isFetchingInitialData` | `boolean` | `true` while the `initialData` promise is executing. |

---

## React StrictMode & Double-Mount Resilience

In modern React development (React 18 & 19), components mount, unmount, and remount synchronously to verify cleanup logic.

Standard WebSocket hooks naively tear down the connection on unmount and create a second connection immediately, causing duplicate connection logs, missed frames, or server connection churn.

`useWS` implements **deferred StrictMode unmount cleanup**: if the component is remounted within the same JavaScript execution frame, the existing WebSocket connection is reused transparently without disconnecting, reconnecting, or flickering connection state.
