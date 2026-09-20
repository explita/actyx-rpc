---
sidebar_position: 1
title: Setup & Provider
---

# Setup & Provider

The `@explita/actyx-rpc-react` package includes a lightweight, zero-dependency caching, query, and state management system purpose-built for Actyx RPC procedures.

---

## Installation

Install the React package alongside `@explita/actyx-rpc`:

```bash
npm install @explita/actyx-rpc-react @explita/actyx-rpc
```

---

## Why a Built-in Query Client? (vs. TanStack Query)

While TanStack Query is excellent, `@explita/actyx-rpc-react` includes a built-in state client for two main reasons:

1. **Standardized Tuple Integration**: Actyx RPC procedures return a `[data, error]` tuple for error safety. TanStack Query relies on rejected promises and thrown exceptions. Actyx RPC's `QueryClient` natively understands the tuple format, letting you use procedures directly (e.g. `useQuery(getUserProfile)`) without manual try/catch mapping wrapper functions.
2. **Zero-Dependency Essentials**: Provides request deduplication, cache invalidation, optimistic updates, prefetching, and network focus refetching without importing a large external bundle.

---

## Wrapping Your App

Wrap your component tree in the `ActyxProvider` and supply it with a `QueryClient` instance:

```tsx
import { QueryClient, ActyxProvider } from "@explita/actyx-rpc-react";

// Configure client-wide defaults for queries and mutations
const queryClient = new QueryClient({
  queries: {
    staleTime: "5m",             // Keep cached data fresh for 5 minutes
    refetchOnWindowFocus: true,  // Auto-refetch when user focuses browser window
  },
  mutations: {
    throwOnError: false,         // Return errors in tuples rather than throwing
  },
});

export default function App() {
  return (
    <ActyxProvider client={queryClient}>
      <MainApp />
    </ActyxProvider>
  );
}
```

---

## The `QueryClient` API

Access the client instance using the `useQueryClient` hook inside components:

```tsx
import { useQueryClient } from "@explita/actyx-rpc-react";

function InvalidateButton() {
  const queryClient = useQueryClient();

  return (
    <button onClick={() => queryClient.invalidate(["userProfile"])}>
      Force Refresh Profile
    </button>
  );
}
```

### Core Client Methods

* **`invalidate(queryKey)`**: Marks matching cache keys as stale, triggering an immediate refetch for any mounted hooks monitoring those keys.
* **`setQueryData(queryKey, data | updater)`**: Manually updates cached query values (handy for optimistic updates). Returns a `[oldData, newData]` tuple.
* **`prefetchQuery(queryKey, proc)`**: Fetches a query and populates the cache in the background (e.g. prefetching on link hover).
* **`prepend(queryKey, item)`** / **`append(queryKey, item)`**: Directly mutates cached array lists without re-fetching.
* **`clear()`**: Resets and empties all query cache entries and active timers.
