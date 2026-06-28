---
sidebar_position: 3
title: Routing & Terminal Handlers
---

# Routing & Terminal Handlers

Terminal handlers define the end-point of a procedure chain. Actyx RPC supports queries, mutations, streaming responses, and Server-Sent Events (SSE).

All handlers receive `{ ctx, input }` as the first argument, and can also accept additional custom arguments.

---

## Queries and Mutations

* Use `.query()` for read-only actions.
* Use `.mutation()` for state-changing write actions.

```ts
// Mutation with additional inline arguments
export const publishPost = procedure
  .input(zodResolver(z.object({ id: z.string() })))
  .mutation(async ({ ctx, input }, notifyFollowers: boolean) => {
    return {
      id: input.id,
      publishedBy: ctx.userId,
      notifyFollowers,
    };
  });

// Call time
await publishPost({ id: "post_1" }, true);
```

---

## Web Routes (`.webRoute()`)

For procedures that need to act directly as HTTP route endpoints (receiving standard Web `Request` objects and returning standard Web `Response` objects), use `.webRoute()`.

This is ideal for exposing raw HTTP endpoints (like webhooks, direct file downloads, or binary stream ingestion) and keeps your procedures framework-agnostic.

```ts
import { procedure } from "@/lib/rpc/init";
import { z } from "zod";

export const handleWebhook = procedure
  .input(zodResolver(z.object({ event: z.string() })))
  .webRoute(async ({ ctx, input }, req, context) => {
    // req is the standard Web Request instance
    // context contains adapter-provided metadata (like params, cookies, headers)
    console.log(`Processing event ${input.event} on path ${context.pathname}`);

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
```

---

## Streaming Responses (`.stream()`)

For procedures returning an `AsyncIterable`, use `.stream()`. This is ideal for consuming generative AI streams or real-time progress updates.

```ts
const generateContent = procedure
  .input(z.object({ prompt: z.string() }))
  .stream(async function* ({ input }) {
    yield "Thinking...";
    const stream = await ai.stream(input.prompt);
    for await (const chunk of stream) {
      yield chunk;
    }
  });

// Consume on the client
for await (const chunk of generateContent({ prompt: "Write a story" })) {
  console.log(chunk);
}
```

---

## Server-Sent Events (`.sse()`)

For real-time, one-way data push streams (e.g., dashboard tickers, progress bars, notifications) over HTTP, use `.sse()`. 

Yield events from a generator, and use the `createSSEResponse` adapter to turn that stream into a standard HTTP `Response`.

### Server Setup
```ts
import { createSSEResponse } from "@explita/actyx-rpc";

const watchStock = procedure
  .input(z.object({ symbol: z.string() }))
  .sse(async function* ({ input }) {
    while (true) {
      const price = await getLatestPrice(input.symbol);
      yield {
        event: "price-update",
        data: { price, at: new Date() },
      };
      await new Promise((r) => setTimeout(r, 5000));
    }
  });

// Next.js Route Handler
export async function GET(req: Request) {
  const stream = watchStock({ symbol: "AAPL" });
  return createSSEResponse(stream);
}
```

### Raw JS/TS Client Consumption
Use the built-in `SSEClient` to consume the events on the client:

```ts
import { SSEClient } from "@explita/actyx-rpc/client/sse";

const stock = await SSEClient({
  url: "/api/sse",
  params: { symbol: "AAPL" },
});

for await (const { event, data } of stock) {
  if (event === "price-update") {
    console.log("New price:", data.price);
  }
}

// To stop the stream manually:
stock.close();
```

---

## WebSockets (`.ws()`)

For topic-based subscription feeds (like chat rooms) or complex, raw, bi-directional socket communications (like collaborative drawing boards), use `.ws()`.

The handler receives raw socket controls to handle communications:

* **`send(data)`**: Sends a message to the connected client.
* **`broadcast(data)`**: Sends a message to all other connected clients.
* **`onMessage(cb)`**: Registers a callback for incoming client messages.
* **`onClose(cb)`**: Registers a callback for socket disconnection.
* **`onError(cb)`**: Registers a callback for errors.

### Subscription & Publishing Example

To stream real-time events, use `.ws()` to subscribe, and a standard `.mutation()` or `.query()` to publish.

#### 1. Subscribe via WebSockets
```ts
export const onRoomEvent = procedure
  .input(zodResolver(z.object({ roomId: z.string() })))
  .ws(async ({ ctx, input, send, onClose }) => {
    // Subscribe to a topic using the built-in pubsub context
    const unsubscribe = ctx.pubsub.subscribe<string>(
      `room:${input.roomId}`,
      (message) => {
        send({ message }); // Push event data payload to the client
      }
    );

    // Clean up on close (handles both sync and async unsubscribe)
    onClose(async () => {
      const unsub = await unsubscribe;
      unsub();
    });
  });
```

#### 2. Publish via Mutation
```ts
export const sendRoomMessage = procedure
  .input(
    zodResolver(
      z.object({
        roomId: z.string(),
        message: z.string().min(1),
      })
    )
  )
  .mutation(async ({ ctx, input }) => {
    // Publish message to the topic
    await ctx.pubsub.publish(`room:${input.roomId}`, input.message);
    return { success: true };
  });
```

### Chat & Broadcast Example
```ts
export const chatProc = procedure.ws(
  ({ send, broadcast, onMessage, onClose }) => {
    // Welcome just this client
    send({ type: "subscribed", data: { message: "🟢 You joined the chat!" } });

    // Notify others that someone joined
    broadcast({ type: "event", data: { message: "👋 A new user joined!" } });

    onMessage((data: any) => {
      if (data && data.type === "typing") {
        // Typing indicator — broadcast to other clients only
        broadcast({ type: "typing" });
      } else {
        // Regular message — broadcast to others + send back to sender
        broadcast({ type: "event", data });
        send({ type: "event", data });
      }
    });

    onClose(() => {
      broadcast({
        type: "event",
        data: { message: "🚪 A user left the chat." },
      });
    });
  },
);
```

For client integration, see [React WebSockets](../react/subscriptions.md). For server setups, see [WebSocket Adapters](../adapters/websockets.md).

---

## RPC Handler Pattern & Result Shape

Procedures in Actyx RPC return a standardized **`[data, error]` tuple**.

### Success Shape
```ts
[
  {
    success: true,
    id: "post_1",
    title: "Hello World",
  },
  null,
]
```

### Error Shape
```ts
[
  null,
  {
    success: false,
    message: "Validation Error",
    reason: "VALIDATION_ERROR",
    errors: {
      title: "Title is too short",
    },
  },
]
```

### Known Failure Reasons

| Reason | Description |
| :--- | :--- |
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Insufficient permissions |
| `MAINTENANCE_MODE` | System is in maintenance mode |
| `VALIDATION_ERROR` | Input validation failed |
| `UNEXPECTED_ERROR` | Unhandled server error |
| `INVALID_SESSION` | Session expired or invalid |
| `ABORTED` | Request was aborted |
| `INVALID_CACHE_KEY` | Cache key resolution failed |
| `TIMEOUT` | Execution exceeded time limit |
| `RETRY_EXHAUSTED` | All retry attempts exhausted |
| `CIRCUIT_OPEN` | Circuit breaker is open |
| `RATE_LIMITED` | Rate limit exceeded |

---

### Rules of Thumb for Exception Handling

1. **Let errors throw naturally**: Actyx RPC will catch thrown errors, run the global `onError` mapping, and return a clean `[null, error]` tuple.
2. **Returning `{ success: false }`**: If you return an object with `success: false` from the handler, it will be mapped into the `error` slot of the returned tuple.
3. **Implicit Success**: Everything else is returned as `[data, null]`.

```ts
// ✅ Good: Let errors throw naturally
const deletePost = procedure.mutation(async ({ input }) => {
  return await db.posts.delete(input.id); // throws if not found
});

// ⚠️ Optional: Manually return failed states
const createPost = procedure.mutation(async ({ input }) => {
  if (input.title.length < 3) {
    return { 
      success: false, 
      message: "Title too short", 
      reason: "VALIDATION_ERROR" 
    };
  }
  return await db.posts.create(input);
});
```
