---
sidebar_position: 5
title: Actyx DevTools
---

# Actyx DevTools

`@explita/actyx-rpc-react` includes a built-in, zero-dependency floating DevTools panel designed to give developers total visibility into queries, mutations, cache lifecycles, and real-time streams.

---

## Installation & Setup

Import and render `<ActyxDevtools />` inside your root layout or application provider:

```tsx
// app/providers.tsx
"use client";

import { QueryClient, ActyxProvider, ActyxDevtools } from "@explita/actyx-rpc-react";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ActyxProvider client={queryClient}>
      {children}
      {/* DevTools floating toggle badge in bottom-right corner */}
      <ActyxDevtools position="bottom-right" />
    </ActyxProvider>
  );
}
```

> [!TIP]
> In production environments, you can conditionally render `<ActyxDevtools />` only when `process.env.NODE_ENV === "development"` to ensure it is completely tree-shaken from production bundles.

---

## Features

### 1. Keyboard Shortcuts
Press any of the following shortcuts anywhere on the page to toggle the DevTools panel:
- `Alt + A` (Windows/Linux) or `⌥ + A` (macOS)
- `Ctrl + Shift + A` (Windows/Linux) or `⌘ + Shift + A` (macOS)

### 2. Floating Toggle Badge
A sleek badge appears in your chosen corner (`bottom-right`, `bottom-left`, `top-right`, or `top-left`) displaying the active number of tracked queries with a pulse animation during in-flight fetches.

---

## The DevTools Tabs

### Queries Tab
- **Filter Bar**: Filter queries by state: **All**, **Fresh** (green), **Stale** (orange), or **Fetching** (blue).
- **Search**: Instant fuzzy search across procedure keys.
- **Path Segment Breadcrumbs**: Procedure paths like `todos|list|{"hasMore":true}` are cleanly rendered as interactive breadcrumbs (`todos / list`) with serialized argument highlights.
- **Details Panel**: Inspect query metadata, last updated timestamp, active observer count, and full JSON data trees.

### Mutations Tab
- **Execution History**: Chronological log of every mutation dispatched by `useMutation` or `rpc.<proc>.mutate()`.
- **Status & Latency**: Shows `pending`, `success`, or `error` with execution duration in milliseconds.
- **Payload Inspection**: View exact variables passed to the mutation and the server's returned response or error.

### Streams Tab (SSE & WebSocket)
- **Active Connections**: Live monitoring of real-time SSE (`useSSE`) and WebSocket (`useWS`) connections.
- **Event Log**: Chronological stream of incoming server events with timestamps and payload trees.

---

## Cache Management Actions

The DevTools header provides three distinct cache management controls:

| Action | What it does | Real-World Scenario |
| :--- | :--- | :--- |
| **Invalidate All** | Marks all queries as stale and triggers a background refetch. Current data stays visible on screen without loading flicker. | Testing UI updates after background mutations or server changes. |
| **Reset All** | Reverts queries to their empty/initial state and refetches active queries, displaying the loading skeleton briefly. | Testing skeleton screens, initial load states, or form cancellation. |
| **Clear Cache** | Completely purges cached data from memory without destroying active React component observers. | Simulating **user logout**, workspace switching, or memory cleanup. Clicking *Invalidate All* afterwards cleanly revives active queries. |

### Per-Query Actions
Within the query details panel, you can also:
- **Invalidate**: Refetch and mark an individual query stale.
- **Reset**: Reset that specific query back to initial state.
- **Copy Key**: Copy the exact normalized query key string to your clipboard.
- **Copy Data**: Copy the formatted JSON data payload to your clipboard.
