# Changelog

All notable changes to this package will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.0] - 2026-09-01

### Added

- **`useQueries` hook**: Parallel query fetching with typed per-element configs. Uses a structural tuple overload, so each element gets independent generics for full IDE autocompletion — no fixed query-count cap.
- **`UseQueriesItem` type**: Flat per-element config type extending `UseQueryOpts`. Generics (`TOutput`, `TQueryKey`, `TUnwrap`, `TSelectData`, `TInitialData`) flow from `proc` into all callbacks (`onSuccess`, `onSettled`, `select`).
- **`UseQueriesResult<TItem>` type**: Maps a single `useQueries` element to its `QueryResult`, resolving `proc` output, `unwrap`, `select`, and `initialData` in one pass. Exported from `@explita/actyx-rpc/react`.
- **`QueriesResults<T>` type**: Homomorphic mapped type that evaluates each tuple position via `UseQueriesResult` — eliminates the previous `Omit<T[], "success">`/union-distribution issues.
- **`InferOutput<T>` type**: Extracts the resolved output type from a finalized procedure. Exported from the main entry point.
- **`getCachedQueryClient()`**: Non-hook accessor for the active `QueryClient`, enabling SDK `invalidate()` to work outside React render without violating hooks rules.
- **`ctx.cache` & `ctx.cache.invalidate()` in terminal handlers**: Mutations, actions, streams, and WS procedures can now access the cache adapter and invalidate cache entries directly via `ctx.cache.invalidate(options)` — previously only available through the `.invalidate()` builder chain. Shared logic lives in `core/cache/invalidate.ts`.
- **`useMutation` — `abortController` option**: External `AbortController` to cancel URL-string mutations from outside the hook. Controllers are one-shot; subsequent `mutate()` calls fall back to a fresh internal controller.
- **`useMutation` — per-key mutation lock**: Concurrent `mutate()` calls for the same mutation key are now deduplicated — a second call while one is in-flight returns a `429 "Already in progress"` error instead of running in parallel. Mutation keys default to a `useId()`-based local key.
- **`useMutation` — debounce coalescing**: Repeated calls within a debounce window now share a single pending promise, and `reset()` rejects it.
- **`syncSelection` / `selectedItem` / `selectItem`**: Infinite and paginated queries can keep a selected item in sync with the latest data. `syncSelection` accepts `true` (matches by `id` via `defaultSyncSelection`) or a custom equality function.
- **`args` option for `useInfiniteQuery` / `usePaginatedQuery`**: Pass extra positional arguments to the procedure after the input object.
- **Array support for cache mutations**: `prepend`, `append`, and `insert` now accept `T | T[]` in `QueryClient`, all pagination hooks, and the WS/SSE event contexts. `WSEventContext` also gained `insert(index, item)`.
- **`useWS` — ping/pong**: Automatically answers `{ type: "ping" }` messages with `{ type: "pong" }`.
- **`useWS` — pending message queue**: `send()` calls made before the socket opens are queued and flushed on `onopen`.
- **`useWS` — typed error responses**: Parse failures and connection errors now produce `ErrorResponse`s (with `handlerName: "useWS"`) and invoke `onError`.
- **Async cache key/tag functions**: `CacheOptions.key`, `CacheOptions.tags`, and invalidation `keys`/`patterns`/`tags` functions may now return `MaybePromise` values.
- **Custom cache keys no longer hashed**: `withCache` stores the raw key when a custom `key` function is provided (previously always hashed).
- **`useSSE` — `maxHistory` default**: History trimming now defaults to `100`.
- **`useWSInfiniteQuery` — `queryError`**: Query errors are returned separately from the WS connection `error`.
- **WS/SSE infinite — extended `onWindowFocus` / `onReconnect` context**: Now receive `pages`, `pageParams`, and cache helpers (`reset`, `prepend`, `append`, `insert`, `update`, `remove`, `setPages`, `snapshot`).
- **ESLint configuration**: Added `eslint.config.mjs` with `typescript-eslint` rules. Run `pnpm lint` or `pnpm lint:fix`.
- **`engines` field**: Added `"node": ">=18"` to `package.json`.

### Changed (Breaking Changes)

- **`initialInput` → `input`**: `UseInfiniteQueryOpts.initialInput` has been renamed to `input`. Update all `useInfiniteQuery`, `usePaginatedQuery`, `useWSInfiniteQuery`, and `useSSEInfiniteQuery` configs.
- **`RateLimitOptions.key` signature**: Now receives `({ ctx, input }, req, context)` instead of `(ctx, req, context)`, and may be async. The builder's `rateLimit()` is now typed with the procedure's input.
- **`onUnsubscribed` receives `CloseEvent`**: `useWS.onUnsubscribed` now receives the `CloseEvent` instead of no arguments. WS procedure `onClose`/`onError` callbacks are likewise typed with `CloseEvent`/`Event`.
- **`onReconnectAttempt` is now 1-indexed**: The attempt count is incremented before the callback fires (previously 0-indexed).
- **`middleware` / `plugin` curried overload**: `procedure.middleware<ExpectedInput>()(mw)` and `procedure.plugin<ExpectedInput>()(plugin)` — the extra `()` lets TypeScript infer `NextCtx` while supplying `ExpectedInput` explicitly.

### Fixed

- **Plugin `onError` return type**: Now returns `MaybePromise<Partial<ErrorResponse> | void>`, allowing plugins to override error fields.
- **Plugin `onError` awaited**: `handler-resolver.ts` now awaits `plugin.onError()` in both error paths (isError + catch) and checks the return value for partial overrides.
- **SDK `useSuspenseQuery` return type**: Non-void branch now correctly returns `UseSuspenseQueryResult` instead of `QueryResult`.
- **SDK `invalidate()` hooks violation**: Replaced `useQueryClient()` call with `getCachedQueryClient()`, making `invalidate()` safe to call from event handlers.
- **`getSnapshot` simplified**: `use-query.ts` getSnapshot now uses direct reference equality (`if (next === snapshotRef.current) return snapshotRef.current`).
- **Stale-fetch race protection**: `useQuery`, `useQueries`, and `useMutation` now use generation counters so stale in-flight responses can't overwrite `reset()` or newer calls.
- **`useSSE` cleanup**: The active client is now closed even if cleanup runs during the connection race window, and `isConnected` is reset.

## [0.7.0] - 2026-06-30

### Added

- **`useIsFetching` Hook**: Track whether any query is currently fetching, globally or by key prefix. Returns a boolean.
- **`useWS` — `onData` action parameter**: `onData` now receives a second `action` argument (`"added" | "updated"`), indicating whether the incoming item was new or replaced an existing one via `dedupKey`.
- **`useWS` — `dedupKey` option**: Extract a unique identifier from each message. Incoming items with the same key as an existing item update in-place instead of appending.
- **`useWS` — `filter` option**: Optional predicate to control which incoming messages enter the `data` state. `onData` still fires regardless.
- **`useWS` — `onWindowFocus` / `onReconnect` callbacks**: Callbacks triggered when the window regains focus or the network reconnects, receiving the accumulated data array.
- **`useWS` — `onReconnectAttempt` / `onReconnectFailed` callbacks**: Track reconnection progress (`attempt` is 0-indexed) and exhaustion.
- **`useWSInfiniteQuery` — `onWindowFocus` / `onReconnect` callbacks**: Now receive an object with `{ data, refetch }` — the infinite query data and a refetch function — instead of raw WS data.
- **`useWSInfiniteQuery` / `useSSEInfiniteQuery` — `action` in `WSEventContext`**: The `onData` callback now receives an `action` field (`"added" | "updated"`) to distinguish new items from deduped updates.
- **`useInfiniteQuery` — `keepPreviousData` option**: When `false`, clears cached data during refetch so the UI shows a loading state instead of stale data. Defaults to `true`.
- **`useQuery` — `keepPreviousData` option**: Same behavior as infinite query — defaults to `true`.
- **`QueryClient.subscribeAll` / `isFetching` methods**: Internal API enabling `useIsFetching` to listen to all query state changes.
- **`applyWSHandler` — `WSProcedureContext` type**: Exported typed context interface replacing raw `any`.
- **`applyWSHandler` — Dual socket support**: Now supports both `ws` library (EventEmitter `.on()`) and DOM/WHATWG WebSocket (Node.js 21+, browser) by detecting the API at runtime.
- **`applyWSHandler` — Optional `broadcast`**: The `broadcast` option is now optional. When omitted, calling `broadcast()` in the procedure is a no-op.

### Fixed

- **`useInfiniteQuery` — refetch on `queryKey` change**: `initialFetchRef` now resets when the query key changes, ensuring fresh data is fetched for the new key.
- **`useInfiniteQuery` — stale-time guard restored**: The commented-out staleness check in the initial fetch effect is now active, preventing unnecessary re-fetches when data is fresh.
- **`QueryClient.prepend` / `append` — `updatedAt` for paginated data**: Page mutations now set `updatedAt: Date.now()`, consistent with the plain array path.
- **`useSSEInfiniteQuery` — Missing `action` in `WSEventContext`**: The SSE adapter now passes `action: "added"` to match the `WSEventContext` type requirement.
- **`createSSEResponse` — Next.js redirect handling**: Framework redirect errors (`NEXT_REDIRECT`) are now re-thrown via `parseFrameworkError` instead of being swallowed.

### Changed

- **`useWS` — `onSubscribed` server-controlled**: `setStatus("connected")` and `onSubscribed` no longer fire on `ws.onopen`. They now only fire when the server explicitly sends `{ type: "subscribed" }`, giving the server full control over connection readiness.
- **`applyWSHandler` — `WebSocket` type constraint removed**: Replaced the DOM `WebSocket` constraint with a minimal `WSSocket` interface matching both `ws` library and DOM-style APIs.
- **`QueriesResults` type**: Simplified to use `TOut` as `TSelectData` to avoid union type distribution issues with `Unwrap`.

---

## [0.6.0] - 2026-06-28

### Added

- **`useWSInfiniteQuery` Hook**: Added a new React hook that combines `useInfiniteQuery` with `useWS` for WebSocket-powered infinite pagination. Incoming WebSocket messages are automatically appended to the cached page data, and custom cache mutations (prepend, update) can be performed via the `onData` callback.
- **`useSSEInfiniteQuery` Hook**: Added a new React hook that combines `useInfiniteQuery` with `useSSE` for SSE-powered infinite pagination. Incoming SSE events are automatically appended to the cached page data, with event name tracking and custom cache mutation support.

### Fixed

- **Documentation Import Paths**: Corrected `createSSEResponse` import path (was incorrectly pointing to `@explita/actyx-rpc/adapters/next`, now from `@explita/actyx-rpc`). Corrected `SSEClient` import path (was incorrectly pointing to `@explita/actyx-rpc`, now from `@explita/actyx-rpc/client/sse`).

---

## [0.5.0] - 2026-06-16

### Added

- **Cache Mutation & Optimistic UI Updates**: Added built-in cache mutation utility functions to `useInfiniteQuery` and `usePaginatedQuery` hook returns:
  - `remove(index | filterFunc)`: Removes items from cached pages.
  - `update(index | filterFunc, updatedItem | updaterFunc)`: Updates specific items within cached pages and returns an automatic state rollback function.
  - `prepend(item)`, `append(item)`, and `insert(index, item)`: Inserts new items into pages with automatic state rollback functions.
  - `setPages(updaterFunc)`: Provides direct callback access to modify pages cache with state rollback.
- **New Query Status Flags**: Added `isRefetching` (fetches in progress on existing cache), `isFetched` (fetching has completed at least once), and `isEmpty` (lists completed fetching and yielded empty results) indicators to all pagination-aware queries.
- **Human-Readable Window Durations**: Added support for duration strings like `"10s"`, `"1m"`, `"1h"`, etc., in caching/staling configs (`staleTime`, `gcTime`) using the new `WindowTime` type.
- **Server Context Lookup**: Added `procedure.context` getter to fetch context values via async local storage, matching standard context resolution signatures.
- **Optimistic Mutation Tests**: Added extensive test suites in `tests/react-logic.test.ts` checking hook state operations, rollbacks, and active refetching logic.

### Changed (Breaking Changes)

- **QueryClient Invalidation Rename**: The method `invalidateQueries` on `QueryClient` has been renamed to `invalidate`.
- **Stale/GC Configuration Types**: Refactored `staleTime` and `gcTime` options inside `UseQueryOpts` from raw numbers to `WindowTime`.

---

## [0.4.0] - 2026-05-23

### Added

- **`QueryClient` and `ActyxProvider`**: Introduced a lightweight, zero-dependency caching and state management system for React client-side caching, request deduplication, prefix-based invalidation, and mutation tracking.
- **`useSSE` Hook**: Introduced a reactive Server-Sent Events hook supporting accumulated message history, history size trimming (`maxHistory`), automatic reconnection on network restore, and abort signal synchronization.
- **`useSuspenseQuery` Hook**: Added a React Suspense-compatible query hook for streamlined data loading layouts.
- **`useIsMutating` Hook**: Added support for global/filtered progress indicators of active mutations.
- **Client-Only exports (`./client/*`)**: Added wildcard exports for `@explita/actyx-rpc/client/sse` and `@explita/actyx-rpc/client/ws` to reduce client bundle overhead and resolve `fs`/Node dependency errors in Next.js Turbopack builds.
- **Expanded Hook Features**: Upgraded core hooks (`useQuery`, `useMutation`, `useInfiniteQuery`, and `usePaginatedQuery`) with support for caching options: `staleTime`, `gcTime`, `refetchOnMount`, `refetchOnWindowFocus`, and `refetchOnReconnect`.
- **QueryClient Unit Tests**: Added a comprehensive unit test suite to test caching, subscriptions, prefix-based invalidations, and active mutation counts.

### Changed

- **Mock Tests**: Simplified mock tests to align with single-function mocking (`ACTYX_MOCK = "true"`).
- **Inter-Call Tests**: Refactored tests to use direct procedure calls (`proc(...)`) to align with AsyncLocalStorage context inheritance, removing legacy `ctx.call` usage.

## [0.3.1] - 2026-05-14

### Added

- **`InferContext` Utility**: Added a new helper type to extract the fully enriched and prettified context from any procedure instance.

### Changed

- **Query Key Formatting**: Updated `useQuery` to use `|` as the default separator for complex query keys (previously `:`). This improves compatibility with certain backend caching systems and prevents collision with common ID patterns.

## [0.3.0] - 2026-05-12

### Added

- **Automatic Context Inheritance**: Introduced `AsyncLocalStorage` to support direct procedure calls. Child procedures now automatically inherit the execution context from their parent, skipping redundant context creation.
- **Nested Call Metrics**: The `observabilityPlugin` now uses a stack-based approach to accurately track durations for nested procedure calls.
- **Unified Progress Tracking**: Centralized progress tracking logic to URL-based mutations, enabling consistent real-time updates across different adapter environments.

### Changed (Breaking Changes)

- **WebSocket Adapter Signature**: The `applyWSHandler` signature has changed from an options object to `(procedure, options)`. The procedure must now be pre-bound (e.g., `applyWSHandler(onRoomEvent({ roomId }), { ws })`).
- **Subscription Status**: The `status` returned by `useSubscription` has been renamed from `subscribed` to `connected` to better reflect the connection state.
- **Procedure Composition**: Removed `ctx.call()` in favor of calling procedures directly as regular functions. Context is now handled implicitly via `AsyncLocalStorage`.

### Fixed

- **Next.js Proxy Handling**: Improved `nextAdapter` logic to better handle `pathname` and `searchParams` injection for proxied requests.
- **Documentation Cleanup**: Synchronized the Table of Contents in `README.md` and updated all examples to the new v0.3 patterns.

## [0.2.0] - 2026-05-05

### Added

- **Exported Types**: The `ErrorResponse` type is now exported from the main entry point.

### Changed (Breaking Paths)

- **Resolver Import Paths**: The schema resolver import paths have been pluralized. You must now import from `@explita/actyx-rpc/resolvers/*` instead of `@explita/actyx-rpc/resolver/*`.

### Fixed

- **Client Component Serialization**: The `_redirect` function is now explicitly stripped from all error responses before returning to the client, preventing Next.js "cannot pass functions to client component" serialization errors.
- **Dependency Cleanup**: Moved `tsx` from `dependencies` to `devDependencies`.
- **Validation Messages**: Standardized the default middleware validation error message from "Middleware validation failed" to "Validation failed".

## [0.1.3] - 2026-05-03

### Added

- **Server-Sent Events (SSE)**: First-class support for streaming responses via the new `.sse()` procedure method. Includes a dedicated client utility for effortless consumption.
- **Next.js Integration**: Introduced `nextAdapter()` (`adapters/next`) to seamlessly bind your Actyx router to Next.js App Router API routes.
- **Automated OpenAPI Documentation**: Added `generateOpenApi()` to dynamically create OpenAPI (Swagger) specs from your router. Procedures can now be enriched with `.summary()`, `.description()`, and `.output()`.
- **Runtime Output Contracts**: The `.output()` method enforces End-to-End type safety for client responses and provides runtime data sanitization by acting as a strict whitelist before transmission.

## [0.1.2] - 2026-04-26

### Added

- **Strict Handler Naming**: The `.name("...")` method now strictly types `ctx.handlerName` in your query and mutation handlers (and hooks) as the exact string literal provided, rather than a generic `string`.
- **Merged Metadata inheritance**: Calling `.extend` or `.meta` now correctly deeply merges and persists metadata types across the entire lifecycle (including `createContext`, `enrichInput`, `onError`, `middlewares`, and `plugins`).
- **Client Abort Fallbacks**: The React `useMutation` hook now gracefully yields an error with `statusCode: 499` and `handlerName: "client"` when a request is aborted on the frontend.
- **Reusable Middleware Generics**: Added `ExpectedInput` generic to `.middleware()` and `.plugin()` factories, allowing you to explicitly type the input shape your reusable logic depends on.
- **Standardized Builder Ordering**: Enforced a strict sequence where all context and input setup (`.use`, `.input`, `.meta`, `.name`, `.extend`) must happen _before_ configuring execution policies (`.cache`, `.retry`, `.rateLimit`, etc.). This ensures configuration hooks always have access to the fully enriched context and validated input types.

### Changed (Breaking Types)

- **Strict Error Signatures**: `BaseError` now strictly requires `handlerName` and `statusCode` fields (they are no longer optional).
- **Core Generics**: `ProcedureInstance`, `ProcedureProps`, `ProcedureExtensionConfig`, and `BaseContext` now accept additional generics (`TName`, `TNextMeta`, `TTotalMeta`) to enable stricter type persistence. Custom type helpers depending on the old signatures will need to be updated.

## [0.1.1] - 2026-04-23

### Added

- **Top-level Redirects**: Support for `_redirect` callback in error responses, enabling seamless framework redirects (e.g. Next.js `redirect()`) from within procedures.
- **Metadata System**: New `.meta()` method for attaching arbitrary, type-safe data to procedures, accessible via `ctx.meta`.
- **Enhanced Hooks**: `onSuccess` now receives the original `args` passed to the procedure, aiding in detailed audit logging.
- **New `patch` Input Mode**: Added `patch` to `InputMode` for partial object shapes with strictly typed keys.

### Changed

- **Default Input Mode**: The default `InputMode` has been changed from `form` to `strict` for better out-of-the-box type safety.

### Fixed

- **Logging Refinement**: Procedure error stack traces are now suppressed in production (`NODE_ENV === "production"`) while remaining fully visible in development.
- **Type safety**: Improved `onContextError` signature to include the `ctx` object for better error mapping.

## [0.1.0] - 2026-04-23

### Added

- **Architectural Foundation**
  - **Type-Safe Builder**: A fluent API for creating procedures with inferred input/output types.
  - **Contextual Chaining**: Full context inheritance across middlewares and procedure extensions.
  - **Universal Resolvers**: Native support for **Zod**, **Valibot**, **ArkType**, and **Standard Schema** with `strict`/`partial`/`form` input modes.
  - **Dual Response Pattern**: Standardized `[data, error]` tuple for predictable, crash-free error handling.
- **Resilience Cube (Fault Tolerance)**
  - **Smart Retries**: Linear and Exponential backoff strategies with `retry.if` conditional logic.
  - **Proactive Timeouts**: Integrated execution time limits to prevent resource hanging.
  - **Circuit Breaker**: Industrial-grade service protection with `CLOSED`, `OPEN`, and `HALF_OPEN` auto-recovery states.
- **Infrastructure & Caching**
  - **Hybrid Adapters**: Out-of-the-box support for **Memory** and **Redis** caching.
  - **Smart Invalidation**: Mutation-triggered cache clearing via **Tags**, **Patterns**, or specific **Keys**.
  - **Dynamic Rate Limiting**: Abuse prevention with sliding-window support and custom key generation.
- **Enterprise Observability**
  - **Native OpenTelemetry**: Deep instrumentation for procedure lifecycle monitoring.
  - **Zero-Dependency Fallback**: Transparently degrades to no-op spans if OTel dependencies are absent.
  - **Audit Trails**: Built-in `onSuccess` and `onError` lifecycle hooks for custom logging and metrics.
