# Changelog

All notable changes to this package will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
