# Changelog

All notable changes to this package will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

