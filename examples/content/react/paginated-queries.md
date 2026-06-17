---
sidebar_position: 4
title: Paginated Queries
---

# Paginated Queries

For lists requiring bi-directional scrolling/pagination (such as loading older items upward and newer items downward), Actyx RPC provides the `usePaginatedQuery` hook. Unlike `useInfiniteQuery`, it returns properties and controls to navigate both forward and backward through pages.

---

## `usePaginatedQuery`

To fetch bi-directional paginated data:

```tsx
import { usePaginatedQuery } from "@explita/actyx-rpc/react";
import { getMessageHistory } from "@/backend/procedures";

function ChatHistory({ channelId }) {
  const {
    data: messages,
    fetchNext,
    fetchPrevious,
    hasNext,
    hasPrevious,
    isFetching,
    isRefetching,
    error,
  } = usePaginatedQuery(
    getMessageHistory,
    {
      initialInput: { channelId },
      initialPageParam: undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      queryKey: ["chat", channelId],
    }
  );

  if (isFetching && !isRefetching && messages.length === 0) {
    return <p>Loading messages...</p>;
  }

  return (
    <div>
      {hasPrevious && (
        <button 
          onClick={() => fetchPrevious()} 
          disabled={isFetching}
        >
          {isFetching ? "Loading older..." : "Load Older Messages"}
        </button>
      )}

      <ul>
        {messages.map((msg) => (
          <li key={msg.id}>
            <strong>{msg.user}:</strong> {msg.text}
          </li>
        ))}
      </ul>

      {hasNext && (
        <button 
          onClick={() => fetchNext()} 
          disabled={isFetching}
        >
          {isFetching ? "Loading newer..." : "Load Newer Messages"}
        </button>
      )}
    </div>
  );
}
```

---

## Configuration Options

`usePaginatedQuery` shares the exact same configuration options (`UseInfiniteQueryOpts`) as `useInfiniteQuery`.

For details on configuration options (e.g. `initialInput`, `staleTime`, `queryKey`), see the [Infinite Queries](infinite-queries.md#configuration-options) documentation.

---

## Returned Properties

`usePaginatedQuery` returns the full `InfiniteQueryResult` interface, including the bi-directional loading state and controls omitted in `useInfiniteQuery`:

| Property | Type | Description |
| :--- | :--- | :--- |
| `data` | `TPage[]` | Flattened array containing the combined items from all fetched pages. |
| `pages` | `TFullPage[]` | The raw array of fetched page structures. |
| `pageParams` | `(string \| number)[]` | The array of cursors/page parameters fetched so far. |
| **`hasPrevious`** | `boolean` | True if a previous page is available to fetch backward. |
| **`fetchPrevious`** | `() => Promise<TFullPage \| undefined>` | Triggers fetching the previous page of data backward. |
| `hasNext` | `boolean` | True if another page is available to fetch forward. |
| `fetchNext` | `() => Promise<TFullPage \| undefined>` | Triggers fetching the next page of data forward. |
| `isFetching` | `boolean` | Indicates if a fetch request (next or previous) is currently in progress. |
| `isRefetching` | `boolean` | Indicates if a background refresh of the existing pages is in progress. |
| `isSuccess` | `boolean` | True if the last fetch was successful. |
| `isError` | `boolean` | True if the last fetch failed. |
| `error` | `ErrorResponse \| undefined` | The error object if the fetch failed. |
| `isFetched` | `boolean` | True if the query has successfully resolved at least once. |
| `isEmpty` | `boolean` | True if the query resolved successfully and the flattened `data` array is empty. |
| `refetch` | `() => Promise<void>` | Clears cursors and refetches starting from the first page. |
| `reset` | `() => void` | Resets the hook state to initial settings. |

### Cache Mutation Helpers

Like `useInfiniteQuery`, this hook returns local cache manipulation helpers that return rollback functions for optimistic updates:

* **`remove(index | predicate)`**
* **`update(index | predicate, updater)`**
* **`prepend(item)`**
* **`append(item)`**
* **`insert(index, item)`**
* **`setPages(updater)`**
* **`snapshot()`**

For full details on using these methods for optimistic updates, see the [Cache Mutations & Rollbacks](cache-mutations.md) documentation page.
