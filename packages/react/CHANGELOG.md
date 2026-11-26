# Changelog

All notable changes to this package will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-11-26

### Added

- **Native `dedupKey` Automatic Upsert in `QueryClient` & Hooks**:
  - `QueryClient.append`, `QueryClient.prepend`, and `QueryClient.insert` now accept an optional `{ dedupKey?: (item) => any }` options argument (and fall back to global per-query options registered via `queryClient.setQueryOptions` / `getQueryOptions`).
  - When a matching item is found across cached arrays or `pages`, it is updated **in-place** with surgical rollback support instead of creating duplicates; non-matching items append/prepend/insert as usual.
  - `useQuery`, `useInfiniteQuery`, and `usePaginatedQuery` automatically register `dedupKey` and forward override options directly to `QueryClient` without wrapper boilerplate.
  - `useWSInfiniteQuery` and `useSSEInfiniteQuery` compute dynamic `"added"` vs `"updated"` actions in `onData` using `dedupKey`.
- **Real-Time Typing Indicators (`useWS` & `useWSInfiniteQuery`)**:
  - Added automated typing indicator management via `typing: false | WSTypingOptions` (`currentUserId` required, plus optional `event`, `timeout`, `throttle`, `getUser`, `clearOnMessage`).
  - Exposes `isTyping`, `typingUsers`, and `sendTyping` directly on `UseWSResult` and `UseWSInfiniteQueryResult`.
  - Automatically intercepts typing events before they enter `data`, throttles outgoing `sendTyping()` calls (default `"1.5s"`), expires inactive users per-user (default `"2s"`), and clears typing users when a regular message arrives (`clearOnMessage: true`).
  - `currentUserId` automatically stamps outgoing `sendTyping()` payloads (`{ user: { id: currentUserId } }`) and excludes local keystrokes from `isTyping` / `typingUsers` — making 1-on-1 chats work with `currentUserId` alone.
  - Built-in `defaultExtractTypingUser` normalizes `user`, `sender`, `author`, and flat `userId`/`senderId`/`authorId` payloads, with `getUser` for custom shapes and full TypeScript inference (`TypingUser`, `ExtractTypingUserFromOutput`, `NormalizeTypingUser`, `ExtractTypingUserFromOpts`).
- **Hybrid Client & Server Search (`useClientFilter` & Query Hooks)**:
  - Added `useClientFilter` hook and `search` configuration (`mode: "auto" | "client-only" | "server-only"`, `debounce`, `initial`, `filter`) across `useQuery`, `useInfiniteQuery`, and `usePaginatedQuery`, plus global defaults on `QueryClient`.
  - Exposes `search`, `setSearch`, `resetSearch`, `isFiltered`, and `unfilteredData`.
  - In `"auto"` mode, searches run against the server when more pages remain (`hasNext`) and seamlessly switch to zero-latency in-memory filtering once the full dataset is loaded.
  - Defers local filtering while a server search is debounced or in-flight so partial data does not flash empty.
- **`useMutation` & `SSEEventContext` Type Helpers**:
  - Exported `MutationCtx`, `DropActionContext`, `DropMutationCtx`, and `SSEEventContext`.

### Changed

- **`QueryResult.update` Returns Rollback Function**:
  - Single-argument whole-state `query.update(valueOrUpdater)` on `useQuery` now captures a `QueryClient.snapshot(queryKey)` prior to updating and returns the `() => void` rollback function, matching `append`, `prepend`, `insert`, `remove`, and 2-arg `update`.
  - Updated `QueryResult.update` TypeScript overloads to return `() => void` across both whole-state and array-item forms.
- **`prefetchQuery` & `prefetchInfiniteQuery` Return `[data, err]` Tuple**:
  - `QueryClient.prefetchQuery` and `QueryClient.prefetchInfiniteQuery` now return `Promise<[TOutput, null] | [null, TError]>` (including `[existing.data, null]` / `[existing.data.pages[0], null]` on fresh cache hits) so Server Components can handle errors directly without dehydrating error states.

### Fixed

- **Disabled Query `isLoading` Guard**:
  - Updated `isLoading` in `useQuery`, `useInfiniteQuery`, and `usePaginatedQuery` to include `&& enabled !== false`, preventing disabled queries from reporting `isLoading: true`.
- **WebSocket Strict-Mode & Handshake Cleanup**:
  - Added `closeSocketSafely` to defer closing `CONNECTING` WebSockets until `onopen`, preventing premature handshake warnings during React Strict Mode mount/unmount cycles.

## [0.3.1] - 2026-09-30

### Added

- **First-Class Procedure `input` and `...extraArgs` on `useQuery` and `useSuspenseQuery`**:
  - `useQuery` and `useSuspenseQuery` now accept `opts.input` matching procedure schemas, eliminating the need to wrap calls in inline arrow functions (`() => proc(args)`).
  - Procedures without input schemas or with additional arguments forward trailing positional parameters directly (`useQuery(proc, opts, ...extraArgs)`).
  - Strict compile-time type safety: procedures with required input enforce `input` in `opts`, while procedures with optional or no input make `input` optional.
  - Automatic cache key generation: when `queryKey` is omitted, `input` and `extraArgs` are automatically serialized into the fallback cache key, ensuring input changes trigger immediate background refetches without key collisions.
  - Full backward compatibility: zero-argument procedures and custom closures (`() => ...`) continue to work seamlessly.

## [0.3.0] - 2026-09-25

### Added

- **HTTP Request Batching & Link Deduplication**:
  - Integrated `BatchManager` pooling concurrent queries into a single `POST /api/rpc?batch=1` request.
  - In-flight link deduplication: identical concurrent calls share the same resolved in-memory Promise and wire payload entry.
  - Supported `batch: true | { delay?: number, maxBatchSize?: number }` on `createClient`.
  - Added per-query opt-out (`{ batch: false }`) and real-time telemetry access via `rpc.$batch()`.
- **Universal SSR Hydration & State Persistence**:
  - Added `<HydrationBoundary>` component, `useHydrate()`, `dehydrate()` serializer, and `QueryClient.prefetchQuery()` for zero-flicker hydration across Next.js, Remix, Astro, custom SSR, and offline storage.
  - Client queries consume hydrated cache instantly on initial mount with zero loading flicker.
- **Automated Cache Garbage Collection & LRU Eviction**:
  - Added `gcTime` (default: 5m) with automatic timers for inactive queries.
  - Added `maxCacheSize` (default: 250) with LRU eviction of oldest unobserved queries.
  - Added `queryClient.removeQueries()` and proxy helper `rpc.<proc>.remove()` for targeted manual cache eviction.
- **Actyx DevTools**:
  - Added `<ActyxDevtools />` floating overlay for monitoring queries, mutation history logs, and real-time SSE/WS streams.
  - Interactive breadcrumb procedure path viewer, serialized arguments inspector, and live activity badge.
  - Keyboard shortcuts (`Alt+A` / `⌥A`, `Ctrl+Shift+A` / `⌘+Shift+A`).
  - Added cache management toolbar: **Invalidate All** (background refetch), **Reset All** (empty & refetch), and **Clear Cache** (memory wipe).
- **Client Interceptors & Auth Refresh Loop**:
  - Added `onRequest`, `onResponse`, and `onError` lifecycle interceptors to `createClient`.
  - Transparent request replay via `retry()` with re-evaluated headers and `maxRetries` loop protection.

### Fixed

- **Direct Proxy Method Inference**:
  - Direct proxy function invocations (`rpc.health()`, `rpc.todos.list()`) now infer `GET` for queries instead of defaulting to `POST`.
- **Query Reset Loading Lock**:
  - `resetQuery()` now triggers refetch for active queries, preventing mounted components from getting permanently stuck in `isLoading: true`.
- **Observer Preservation on Clear Cache**:
  - `clearCache()` purges cached data while preserving active React component subscriptions, allowing `invalidateAll()` to revive mounted queries cleanly.
- **DevTools Hydration Flash**:
  - Fixed queryCount badge hydration mismatch by mounting the badge client-side with proper state guards.

---

## [0.2.0] - 2026-09-23

### Added

- **Server-Only Endpoint Filtering on Client Proxy**:
  - `ClientInstance<Router>` uses TypeScript key remapping to automatically omit procedures tagged with `_def: { type: "webRoute" }` from the client proxy SDK.
  - Prevents accidental client invocation and eliminates type pollution from server-only route handlers.
- **Mandatory Real-Time Infinite Query Streaming Targets**:
  - `useSSEInfiniteQuery` and `useWSInfiniteQuery` now enforce a required `stream` or `ws` parameter (accepting either another procedure proxy like `rpc.notif.sse` or a direct URL string).
  - Eliminates invalid fallbacks to paginated query procedures whose endpoints return standard JSON rather than stream payloads.
- **Standardized `.useSSE()` on Stream Procedures**:
  - Unified the streaming hook API across both `.sse()` and `.stream()` procedures under `.useSSE()`.
  - Stream procedures can also be invoked directly as asynchronous iterators (`for await (const chunk of rpc.feed())`).

### Fixed

- **Zero-Argument Input Enforcement Fix**:
  - Introduced `IsEmptyOrOptionalInput<T>` helper to properly handle `void`, `undefined`, `never`, and optional unions.
  - Calling `.useSSE()` or direct execution on procedures without inputs no longer incorrectly demands `input: unknown`.
- **Client Hook Argument Parsing (`parseHookArgs`)**:
  - Enhanced argument discriminator to properly identify `stream`, `ws`, `queryOpts`, `onData`, and `maxHistory` configuration objects, ensuring they are never mistaken for procedure inputs.
- **Universal `createClient` Support**:
  - Ensured `createClient` functions cleanly without `"use client"` restrictions so proxies can be imported and executed directly in server contexts, background workers, or external services without RSC client-reference stubbing.

---

## [0.1.0] - 2026-09-20

### Added

- **Initial Split Release**: Extracted `@explita/actyx-rpc-react` from the core `@explita/actyx-rpc` package as a dedicated, standalone React client library.
- **Core Procedure Hooks**:
  - `useQuery`: Type-safe querying of Actyx RPC procedures with automatic cache integration, stale-while-revalidate, debounce, and unwrap capabilities.
  - `useMutation`: Procedure execution with in-flight lock deduplication, optimistic updates, and external `AbortController` cancellation.
  - `useSuspenseQuery`: React 19 / Concurrent Mode compatible data fetching for suspense boundaries.
  - `useQueries`: Parallel fetching with full per-element generic inference and autocomplete.
- **Pagination & Infinite Query Hooks**:
  - `useInfiniteQuery`: Cursor and offset-based pagination with cache snapshotting and page appending/prepending.
  - `usePaginatedQuery`: Structured page/pageSize query execution.
  - `syncSelection` support: Keep selected items synchronized across page changes.
- **Real-Time Streaming Hooks**:
  - `useSSE`: Server-Sent Events subscription hook with automatic reconnect and event history management.
  - `useWS`: WebSocket client hook with heartbeat ping/pong, pending message queue, and deduplication keys.
  - `useSSEInfiniteQuery` and `useWSInfiniteQuery`: Infinite query feeds streaming real-time live events.
- **State & Activity Tracking**:
  - `useIsFetching`: Boolean indicator tracking global or key-filtered fetching states.
  - `useIsMutating`: Boolean indicator tracking pending mutation operations.
- **Cache & Provider Infrastructure**:
  - `ActyxProvider`: Context provider supplying the client runtime to component subtrees.
  - `QueryClient`: In-memory query cache with TTL, stale time windows, and tag/key invalidation.
  - `useQueryClient` & `getCachedQueryClient()`: Safe access to active query client instances.
