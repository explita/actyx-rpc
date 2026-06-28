---
sidebar_position: 2
title: WebSocket Server Integration
---

# WebSocket Server Integration

To handle topic-based subscriptions and bi-directional communication protocols, Actyx RPC exposes socket handler boundaries for Node.js-based WebSocket servers.

---

## Setting Up `applyWSHandler`

Use the `applyWSHandler` adapter (from `@explita/actyx-rpc/adapters/ws`) to attach procedures to a standard WebSocket instance (such as the `ws` library):

```ts
import { WebSocketServer } from "ws";
import { applyWSHandler } from "@explita/actyx-rpc/adapters/ws";
import { onRoomEvent } from "./procedures";

const wss = new WebSocketServer({ port: 3001 });

wss.on("connection", (ws, req) => {
  (ws as any).req = req; // Store upgrade request URL to identify channel

  // Bind the websocket client connection to the subscription handler
  applyWSHandler(onRoomEvent({ roomId: "main-lobby" }), {
    ws: ws,
    broadcast: (data) => {
      wss.clients.forEach((client) => {
        const clientReq = (client as any).req;
        // Broadcast only to clients in the exact same channel/room (matching req.url)
        if (
          client !== ws &&
          client.readyState === 1 && // 1 = OPEN
          clientReq &&
          clientReq.url === req.url
        ) {
          client.send(JSON.stringify(data));
        }
      });
    },
  });
});

console.log("WebSocket RPC server running on ws://localhost:3001");
```

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

## Next.js Compatibility Limitations

> [!WARNING]
> Standard Next.js serverless route handlers **do not support persistent connections** (like WebSockets). If you are deploying your Next.js application to Vercel or similar serverless environments, WebSocket endpoints cannot be hosted within Next.js API routes.

### Recommended Workarounds:

1. **Separate Standalone Server**: Host your WebSocket handlers on a separate Node.js / Express service (as shown in the `applyWSHandler` example) running on a distinct port (e.g. `3001`).
2. **Custom Next.js Server**: Use a custom `server.js` integration to host both your Next.js application and your WebSocket server on the same HTTP port.
