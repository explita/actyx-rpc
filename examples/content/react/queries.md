---
sidebar_position: 2
title: Queries & Parallel Fetching
---

# Queries & Parallel Fetching

Actyx RPC provides hooks for fetching, parallel loading, and caching remote server query states.

---

## `useQuery`

Fetch and monitor single procedure states:

```tsx
import { useQuery } from "@explita/actyx-rpc/react";
import { getUser } from "@/backend/procedures";

function UserProfile({ userId }) {
  const {
    data,
    isFetching,
    isRefetching,
    isFetched,
    isEmpty,
    error,
    refetch,
    reset,
  } = useQuery(() => getUser({ id: userId }), {
    enabled: !!userId,
    refetchOnWindowFocus: true,
    // Function support for lazy initialData resolution
    initialData: () => ({ id: "", name: "Loading..." }),
    // Optional queryKey allows cache deduplication across components
    queryKey: ["user", { id: userId }],
  });

  if (isFetching && !isRefetching) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;
  if (isEmpty) return <p>No user profiles found.</p>;

  return (
    <div>
      <h1>{data?.name}</h1>
      {isRefetching && <p>Updating in background...</p>}
      <button onClick={() => refetch()}>Refresh Data</button>
      <button onClick={() => reset()}>Reset State</button>
    </div>
  );
}
```

### Configuration Options

The `useQuery` hook accepts two arguments:

1. **`proc`**: An async procedure function returning a `[data, error]` tuple.
2. **`options`**: An optional configuration object (`UseQueryOpts`):

| Option                 | Type                    | Default         | Description                                                                                                |
| :--------------------- | :---------------------- | :-------------- | :--------------------------------------------------------------------------------------------------------- |
| `queryKey`             | `unknown[]`             | —               | Unique array key for cache identification and deduplication.                                               |
| `initialData`          | `data \| (() => data)`  | —               | Pre-populates cache on mount. Supports lazy evaluation functions.                                          |
| `enabled`              | `boolean`               | `true`          | Set to `false` to disable automatic fetching on mount.                                                     |
| `staleTime`            | `number \| string`      | `0`             | Time in milliseconds (or string window e.g., `"5m"`) before data is considered stale.                      |
| `gcTime`               | `number \| string`      | `5 * 60 * 1000` | Time in milliseconds (or string window) before unused cache data is garbage collected.                     |
| `refetchOnMount`       | `boolean \| "always"`   | `true`          | Refetch on mount if stale (`true`), unconditionally (`"always"`), or disable mounting refetches (`false`). |
| `refetchOnWindowFocus` | `boolean`               | `false`         | Automatically refetch when the window regains focus.                                                       |
| `refetchOnReconnect`   | `boolean \| "always"`   | `true`          | Refetch when network connection is restored.                                                               |
| `refetchInterval`      | `number`                | `0`             | Time in milliseconds for automatic background polling.                                                     |
| `unwrap`               | `boolean`               | `false`         | Set to `true` to return the nested `data` field of the RPC response directly.                              |
| `select`               | `(data) => selectData`  | —               | Transform the query response before returning it to the component.                                         |
| `keepPreviousData`     | `boolean`               | `true`          | When `false`, clears cached data during refetch so the UI shows a loading state instead of stale data.     |                                         |
| `onSuccess`            | `(data) => void`        | —               | Callback run on successful data fetch.                                                                     |
| `onError`              | `(error) => void`       | —               | Callback run when the procedure encounters an error.                                                       |
| `onSettled`            | `(data, error) => void` | —               | Callback run when a query completes (success or failure).                                                  |

---

### Returned Properties

The hook returns the following control and state properties (`QueryResult`):

| Property       | Type                         | Description                                                                                                               |
| :------------- | :--------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| `data`         | `TData`                      | The fetched (and optionally transformed/unwrapped) query data, or `undefined` if loading and no `initialData` is present. |
| `error`        | `ErrorResponse \| undefined` | The error object if the query failed.                                                                                     |
| `isFetching`   | `boolean`                    | Indicates if a query fetch is currently in progress.                                                                      |
| `isRefetching` | `boolean`                    | Indicates if a background refresh of the existing cached data is in progress.                                             |
| `isSuccess`    | `boolean`                    | True if the query resolved successfully.                                                                                  |
| `isError`      | `boolean`                    | True if the query failed.                                                                                                 |
| `isFetched`    | `boolean`                    | True if the query has successfully resolved at least once.                                                                |
| `isEmpty`      | `boolean`                    | True if the query resolved successfully and the `data` is empty (e.g. `null`, `undefined`, or `[]`).                      |
| `refetch`      | `() => Promise<TData>`       | Triggers a manual refetch of the data.                                                                                    |
| `reset`        | `() => void`                 | Resets the hook state back to the configured `initialData`.                                                               |

---

### Lazy `initialData`

The `initialData` option supports functions for lazy evaluation, preventing unnecessary computations during component render passes:

```ts
initialData: () => computeDefaultPayload();
```

### Smart `queryKey` Object Serialization

When providing a custom `queryKey` array, Actyx RPC automatically detects and serializes nested objects (e.g., filter payloads) using `JSON.stringify`, ensuring deep comparison cache matching works out-of-the-box:

```ts
// Evaluates internally as: "user|{\"id\":\"123\",\"org\":\"explita\"}"
queryKey: ["user", { id: "123", org: "explita" }];
```

### Automatic Response Unwrapping

If your procedures wrap return shapes inside payload keys (e.g. returning `{ data: ... }`), set `unwrap: true` to return the nested payload directly:

```tsx
const { data } = useQuery(getSettings, {
  unwrap: true, // Strips away wrapper structure automatically
  initialData: { name: "Default Company", branches: [] },
});
```
---

## `useSuspenseQuery`

For applications leveraging React Suspense boundaries:

```tsx
import { useSuspenseQuery } from "@explita/actyx-rpc/react";
import { Suspense } from "react";

function TodoList() {
  const { data: todos } = useSuspenseQuery(() => getTodos(), {
    queryKey: ["todos"],
  });

  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>{todo.text}</li>
      ))}
    </ul>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading todos...</div>}>
      <TodoList />
    </Suspense>
  );
}
```

---

## `useQueries`

Fetch multiple independent queries in parallel with a single hook call. Uses rest parameters for full tuple type inference:

```tsx
import { useQueries } from "@explita/actyx-rpc/react";
import { getTodos, getUser } from "@/backend/procedures";

const [todosResult, userResult] = useQueries(
  {
    proc: getTodos,
    queryKey: ["todos"],
    refetchOnWindowFocus: true,
  },
  {
    proc: () => getUser({ id: userId }),
    queryKey: ["user", userId],
    enabled: !!userId,
  },
);

if (todosResult.isFetching) return <p>Loading todos...</p>;
if (userResult.isError) return <p>Error loading user</p>;
```

Each config accepts all `useQuery` options except `queryKey` (which is required). Returns a tuple of `QueryResult` objects, one per query, with proper per-element type inference.

---

## `useIsFetching`

Track whether any query is currently fetching globally or by a specific key prefix:

```tsx
import { useIsFetching } from "@explita/actyx-rpc/react";

function GlobalLoader() {
  const isFetching = useIsFetching();
  // Or filter by key prefix:
  // const isTodosFetching = useIsFetching("todos");

  if (!isFetching) return null;

  return <div className="global-loader">Loading data...</div>;
}
```
