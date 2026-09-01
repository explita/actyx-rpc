---
sidebar_position: 6
title: Cache Mutations & Rollbacks
---

# Cache Mutations & Optimistic Rollbacks

Actyx RPC provides a powerful set of mutation helper functions inside `useInfiniteQuery` and `usePaginatedQuery` hooks. These helpers let you perform client-side CRUD modifications on your query pages cache without triggering a full network refetch, preserving the user's scroll position and loaded pages.

## Mutation Helpers

The following helpers are exposed in the hook's return object:

### `remove(arg)`
Removes an item from the cache.
- **Arguments**:
  - `arg`: Can be the item's index in the flattened array (`number`) or a predicate function `(item: TPage) => boolean`.
- **Returns**: A `rollback()` function.

```typescript
const { remove } = useInfiniteQuery(getPosts);

// Remove item by index
remove(3);

// Remove item by predicate
remove(post => post.id === 42);
```

### `update(arg, updater)`
Updates an item in the cache.
- **Arguments**:
  - `arg`: Can be the item's index in the flattened array (`number`) or a predicate function to locate the item.
  - `updater`: The updated item object OR a callback `(item: TPage) => TPage`.
- **Returns**: A `rollback()` function.

```typescript
const { update } = useInfiniteQuery(getPosts);

// Update status of a matching post
update(
  post => post.id === postId,
  post => ({ ...post, likes: post.likes + 1 })
);
```

### `prepend(item)`
Inserts a new item or array of items at the beginning of the first page.
- **Arguments**: `item: TPage | TPage[]`
- **Returns**: A `rollback()` function.

```typescript
const { prepend } = useInfiniteQuery(getPosts);

// Single item
prepend(newPost);

// Batch prepend
prepend([postA, postB]);
```

### `append(item)`
Inserts a new item or array of items at the end of the last page.
- **Arguments**: `item: TPage | TPage[]`
- **Returns**: A `rollback()` function.

```typescript
const { append } = useInfiniteQuery(getPosts);

// Single item
append(newPost);

// Batch append
append([postA, postB]);
```

### `insert(index, item)`
Inserts an item or array of items at a specific index in the flattened list.
- **Arguments**: `index: number`, `item: TPage | TPage[]`
- **Returns**: A `rollback()` function.

```typescript
const { insert } = useInfiniteQuery(getPosts);

// Single item at index 2
insert(2, newPost);

// Batch insert at index 2
insert(2, [postA, postB]);
```

### `setPages(updater)`
Exposes direct access to the entire pages structure for custom updates.
- **Returns**: A `rollback()` function.

```typescript
const { setPages } = useInfiniteQuery(getPosts);
setPages(oldPages => oldPages.map(page => ...));
```

---

## Standalone `QueryClient` Cache Mutations

You can also perform mutations outside of hooks directly on `QueryClient` using a `queryKey`:

```typescript
import { useQueryClient } from "@explita/actyx-rpc/react";

const queryClient = useQueryClient();

// Mutate infinite query cache by key
queryClient.prepend(["posts"], newPost);
queryClient.append(["posts"], [postA, postB]);
queryClient.insert(["posts"], 2, newPost);
queryClient.update(["posts"], post => post.id === id, updated);
queryClient.remove(["posts"], post => post.id === id);
```

---

## Optimistic Updates & Rollbacks

All cache helpers automatically return a `rollback()` function that restores the cache state back to exactly what it was before the helper was executed.

### Example: Individual Rollback
```typescript
const { update } = useInfiniteQuery(getServices);

const handleToggleStatus = async (serviceId: string) => {
  // 1. Update status optimistically & capture rollback callback
  const rollback = update(
    s => s.id === serviceId,
    s => ({ ...s, status: "ACTIVE" })
  );

  // 2. Perform server call
  const [result, error] = await toggleServiceStatus({ serviceId });

  // 3. If it fails, revert back to the original state
  if (!result?.success) {
    rollback();
    toast.error("Failed to update status on server.");
  }
};
```

### Example: Grouped Rollback using `snapshot()`
If you perform multiple mutations and want to rollback all changes together on failure, use the `snapshot()` method:

```typescript
const { prepend, remove, snapshot } = useInfiniteQuery(getPosts);

const handleBatchAction = async () => {
  // 1. Take snapshot of the current state
  const rollback = snapshot();

  // 2. Perform multiple operations
  prepend(newPost);
  remove(post => post.id === oldPostId);

  // 3. Make server call
  const [result] = await syncBatchWithServer();

  // 4. Revert all mutations on failure
  if (!result?.success) {
    rollback();
  }
};
```
