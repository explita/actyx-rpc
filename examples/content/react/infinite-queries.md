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
import { useInfiniteQuery } from "@explita/actyx-rpc-react";
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
      staleTime: "5m", // Keep cached pages fresh across navigation
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
| `dedupKey` | `(item: TPage) => any` | — | Key selector function for automatic in-place upsert deduplication when prepending or appending items. |
| `arrange` | `(data: TPage[]) => TPage[]` | — | Optional callback to arrange or sort the flattened data array. |
| `search` | `function \| object` | — | Search configuration: a filter predicate function shorthand `(item, query, i, arr) => boolean` or an object `{ filter?, initial?, mode?, debounce? }`. |
| `args` | `TArgs` | — | Extra positional arguments passed to the procedure after the input object. |

> [!TIP]
> **Typing Cursors Globally**: By default, cursor types default to `unknown` or inferred procedure params. You can register your application's global cursor type (e.g. `number`, `string`, or compound `{ id: string; createdAt: Date }`) using [Global Type Augmentation](../advanced/type-registration.md). Once registered, `pageParam`, `initialPageParam`, and procedure `cursor` fields are automatically typed across all infinite and paginated query hooks!

---

## Returned Properties

| Property | Type | Description |
| :--- | :--- | :--- |
| `data` | `TPage[]` | Flattened array containing the combined (and optionally filtered) items from all fetched pages. |
| `unfilteredData` | `TPage[]` | The full, unfiltered flattened array of items across all fetched pages. |
| `search` | `string` | The current search query string. |
| `setSearch` | `(query: string) => void` | Updates search query (filters locally or debounces server fetch based on `search.mode`). |
| `resetSearch` | `() => void` | Resets the search query back to `""` (or `search.initial`). |
| `isFiltered` | `boolean` | `true` when a search query is actively filtering results. |
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
* **`prepend(item | items, options?)`**: Inserts a new item (or array of items) at the beginning of the first page. When `dedupKey` is provided (either via hook options or `{ dedupKey }` override), matches are automatically updated in-place.
* **`append(item | items, options?)`**: Inserts a new item (or array of items) at the end of the last page. When `dedupKey` is provided (either via hook options or `{ dedupKey }` override), matches are automatically updated in-place.
* **`insert(index, item | items, options?)`**: Inserts an item (or array of items) at a specific flattened index.
* **`setPages(updater)`**: Direct access to mutate the pages array.
* **`snapshot()`**: Takes a snapshot of current cache state to restore later.

For full examples of cache mutations and rollbacks, see the [Cache Mutations & Rollbacks](cache-mutations.md) documentation page.

---

## Hybrid Search & Client Filtering

`useInfiniteQuery` supports built-in hybrid search and client-side filtering via the `search` option. It accepts either a **function shorthand** or a **configuration object**:

```tsx
// Pattern 1: Function shorthand
const {
  data: filteredPosts,
  unfilteredData: allPosts,
  search,
  setSearch,
  resetSearch,
  isFiltered,
} = useInfiniteQuery(getFeedPosts, {
  input: { limit: 10 },
  search: (post, query) =>
    post.title.toLowerCase().includes(query.toLowerCase()),
});

// Pattern 2: Configuration object
const query = useInfiniteQuery(getFeedPosts, {
  input: { limit: 10 },
  search: {
    filter: (post, query) =>
      post.title.toLowerCase().includes(query.toLowerCase()),
    initial: "", // Initial search query on mount
    mode: "auto", // "auto" | "client-only" | "server-only"
    debounce: 500, // Debounce in ms (or string like "500ms") before server calls
  },
});
```

### Search Modes

* **`"auto"` (default)**:
  * When more pages exist on the server (`hasNext === true`), calling `setSearch(query)` debounces and queries the server with `{ search: query }`, resetting pagination to page 1.
  * Once the entire dataset has been loaded (`hasNext === false`), `useInfiniteQuery` automatically switches to instant, zero-latency client filtering in memory without making further network calls.
* **`"client-only"`**: Never sends search queries to the server. All loaded pages are filtered in memory via the `filter` predicate.
* **`"server-only"`**: Always fires debounced search queries to the server, resetting pagination to page 1.

> [!NOTE]
> `search.initial` seeds the search state on mount (and resets it when `queryKey` changes). To keep URL query parameters in sync, call `setSearch(q)` and update the URL in your input handler — a page refresh will then pick up the URL parameter via `search.initial`.

