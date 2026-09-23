---
sidebar_position: 2
title: Client Proxy SDK
---

# Client Proxy SDK (`createClient`)

The `@explita/actyx-rpc-react` package provides `createClient`, a lightweight TypeScript proxy that turns your backend router into a fully typed client.

Instead of writing manual API routes, URL query strings, or boilerplate `fetch` calls, you can call any procedure on your router directly or through React hooks with end-to-end autocomplete and type safety.

```
┌─────────────────────────┐          HTTP / SSE / WS          ┌──────────────────────────┐
│  Client Proxy (rpc)     │ ────────────────────────────────> │ Next.js Route Handler    │
│  - rpc.todos.list()     │                                   │ createHandler(appRouter) │
│  - .useQuery()          │                                   │ /api/rpc/[...rpc]        │
│  - .useMutation()       │ <──────────────────────────────── │                          │
└─────────────────────────┘          [data, error]            └──────────────────────────┘
```

---

## 1. Defining the Router & Route Handler

Before using the client proxy, assemble your procedures into a router using `createRouter` and export `appRouter` along with its type `AppRouter`:

```ts
// backend/router.ts
import { createRouter } from "@explita/actyx-rpc";
import { todoProcedures } from "./todos";
import { mediaProcedures } from "./media";

export const appRouter = createRouter({
  todos: createRouter({
    list: todoProcedures.list,
    add: todoProcedures.add,
  }),
  media: createRouter({
    upload: mediaProcedures.upload,
    uploadAvatar: mediaProcedures.uploadAvatar,
  }),
});

// Export the router type for the client proxy
export type AppRouter = typeof appRouter;
```

Mount `appRouter` in your Next.js route handler (`app/api/rpc/[...rpc]/route.ts`):

```ts
// app/api/rpc/[...rpc]/route.ts
import { createHandler } from "@explita/actyx-rpc/adapters/next";
import { appRouter } from "@/backend/router";

export const { GET, POST } = createHandler(appRouter);
```

---

## 2. Initializing the Client

Create a client instance by passing your backend `AppRouter` type to `createClient`:

```ts
// lib/rpc/client.ts
import { createClient } from "@explita/actyx-rpc-react";
import type { AppRouter } from "@/backend/router";

export const rpc = createClient<AppRouter>({
  baseUrl: "/api/rpc",
  // Optional: Dynamic authentication headers
  headers: async () => {
    const token = await getSessionToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
});
```

### Client Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `baseUrl` | `string` | **Required** | The API endpoint where `createHandler` is mounted (e.g. `"/api/rpc"`). |
| `headers` | `Record<string, string> \| (() => Promise<Record<string, string>>)` | `undefined` | Custom static headers or an async getter function evaluated on each request. |
| `routing` | `"path" \| "query"` | `"path"` | Routing strategy: `"path"` (`/api/rpc/todos.list`) or `"query"` (`/api/rpc?procedure=todos.list`). |
| `queryMethod` | `"GET" \| "POST"` | `"GET"` | Default HTTP method used when executing queries. |
| `fetch` | `typeof fetch` | `globalThis.fetch` | Custom fetch implementation (e.g. for testing, mocks, or Axios-style interceptors). |

---

## 3. Direct Procedure Execution

Every procedure on the proxy can be invoked directly as a function. It returns a promise that resolves to Actyx RPC's canonical `[data, error]` tuple:

```ts
// Direct call without hooks — event handlers, background scripts, or client utilities
const [data, error] = await rpc.todos.add({
  text: "Prepare launch announcement",
});

if (error) {
  console.error("Failed to add todo:", error.message);
  return;
}

console.log("Created todo ID:", data.id);
```

### Standard Promise Methods

Direct calls also support `.then()`, `.catch()`, and `.finally()`:

```ts
rpc.todos.add({ text: "Write documentation" })
  .then(([data, error]) => {
    if (data) showSuccessToast();
  })
  .catch((err) => {
    console.error("Network error:", err);
  });
```

> [!WARNING]
> **Server-to-Server Overhead: Avoid Calling `rpc.*` in React Server Components**
>
> Calling a client proxy procedure from the server like:
> ```ts
> // ⚠️ In a Server Component or Server Action — AVOID THIS:
> const [res, err] = await rpc.todos.list();
> ```
> is a waste of resources because your server creates an unnecessary HTTP loopback request over the network (or localhost) to its own API route instead of executing in-memory. Additionally, it requires configuring an absolute `baseUrl` (since Node.js `fetch` cannot resolve relative URLs like `"/api/rpc"`).
>
> **Always invoke the router directly on the server:**
> ```ts
> // ✅ In a Server Component, Server Action, or Route Handler — DO THIS:
> import { appRouter } from "@/backend/router";
>
> const [res, err] = await appRouter.todos.list();
> ```
> Direct router calls execute in-process with zero HTTP overhead, zero serialization latency, and native database/context access.
>
> **When should you use `createClient` on the server?**
> Only when making **truly external cross-service calls** across different backends or microservices (e.g. Service A calling Service B over HTTP via `createClient<ServiceBRouter>({ baseUrl: "https://api.service-b.com/api/rpc" })`).


---

## 4. React Hooks on the Proxy

Every procedure on the proxy exposes built-in React hooks that bind directly to the React `QueryClient`:

### `useQuery`

```tsx
function TodoList() {
  const { data: todos, isLoading, error, refetch } = rpc.todos.list.useQuery({
    unwrap: true, // Returns array directly instead of tuple
    staleTime: "1m",
  });

  if (isLoading) return <div>Loading todos...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>{todo.text}</li>
      ))}
    </ul>
  );
}
```

### `useMutation`

```tsx
function AddTodoForm() {
  const { mutate, isPending, error } = rpc.todos.add.useMutation({
    onSuccess(newTodo) {
      toast.success("Todo added!");
      // Automatically refresh the list
      rpc.todos.list.invalidate();
    },
    onError(err) {
      toast.error(err.message);
    },
  });

  return (
    <button
      disabled={isPending}
      onClick={() => mutate({ text: "Finish tasks" })}
    >
      {isPending ? "Adding..." : "Add Todo"}
    </button>
  );
}
```

### `usePaginatedQuery`

Bi-directional cursor or offset pagination with zero boilerplate:

```tsx
function PaginatedPosts() {
  const { data: posts, page, totalPages, nextPage, prevPage } =
    rpc.posts.list.usePaginatedQuery({ pageSize: 10 });

  return (
    <div>
      {posts.map((post) => (
        <p key={post.id}>{post.title}</p>
      ))}
      <button onClick={prevPage} disabled={page === 1}>Previous</button>
      <button onClick={nextPage} disabled={page === totalPages}>Next</button>
    </div>
  );
}
```

### `useInfiniteQuery`

Infinite scroll feeds that automatically accumulate pages:

```tsx
function Feed() {
  const { data: posts, fetchNextPage, hasNextPage, isFetchingNextPage } =
    rpc.posts.feed.useInfiniteQuery({
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    });

  return (
    <div>
      {posts.map((post) => (
        <article key={post.id}>{post.title}</article>
      ))}
      {hasNextPage && (
        <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? "Loading..." : "Load More"}
        </button>
      )}
    </div>
  );
}
```

### `useSuspenseQuery`

First-class React Suspense integration for server-rendered or async boundaries:

```tsx
function UserHeader() {
  const { data: user } = rpc.users.current.useSuspenseQuery();
  return <div>Welcome back, {user.name}!</div>;
}
```

---

## 5. File Uploads & Progress Tracking

The client proxy features automatic binary detection and multipart serialization. You don't have to manually construct `FormData` or manage boundary headers.

### Bare File Upload

Pass a raw `File` or `Blob` directly as the input:

```tsx
function SingleFileUpload() {
  const { mutate, isPending, progress } = rpc.media.uploadAvatar.useMutation({
    onProgress(percent) {
      console.log(`Upload: ${percent}%`);
    },
    onSuccess(fileInfo) {
      toast.success(`Uploaded ${fileInfo.name}`);
    },
  });

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) mutate(file); // Direct bare file!
  };

  return (
    <div>
      <input type="file" onChange={onFileChange} />
      {isPending && <div>Uploading: {progress}%</div>}
    </div>
  );
}
```

### Objects with Files and Arrays (`File[]`)

Pass objects containing single files, multiple files, or file arrays. The client automatically constructs bracket notation (`files[0]`, `user[avatar]`) while preserving primitive types:

```tsx
// Nested structure with files and primitives
await rpc.posts.create({
  title: "My Portfolio",
  tags: ["design", "art"],
  coverImage: coverFile, // File
  attachments: [file1, file2], // File[]
});
```

### Direct Upload Calls with Progress

You can also track upload progress on direct non-hook calls:

```ts
const [data, error] = await rpc.media.upload(file, {
  onProgress(percent) {
    console.log(`Upload progress: ${percent}%`);
  },
});
```

---

## 6. Procedure Cache & Lifecycle Utilities

Procedures on the proxy expose direct inspection and cache management utilities without needing to manually construct query keys:

```ts
// 1. Invalidation:
rpc.todos.list.invalidate(); // Invalidate all cached queries for todos.list
rpc.todos.get.invalidate({ id: "123" }); // Invalidate matching specific input

// 2. Cache inspection & manipulation:
const cachedTodos = rpc.todos.list.getQueryData();
rpc.todos.list.setQueryData([...cachedTodos, newTodo]);

// 3. Access exact generated query keys:
const key = rpc.todos.get.getQueryKey({ id: "123" });

// 4. Track fetching / mutating states anywhere:
const isListFetching = rpc.todos.list.isFetching();
const isTodoAdding = rpc.todos.add.isMutating();

// 5. Reset cached query to idle/initial state:
rpc.todos.list.reset();
```

---

## 7. Real-Time Streaming (SSE & WebSockets)

Procedures configured with `.sse()`, `.stream()`, or `.ws()` can be consumed via hooks or native async iteration:

### Server-Sent Events & Generator Streams (`.stream()` & `.useSSE()`)

Both `.sse()` and `.stream()` procedures can be consumed either reactively with `.useSSE()` or directly via `.stream()`:

#### Reactive Hook (`useSSE`)
Use `.useSSE()` inside React components for automatic connection management, reconnects, and reactive state (`data`, `lastData`, `isConnected`, `error`):

```tsx
function NotificationFeed() {
  const { lastData, isConnected } = rpc.notifications.useSSE();

  return (
    <div>
      <span>Status: {isConnected ? "Connected" : "Disconnected"}</span>
      <p>Latest: {lastData?.message}</p>
    </div>
  );
}
```

#### Direct Unfiltered Stream
For scripts, event listeners, or non-React contexts, invoke the procedure directly to get an `AsyncIterable` with zero React overhead:

```ts
// Direct call with native for-await-of loop
const stream = rpc.notifications({ channel: "alerts" });

for await (const event of stream) {
  console.log("Stream event:", event);
}

// Manually abort stream when done
stream.close();
```

### Full-Duplex WebSockets (`useWS`)

Procedures configured with `.ws()` can be consumed using `useWS`:

```tsx
function LiveChat() {
  const { send, lastMessage, isConnected } = rpc.chat.useWS();

  return (
    <div>
      <p>Status: {isConnected ? "Online" : "Offline"}</p>
      <button onClick={() => send({ text: "Hello!" })}>Send</button>
    </div>
  );
}
```

### Async Iteration on the Proxy

You can consume SSE and generator streams using standard `for await` loops:

```ts
for await (const event of rpc.liveActivity({ channelId: "123" })) {
  console.log("New event:", event);
}
```
