---
sidebar_position: 4
title: Request Batching & Deduplication
---

# Request Batching & Link Deduplication

Actyx RPC features built-in **HTTP request batching** and **client-side link deduplication**. Concurrent queries dispatched within a configurable time window are automatically pooled into a single HTTP round-trip, dramatically reducing network latency and server overhead.

---

## Why Batching & Deduplication?

When rendering complex pages or dashboards, multiple independent components often dispatch queries simultaneously:

```
Without Batching (5 Concurrent Queries):
Component A ───> [POST /api/rpc/health] ──────> Server (RTT #1: 177ms)
Component B ───> [POST /api/rpc/health] ──────> Server (RTT #2: 177ms)
Component C ───> [POST /api/rpc/health] ──────> Server (RTT #3: 177ms)
Component D ───> [POST /api/rpc/todos.list] ──> Server (RTT #4: 177ms)
Component E ───> [POST /api/rpc/todos.list] ──> Server (RTT #5: 177ms)

With Actyx Batching + Deduplication (3.5x Faster):
Components A, B, C ──┐
Components D, E    ──┴──> [POST /api/rpc?batch=1] ──> Server (Single RTT: 51ms!)
                         (Only 2 items on wire: health + todos.list)
```

1. **Round-Trip Elimination**: Replaces multiple TCP/TLS handshakes and HTTP header parsing overhead with a single network transaction.
2. **Wire Payload Deduplication**: If multiple components request the same procedure with the same arguments during the batch window, duplicate calls are collapsed into **one wire entry**.
3. **Shared Memory Promises**: Subscribers share the exact same in-memory response tuple reference without re-allocating or re-parsing JSON.

---

## Enabling Batching on the Client

Enable request batching when creating your RPC client in `@explita/actyx-rpc-react`:

```ts
// lib/rpc/client.ts
import { createClient } from "@explita/actyx-rpc-react";
import type { AppRouter } from "./router";

export const rpc = createClient<AppRouter>({
  baseUrl: "/api/rpc",
  // Enable batching with default settings (10ms pooling window, max 50 items)
  batch: true,
});
```

### Advanced Batch Configuration

You can customize the pooling delay and batch capacity:

```ts
export const rpc = createClient<AppRouter>({
  baseUrl: "/api/rpc",
  batch: {
    delay: 15,          // Wait up to 15ms to pool concurrent calls (default: 10ms)
    maxBatchSize: 100,  // Immediately flush when queue reaches 100 items (default: 50)
  },
});
```

---

## How Deduplication Works

Every queued call generates a compound deduplication key:

```ts
const dedupeKey = `${procedure}::${JSON.stringify(input)}::${JSON.stringify(extraArgs)}`;
```

### Case 1: Identical Queries (Fully Deduplicated)

```ts
// 3 identical calls dispatched in the same tick:
const [h1, h2, h3] = await Promise.all([
  rpc.health(),
  rpc.health(),
  rpc.health(),
]);

// Verified in memory:
console.log(h1 === h2 && h2 === h3); // true (Shared exact Promise reference!)
```

Only **1 procedure call** is encoded into the wire payload array. When the server responds, all 3 callers resolve with the identical tuple reference.

### Case 2: Different Inputs (Batched Together, Not Deduplicated)

If inputs differ, calls receive separate unique payload IDs:

```ts
// 2 calls with different inputs:
await Promise.all([
  rpc.todos.get({ id: "1" }),
  rpc.todos.get({ id: "2" }),
]);
```

The client dispatches **1 single HTTP POST request** with both items:

```json
[
  { "id": 0, "procedure": "todos.get", "input": { "id": "1" } },
  { "id": 1, "procedure": "todos.get", "input": { "id": "2" } }
]
```

The server resolves both procedures concurrently, and the client matches each result back to its caller by `id`.

---

## Per-Query Batch Opt-Out

To bypass batching and send a dedicated, direct HTTP request immediately (for instance, when low latency on a critical query outweighs bundling):

```ts
// Direct unbatched GET request
const [res, err] = await rpc.health({ batch: false });
```

---

## Server Route Handler Integration

On the server, `createHandler` automatically handles incoming batched requests:

```ts
// app/api/rpc/[[...rpc]]/route.ts
import { createHandler } from "@explita/actyx-rpc/adapters/next";
import { appRouter } from "@/lib/rpc/router";

// Handles standard GET/POST calls and batched requests (?batch=1 or /api/rpc/batch)
export const { GET, POST } = createHandler(appRouter);
```

- When `POST /api/rpc?batch=1` arrives, the route handler runs `createBatchHandler(appRouter)`.
- Each procedure inside the batch executes with its own isolated asynchronous storage context, maintaining accurate request headers and cookies across all batch items.

---

## Inspecting Batch Telemetry

You can inspect real-time batch statistics directly in your application:

```ts
// Access batch metrics from the client
const metrics = rpc.$batch();

console.log({
  totalBatches: metrics.totalBatches,         // Number of HTTP batch requests sent
  totalDispatched: metrics.totalDispatched,   // Total calls initiated by components
  totalWireItems: metrics.totalWireItems,     // Total items sent across the wire
  totalDeduplicated: metrics.totalDeduplicated, // Total duplicate calls saved
  lastBatch: metrics.lastBatch,               // Wire payload breakdown of the most recent batch
});
```
