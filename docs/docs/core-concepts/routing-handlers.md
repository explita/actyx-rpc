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
import { createSSEResponse } from "@explita/actyx-rpc/adapters/next";

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
import { SSEClient } from "@explita/actyx-rpc";

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

## WebSocket Subscriptions (`.subscription()`)

For topic-based, real-time subscription feeds, use `.subscription()`. 

The handler receives `{ ctx, input, emit }` and should return a cleanup function (e.g. to unsubscribe from database or message broker updates).

```ts
export const onRoomEvent = procedure
  .input(z.object({ roomId: z.string() }))
  .subscription(async ({ ctx, input, emit }) => {
    // Subscribe to a topic using the built-in pubsub context
    const unsubscribe = await ctx.pubsub.subscribe(
      `room:${input.roomId}`,
      (data) => {
        emit(data); // Push event data payload to the client
      }
    );

    return unsubscribe; // Return the cleanup function
  });
```

For client integration, see [React Subscriptions](../react/subscriptions.md). For server setups, see [WebSocket Adapters](../adapters/websockets.md).

---

## Bi-Directional WebSockets (`.ws()`)

For complex, raw, bi-directional socket communications (like multi-user collaboration layers or real-time drawing maps), use `.ws()`.

The handler receives raw socket callbacks to control communications:

```ts
export const handleCanvasSync = procedure
  .input(z.object({ sessionId: z.string() }))
  .ws(async ({ ctx, input, send, onMessage, onClose, onError }) => {
    // Access parameters and context
    console.log(`User ${ctx.userId} connected to session ${input.sessionId}`);

    // Register listeners
    onMessage((data) => {
      // Broadcast or process incoming payload
      broadcastToSession(input.sessionId, data);
    });

    onClose(() => {
      cleanupUserSession(ctx.userId);
    });
  });
```

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
