---
sidebar_position: 9
title: Real-Time Typing Indicators
---

# Real-Time Typing Indicators

Real-time chat and collaborative tools often require showing when other users are actively typing.

Traditionally, implementing typing indicators requires significant boilerplate:
- Setting and clearing timers for each typing user.
- Throttling outgoing keystrokes to prevent flooding the WebSocket connection.
- Filtering out the local user so they don't see themselves typing.
- Preventing ephemeral typing events from polluting the permanent message history.

Actyx RPC provides an **automated, zero-boilerplate typing indicator engine** built directly into `useWS` and `useWSInfiniteQuery`.

---

## Quick Start

Enable typing indicators by passing `typing: { currentUserId }` (or a full `WSTypingOptions` object) to `useWS`:

```tsx
import { useWS } from "@explita/actyx-rpc-react";
import { useState, useCallback } from "react";

function Chat({ currentUserId }: { currentUserId: string }) {
  const [input, setInput] = useState("");

  const {
    data: messages,
    send,
    isTyping,
    typingUsers,
    sendTyping,
  } = useWS({
    url: "/api/ws",
    typing: {
      currentUserId, // Automatically stamps outgoing packets and excludes self
    },
  });

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInput(e.target.value);
      if (e.target.value.trim()) {
        sendTyping(); // Automatically throttled to once every 1.5s
      }
    },
    [sendTyping],
  );

  return (
    <div>
      <div className="messages">
        {messages.map((m, i) => (
          <p key={i}>{m.text}</p>
        ))}
      </div>

      {/* Typing indicator notice */}
      {isTyping && (
        <p className="typing-notice">
          {typingUsers.length > 0
            ? `${typingUsers.map((u) => u.name ?? u.id).join(", ")} ${
                typingUsers.length === 1 ? "is" : "are"
              } typing...`
            : "Typing..."}
        </p>
      )}

      <input
        value={input}
        onChange={handleInputChange}
        placeholder="Type a message..."
      />
    </div>
  );
}
```

---

## 1-on-1 Chats vs. Group Chats: How Typing Indicators Work

The typing engine is designed to accommodate both simple direct messages and complex multi-user chat rooms with zero unnecessary boilerplate:

### 1. 1-on-1 Chat (Two Users Only) — `currentUserId` is All You Need!

When a conversation takes place strictly between two users (such as a direct message or a 1-on-1 customer support session):

- You only need to know whether the other person is typing (`isTyping: boolean`).
- Providing **`currentUserId`** is 100% sufficient:

```tsx
const { isTyping, sendTyping } = useWS({
  url: "/api/ws",
  typing: {
    currentUserId: session.userId, // 👈 That's all you need!
  },
});
```

**Why this is enough**:
1. **Automatic Self-Exclusion**: Any incoming typing events carrying your own `currentUserId` are automatically filtered out. Your own keystrokes will never trigger `isTyping` on your own screen.
2. **Automatic Outgoing Stamping**: Calling `sendTyping()` automatically stamps `{ user: { id: currentUserId } }` onto outgoing WebSocket frames. The peer receives your ID without you having to construct a payload.
3. **Zero Configuration**: You don't need `getUser`, and you don't even need to inspect `typingUsers`. You can directly render a clean indicator:
   ```tsx
   {isTyping && <span className="typing-indicator">Typing...</span>}
   ```

---

### 2. Group Chats & Channels — Showing *Who* is Typing

When three or more people participate in a channel, you usually want to display *who* is typing (e.g., *"Sarah is typing..."*, *"Alex and 2 others are typing..."*).

To show names and avatars, `typingUsers` needs user metadata. You can supply this in two ways:

#### Option A: Standard Payload Convention (`user`, `author`, `sender`)
Have your server (or client) include standard user metadata on the typing event payload:
```ts
// Outgoing frame or server broadcast
{
  type: "typing",
  data: {
    user: { id: "u2", name: "Sarah", avatar: "/avatars/sarah.png" }
  }
}
```

Actyx RPC includes built-in normalization for standard user fields:
- `data.user` (`{ id, name, avatar }` or primitive ID)
- `data.author` (`{ id, name, avatar }` or primitive ID)
- `data.sender` (`{ id, name, avatar }` or primitive ID)
- Flat conventions: `data.userId`, `data.userName`, `data.senderId`, `data.authorId`

**No `getUser` callback is needed!** Actyx RPC automatically extracts and populates `typingUsers` with the normalized metadata.

#### Option B: Custom Payload Shapes with `getUser`
If your application uses a non-standard or deeply nested payload shape (e.g. `data.creator.profile`), provide `getUser` to extract the user object:

```tsx
const { isTyping, typingUsers } = useWS({
  url: "/api/ws",
  typing: {
    currentUserId: session.userId, // Always pass currentUserId to filter yourself out!
    getUser: (payload) => ({
      id: payload.creator.profile.id,
      name: payload.creator.profile.displayName,
      avatar: payload.creator.profile.avatarUrl,
    }),
  },
});
```

`typingUsers` is fully type-inferred from the return shape of `getUser`.

> [!IMPORTANT]
> **Always configure `currentUserId`**:
> Without `currentUserId`, the hook cannot differentiate between typing events arriving from remote peers and keystrokes triggered locally. In a two-user chat, `currentUserId` alone is enough to power the entire typing experience without writing any user objects or `getUser` callbacks.

---

## How It Works

1. **Automatic Interception**: When incoming messages have `type: "typing"`, Actyx RPC intercepts them before they reach your `data` array. Your message list remains clean of transient typing signals.
2. **Built-in Throttling**: Calling `sendTyping()` triggers at most one WebSocket message every `1.5s` (configurable via `throttle`), preventing network saturation during rapid typing.
3. **Auto-Expiry Timers**: Each typing user automatically disappears from `typingUsers` when their `timeout` (default `2s`) expires without a new typing event.
4. **Current User Exclusion**: Matches against `currentUserId` so local keystrokes are never shown in your own `typingUsers` list or trigger `isTyping`.

---

## Configuration Options (`WSTypingOptions`)

Pass a configuration object to customize behavior:

```tsx
const ws = useWS({
  url: "/api/ws",
  typing: {
    timeout: "2.5s", // Expiration window for inactive typing users
    throttle: "1s",  // Throttle limit on calling sendTyping()
    currentUserId: currentUser.id, // Exclude local user from typingUsers
    getUser: (payload) => ({
      id: payload.user.id,
      name: payload.user.name,
      avatar: payload.user.avatar,
    }),
  },
});
```

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `currentUserId` | `string \| number` | — | **Crucial for typing indicators.** Active user's ID. In 1-on-1 chats, this is all you need—it stamps outgoing `sendTyping()` and excludes local keystrokes. In group chats, it filters out the current user from `typingUsers`. |
| `event` | `string` | `"typing"` | Event type string representing typing indicators. |
| `timeout` | `WindowTime` | `"2s"` | Duration before an inactive typing indicator automatically expires. Accepts numbers in ms (e.g. `2000`) or duration strings (`"2s"`, `"500ms"`). |
| `throttle` | `WindowTime` | `"1.5s"` | Minimum delay between outgoing typing events sent by `sendTyping()`. |
| `getUser` | `(data: TPayload) => TTypingUser` | — | Transform function to extract or normalize custom user metadata (id, name, avatar) from the incoming typing event payload when not using standard (`user`, `author`, `sender`) fields. |
| `clearOnMessage` | `boolean` | `true` | Automatically remove a user from `typingUsers` when an actual message/data event arrives from them. |

---

## Extracting Custom User Shapes (`getUser`)

By default, Actyx RPC looks for standard user fields (`payload.user`, `payload.sender`, or `payload.author`).

If your application has a custom schema, use `getUser` to extract whatever user properties you need:

```tsx
type ChatEvent = {
  type: "message" | "typing";
  data: {
    text?: string;
    sender: {
      userId: string;
      displayName: string;
      avatarUrl: string;
    };
  };
};

const { typingUsers } = useWS({
  url: "/api/ws",
  typing: {
    currentUserId: "my-user-id",
    getUser: (data) => ({
      id: data.sender.userId,
      name: data.sender.displayName,
      avatar: data.sender.avatarUrl,
    }),
  },
  schema: {} as ChatEvent["data"],
});

// TypeScript infers typingUsers as:
// Array<{ id: string; name: string; avatar: string }>
```

---

## Sending Typing Payloads vs Session Resolution

`sendTyping` can be invoked in two ways depending on your server architecture:

### 1. Payload-Based (Client Sends User Metadata)
You can pass custom payload data directly to `sendTyping(payload)`:

```tsx
sendTyping({
  user: { id: currentUser.id, name: currentUser.name },
});
```

### 2. Session-Based (Server Resolves User Identity)
In authenticated applications, the client should not dictate identity. Call `sendTyping()` without arguments:

```tsx
sendTyping(); // Sends: { type: "typing" }
```

The server then injects the authenticated user from the session and broadcasts it to peers:

```ts
// server/procedures.ts
export const chatRoom = procedure.ws(({ ctx, broadcast, onMessage }) => {
  onMessage((data: any) => {
    if (data?.type === "typing") {
      // Inject authenticated user from session
      broadcast({
        type: "typing",
        data: {
          user: {
            id: ctx.user.id,
            name: ctx.user.name,
          },
        },
      });
      return;
    }

    // Regular chat messages...
  });
});
```

---

## Using with `useWSInfiniteQuery`

Typing indicators work identically inside `useWSInfiniteQuery`, letting you combine historical cursor-paginated chat logs with live typing notifications:

```tsx
import { useWSInfiniteQuery } from "@explita/actyx-rpc-react";
import { getChatHistory } from "@/backend/procedures";

function PaginatedChatRoom() {
  const {
    data: messages,
    fetchNext,
    hasNext,
    isTyping,
    typingUsers,
    sendTyping,
  } = useWSInfiniteQuery(getChatHistory, {
    queryOpts: {
      input: { roomId: "lobby", limit: 20 },
      getNextPageParam: (page) => page.nextCursor,
    },
    url: "/api/ws/chat",
    typing: {
      timeout: "2s",
      currentUserId: "user-123",
      getUser: (data) => data.user,
    },
  });

  return (
    <div>
      {hasNext && <button onClick={() => fetchNext()}>Load older messages</button>}

      <div className="messages">
        {messages.map((m) => (
          <p key={m.id}>{m.text}</p>
        ))}
      </div>

      {isTyping && (
        <div className="typing-indicator">
          {typingUsers.map((u) => u.name).join(", ")} is typing...
        </div>
      )}
    </div>
  );
}
```

---

## Server Implementation Guide

To support typing indicators on the server using `procedure.ws`:

```ts
import { procedure } from "./rpc";

export const chatProc = procedure.ws(
  ({ ctx, send, broadcast, onMessage, onClose }) => {
    onMessage((data: any) => {
      // 1. Check for typing event
      if (data?.type === "typing") {
        // Broadcast typing signal with user identity to other connected clients
        broadcast({
          type: "typing",
          data: {
            user: {
              id: ctx.user.id,
              name: ctx.user.name,
            },
            ...data.data,
          },
        });
        return;
      }

      // 2. Handle normal chat messages
      broadcast({
        type: "event",
        data: { ...data, user: ctx.user },
      });
    });
  }
);
```
