---
sidebar_position: 6
title: Cache Mutations & Rollbacks
---

# Cache Mutations & Optimistic Rollbacks

Actyx RPC provides a powerful set of mutation helper functions inside `useInfiniteQuery` and `usePaginatedQuery` hooks. These helpers let you perform client-side CRUD modifications on your query pages cache without triggering a full network refetch, preserving the user's scroll position and loaded pages.

## Mutation Helpers

The following helpers are exposed in the hook's return object:

### `removeItem(arg)`
Removes an item from the cache.
- **Arguments**:
  - `arg`: Can be the item's index in the flattened array (`number`) or a predicate function `(item: TPage) => boolean`.
- **Returns**: A `rollback()` function.

```typescript
const { removeItem } = useInfiniteQuery(getPosts);

// Remove item by index
removeItem(3);

// Remove item by predicate
removeItem(post => post.id === 42);
```

### `updateItem(arg, updater)`
Updates an item in the cache.
- **Arguments**:
  - `arg`: Can be the item's index in the flattened array (`number`) or a predicate function to locate the item.
  - `updater`: The updated item object OR a callback `(item: TPage) => TPage`.
- **Returns**: A `rollback()` function.

```typescript
const { updateItem } = useInfiniteQuery(getPosts);

// Update status of a matching post
updateItem(
  post => post.id === postId,
  post => ({ ...post, likes: post.likes + 1 })
);
```

### `prependItem(item)`
Inserts a new item at the beginning of the first page.
- **Returns**: A `rollback()` function.

```typescript
const { prependItem } = useInfiniteQuery(getPosts);
prependItem(newPost);
```

### `appendItem(item)`
Inserts a new item at the end of the last page.
- **Returns**: A `rollback()` function.

```typescript
const { appendItem } = useInfiniteQuery(getPosts);
appendItem(newPost);
```

### `insertItem(index, item)`
Inserts an item at a specific index in the flattened list.
- **Returns**: A `rollback()` function.

```typescript
const { insertItem } = useInfiniteQuery(getPosts);
insertItem(2, newPost);
```

### `setPages(updater)`
Exposes direct access to the entire pages structure for custom updates.
- **Returns**: A `rollback()` function.

```typescript
const { setPages } = useInfiniteQuery(getPosts);
setPages(oldPages => oldPages.map(page => ...));
```

---

## Optimistic Updates & Rollbacks

All cache helpers automatically return a `rollback()` function that restores the cache state back to exactly what it was before the helper was executed.

### Example: Individual Rollback
```typescript
const { updateItem } = useInfiniteQuery(getServices);

const handleToggleStatus = async (serviceId: string) => {
  // 1. Update status optimistically & capture rollback callback
  const rollback = updateItem(
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
const { prependItem, removeItem, snapshot } = useInfiniteQuery(getPosts);

const handleBatchAction = async () => {
  // 1. Take snapshot of the current state
  const rollback = snapshot();

  // 2. Perform multiple operations
  prependItem(newPost);
  removeItem(post => post.id === oldPostId);

  // 3. Make server call
  const [result] = await syncBatchWithServer();

  // 4. Revert all mutations on failure
  if (!result?.success) {
    rollback();
  }
};
```
