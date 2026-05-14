# Changelog

All notable changes to this package will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
