---
sidebar_position: 2
title: WebSocket Server Integration
---

# WebSocket Server Integration

To handle topic-based subscriptions and bi-directional communication protocols, Actyx RPC exposes socket handler boundaries for Node.js-based WebSocket servers.

---

## Setting Up `applyWSHandler`

Use the `applyWSHandler` adapter (from `@explita/actyx-rpc/adapters/ws`) to attach procedures to a standard WebSocket instance (such as the `ws` library, Node.js built-in WebSocket, or browser WebSocket):

```ts
import { WebSocketServer } from "ws";
import { applyWSHandler } from "@explita/actyx-rpc/adapters/ws";
import { onChatEvent } from "./procedures";

const wss = new WebSocketServer({ port: 3001 });

wss.on("connection", (ws, req) => {
  (ws as any).userId = req.url?.split("?userId=")[1];

  applyWSHandler(onChatEvent({ roomId: "main-lobby" }), {
    ws,
    // Optional — if omitted, procedure.broadcast() is a no-op
    broadcast: (data) => {
      const payload = JSON.stringify(data);

      wss.clients.forEach((client) => {
        if (
          client !== ws &&
          client.readyState === WebSocket.OPEN &&
          (client as any).userId === (ws as any).userId
        ) {
          client.send(payload);
        }
      });
    },
  });
});

console.log("WebSocket RPC server running on ws://localhost:3001");
```

### How It Works

`applyWSHandler` creates a context object with five methods and passes it to your WebSocket procedure:

| Method            | Source                       | Description                                                                                                                                                     |
| :---------------- | :--------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `send(data)`      | Generated per-connection     | Sends a JSON-stringified message back to **this specific client**.                                                                                              |
| `broadcast(data)` | From your `broadcast` option | Sends a message to **other connected clients** (e.g., everyone except the sender). If you don't provide it, calling `broadcast()` does nothing — it's optional. |
| `onMessage(cb)`   | Generated per-connection     | Registers a callback for incoming messages from this client.                                                                                                    |
| `onClose(cb)`     | Generated per-connection     | Registers a callback for when this client disconnects.                                                                                                          |
| `onError(cb)`     | Generated per-connection     | Registers a callback for when this client encounters an error.                                                                                                  |

The procedure uses these methods to interact with the socket:

```ts
// Example procedure
export const onChatEvent = procedure
  .input(zodResolver(z.object({ userId: z.string() })))
  .ws(({ ctx, input, send, broadcast, onMessage, onClose }) => {
    // Welcome just this client
    send({ type: "subscribed", data: { userId: input.userId } });

    // Notify others that someone joined
    broadcast({ type: "event", data: { message: "A user joined!" } });

    onMessage((data) => {
      // 1. Transient events (like typing indicators) — broadcast only to others
      if (data && data.type === "typing") {
        broadcast({
          type: "typing",
          data: {
            // Securely resolve user identity from authenticated connection context
            user: {
              id: ctx.user?.id ?? "anonymous",
              name: ctx.user?.name ?? "Anonymous",
            },
            ...data.data,
          },
        });
        return;
      }

      // 2. Regular chat messages — echo back to sender + broadcast to others
      send({ type: "event", data });
      broadcast({ type: "event", data });
    });

    onClose(() => {
      broadcast({
        type: "event",
        data: { message: "A user left!" },
      });
    });
  });
```

The adapter supports both the `ws` library (EventEmitter `.on()` style) and DOM/WHATWG WebSocket (browser, Node.js 21+) by detecting the socket API at runtime.

> [!TIP]
> **Client Normalization**: On the client (`useWS` / `useWSInfiniteQuery`), Actyx RPC automatically recognizes standard user payload fields (`user`, `author`, `sender`, or `userId`) and extracts `{ id, name }` without requiring any manual `getUser` transform. In 1-on-1 chats, the client only needs `typing: { currentUserId }` to power typing indicators.

---

## Distributed PubSub (Redis)

By default, Actyx RPC uses a memory-based PubSub channel. However, when your application scales across multiple server instances or containers, events published on one server won't reach users subscribed on another.

To synchronize event streams across multiple servers, pass a `RedisCache` instance to `createProcedure`. The PubSub layer will automatically use Redis channels to coordinate events:

```ts
import { createProcedure, RedisCache } from "@explita/actyx-rpc";
import Redis from "ioredis";

const redis = new Redis({ host: "redis-server" });

const procedure = createProcedure({
  // Subscriptions & PubSub will automatically coordinate using this Redis cache adapter
  cache: new RedisCache(redis),
});
```

Now, any call to `ctx.pubsub.publish()` automatically broadcasts the event globally across all server instances via Redis.

---

## Minimal PubSub Example (No `broadcast` Option)

For many use cases, you don't need the `broadcast` option at all — the procedure can handle multi-client coordination through `ctx.pubsub` directly. This keeps the server setup minimal:

```ts
// server.ts — minimal, no broadcast needed
import { WebSocketServer } from "ws";
import { applyWSHandler } from "@explita/actyx-rpc/adapters/ws";
import { onChatRoom } from "./procedures";

const wss = new WebSocketServer({ port: 3001 });

wss.on("connection", (ws) => {
  applyWSHandler(onChatRoom(), { ws });
});
```

```ts
// procedures.ts — uses pubsub for cross-client communication
export const onChatRoom = procedure.ws(({ ctx, send, onMessage }) => {
  const room = "chat:lobby";

  const unsubscribe = ctx.pubsub.subscribe(room, (data: any) => {
    send({ type: "event", data });
  });

  send({ type: "subscribed" });

  onMessage((data) => {
    ctx.pubsub.publish(room, data);
  });

  onClose(unsubscribe);
});
```

The procedure subscribes to a pubsub channel on connect, publishes incoming messages to it, and cleans up on disconnect — all without needing the `broadcast` option. This works across multiple server instances when backed by Redis.

### Publishing from a Mutation

Real applications typically save messages to a database first, then notify connected clients via pubsub. The mutation and the WebSocket handler share the same pubsub channel:

```ts
// mutations.ts — save to DB and publish
export const sendMessage = procedure
  .input(z.object({ roomId: z.string(), text: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // 1. Save to database
    const message = await db.messages.create({
      data: { roomId: input.roomId, text: input.text, userId: ctx.user.id },
    });

    // 2. Publish to the pubsub channel — all WebSocket subscribers receive it
    ctx.pubsub.publish(`chat:${input.roomId}`, message);

    return message;
  });
```

The WebSocket handler subscribes to the same channel:

```ts
// procedures.ts
export const onChatRoom = procedure
  .input(z.object({ roomId: z.string() }))
  .ws(({ ctx, input, send, onMessage }) => {
    const channel = `chat:${input.roomId}`;

    const unsubscribe = ctx.pubsub.subscribe(channel, (data: any) => {
      send({ type: "event", data });
    });

    send({ type: "subscribed" });

    onMessage((data) => {
      // Messages come from the mutation, but clients can also send
      // typing indicators or other transient events directly
      ctx.pubsub.publish(channel, data);
    });

    onClose(unsubscribe);
  });
```

Now when any client calls `sendMessage`, the message is saved to the database and broadcast to all connected clients across all server instances — without the WebSocket handler needing to know about the database at all.

---

## Ephemeral Signals & Typing Indicators

Ephemeral events (such as typing indicators, mouse presence, or cursor positions) are transient: they should not be written to permanent storage like databases.

When handling ephemeral signals in `.ws()`:
1. **Never persist ephemeral events**: Broadcast them immediately using `broadcast()` (single instance) or `ctx.pubsub.publish()` (multi-instance).
2. **Inject session identity on the server**: If the client calls `sendTyping()` without payload, use authenticated connection context (`ctx.user` or session) to populate the author information so peers receive verified identity metadata.
3. **Use the `"typing"` event type convention**: Actyx RPC React clients (`useWS` and `useWSInfiniteQuery`) automatically detect `{ type: "typing" }` events, route them to their internal typing indicator timers, and filter them out of message history arrays automatically.

```ts
onMessage((data: any) => {
  if (data?.type === "typing") {
    // Forward typing event with authenticated user identity
    broadcast({
      type: "typing",
      data: {
        user: { id: ctx.user.id, name: ctx.user.name },
        ...data.data,
      },
    });
    return;
  }

  // Handle other messages...
});
```

---

## Next.js Compatibility Limitations

> [!WARNING]
> Standard Next.js serverless route handlers **do not support persistent connections** (like WebSockets). If you are deploying your Next.js application to Vercel or similar serverless environments, WebSocket endpoints cannot be hosted within Next.js API routes.

### Recommended Workarounds:

1. **Separate Standalone Server**: Host your WebSocket handlers on a separate Node.js / Express service (as shown in the `applyWSHandler` example) running on a distinct port (e.g. `3001`).
2. **Custom Next.js Server**: Use a custom `server.js` integration to host both your Next.js application and your WebSocket server on the same HTTP port.
