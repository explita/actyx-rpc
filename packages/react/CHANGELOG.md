# Changelog

All notable changes to this package will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
