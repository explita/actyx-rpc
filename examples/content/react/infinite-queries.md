---
sidebar_position: 3
title: Infinite Queries
---

# Infinite Queries

For lists that load more data as the user scrolls or clicks a "Load More" button, Actyx RPC provides the `useInfiniteQuery` hook. It handles paginated data loading forward, tracks multiple pages in a single cache entry, flattens the records for simple rendering, and supports optimistic cache mutations.

---

## `useInfiniteQuery`

To fetch forward-only paginated data:

```tsx
import { useInfiniteQuery } from "@explita/actyx-rpc/react";
import { getFeedPosts } from "@/backend/procedures";

function Feed() {
  const {
    data: posts, // Flattened TPage[] array across all loaded pages
    pages,       // Raw array of page objects: InfiniteQueryPage<TPage>[]
    fetchNext,
    hasNext,
    isFetching,
    isRefetching,
    isEmpty,
    error,
    refetch,
  } = useInfiniteQuery(
    getFeedPosts,
    {
      input: { limit: 10 },
      initialPageParam: undefined, // Start at the beginning
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      queryKey: ["feed"],
    }
  );

  if (isFetching && !isRefetching) return <p>Loading feed...</p>;
  if (error) return <p>Error loading feed: {error.message}</p>;
  if (isEmpty) return <p>No posts available.</p>;

  return (
    <div>
      <ul>
        {posts.map((post) => (
          <li key={post.id}>
            <h3>{post.title}</h3>
            <p>{post.content}</p>
          </li>
        ))}
      </ul>

      {hasNext && (
        <button 
          onClick={() => fetchNext()} 
          disabled={isFetching}
        >
          {isFetching ? "Loading more..." : "Load More"}
        </button>
      )}

      {isRefetching && <p>Updating background feed...</p>}
      <button onClick={() => refetch()}>Refresh Feed</button>
    </div>
  );
}
```

---

## Configuration Options

The `useInfiniteQuery` hook accepts two arguments:
1. **`proc`**: A procedure function that handles the server query.
2. **`options`**: An optional configuration object (`UseInfiniteQueryOpts`):

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `input` | `WithoutCursor<TInput>` | — | Base input parameters for the procedure (excluding the `cursor`). |
| `initialPageParam` | `string \| number` | `undefined` | The cursor parameter to use for the first page fetch. |
| `getNextPageParam` | `(lastPage, allPages) => cursor` | — | Callback to determine the cursor parameter for the next page. If not specified, defaults to checking `lastPage.nextCursor`. |
| `queryKey` | `unknown[]` | — | Unique array key for caching and invalidation. |
| `maxPages` | `number` | — | Maximum number of pages to keep in the cache. Discards oldest pages when exceeded. |
| `enabled` | `boolean` | `true` | Set to `false` to disable automatic loading on mount. |
| `staleTime` | `number \| string` | `0` | Time in milliseconds (or string window e.g., `"5m"`) before data is considered stale. |
| `gcTime` | `number \| string` | `5 * 60 * 1000` | Time in milliseconds (or string window) before unused cache data is garbage collected. |
| `refetchInterval` | `number` | `0` | Time in milliseconds for automatic background polling. |
| `refetchOnWindowFocus` | `boolean` | `false` | Automatically refetch when the window regains focus. |
| `refetchOnReconnect` | `boolean \| "always"` | `true` | Refetch when internet connection is restored. |
| `initialData` | `data \| (() => data)` | — | Pre-populates the cache pages on mount. |
| `onSuccess` | `(data) => void` | — | Callback run on successful page load. |
| `onError` | `(error) => void` | — | Callback run when a fetch fails. |
| `onSettled` | `() => void` | — | Callback run when a query completes (success or failure). |
| `keepPreviousData` | `boolean` | `true` | Keep old data visible during refetch instead of flashing an empty state. |
| `syncSelection` | `boolean \| ((a: TPage, b: TPage) => boolean)` | `false` | Keeps `selectedItem` in sync with latest query updates (matches by `id` by default or custom comparator). |
| `args` | `TArgs` | — | Extra positional arguments passed to the procedure after the input object. |

---

## Returned Properties

| Property | Type | Description |
| :--- | :--- | :--- |
| `data` | `TPage[]` | Flattened array containing the combined items from all fetched pages. |
| `pages` | `TFullPage[]` | The raw array of fetched page structures. |
| `pageParams` | `(string \| number)[]` | The array of cursors/page parameters fetched so far. |
| `hasNext` | `boolean` | True if another page is available to fetch. |
| `fetchNext` | `() => Promise<TFullPage \| undefined>` | Triggers fetching the next page of data. |
| `selectedItem` | `TPage \| null` | The currently synchronized selected item (when `syncSelection` or `selectItem` is used). |
| `selectItem` | `(item: TPage \| null \| ((prev: TPage \| null) => TPage \| null)) => void` | Setter to change or clear the active `selectedItem`. |
| `isFetching` | `boolean` | Indicates if a fetch request is currently in progress. |
| `isRefetching` | `boolean` | Indicates if a background refresh of the existing pages is in progress. |
| `isSuccess` | `boolean` | True if the last fetch was successful. |
| `isError` | `boolean` | True if the last fetch failed. |
| `error` | `ErrorResponse \| undefined` | The error object if the fetch failed. |
| `isFetched` | `boolean` | True if the query has successfully resolved at least once. |
| `isEmpty` | `boolean` | True if the query resolved successfully and the flattened `data` array is empty. |
| `refetch` | `() => Promise<void>` | Clears cursors and refetches starting from the first page. |
| `reset` | `() => void` | Resets the hook state to initial settings. |

### Cache Mutation Helpers

`useInfiniteQuery` also returns helper methods for modifying local cache state optimistically without causing a network refetch. All of these methods return a `rollback()` function.

* **`remove(index | predicate)`**: Removes an item from the cache.
* **`update(index | predicate, updater)`**: Updates an item in the cache.
* **`prepend(item | items)`**: Inserts a new item (or array of items) at the beginning of the first page.
* **`append(item | items)`**: Inserts a new item (or array of items) at the end of the last page.
* **`insert(index, item | items)`**: Inserts an item (or array of items) at a specific flattened index.
* **`setPages(updater)`**: Direct access to mutate the pages array.
* **`snapshot()`**: Takes a snapshot of current cache state to restore later.

For full examples of cache mutations and rollbacks, see the [Cache Mutations & Rollbacks](cache-mutations.md) documentation page.

