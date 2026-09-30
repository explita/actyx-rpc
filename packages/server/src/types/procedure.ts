import type {
  CacheAdapter,
  CacheConfig,
  CacheInvalidationConfig,
  CacheInvalidationOptions,
  RateLimitConfig,
  RateLimitOptions,
  WithCacheOptions,
} from "../core/cache/types.js";
import type {
  CircuitBreakerConfig,
  CircuitBreakerOptions,
} from "../core/circuit-breaker/types.js";
import { Compressor } from "../core/compression/compressor.js";
import type {
  CompressionOptions,
  CompressorConfig,
} from "../core/compression/types.js";
import type { RetryConfig, RetryOptions } from "../core/retry/types.js";
import type { TimeoutConfig, TimeoutOptions } from "../core/timeout/types.js";
import type { Middleware, Plugin } from "./middleware.js";
import type {
  BaseContext,
  ContextResult,
  ErrorResponse,
  ExtraCtx,
  FailureReason,
  InputCtx,
  InputMode,
  InputParams,
  MaybePromise,
  MergeMeta,
  MutationResult,
  PlusMeta,
  Prettify,
  QueryResult,
  SchemaResolver,
  SchemaOrStandard,
  InferSchemaOutput,
  SSEEvent,
} from "./misc.js";

export interface ProcedureDefinition<
  TType extends string = string,
  TInput = any,
  TOutput = any,
  TArgs extends unknown[] = [],
> {
  _def: {
    type: TType;
    input: TInput;
    output: TOutput;
    args: TArgs;
  };
}

export type ProcedureConfig<
  TCtx,
  TEnrich,
  TMeta extends Record<string, any> = {},
> = {
  name: string;
  type?:
    | "mutation"
    | "query"
    | "webRoute"
    | "stream"
    | "sse"
    | "ws"
    | "subscription";
  resolver?: SchemaResolver<any>;
  outputResolver?: SchemaResolver<any>;
  middlewares?: Middleware<TCtx, TEnrich, any, any, TMeta>[];
  plugins?: Plugin<TCtx, TEnrich, any, any, TMeta>[];
  cache?: CacheConfig;
  invalidate?: CacheInvalidationConfig;
  retry?: RetryConfig;
  timeout?: TimeoutConfig;
  circuitBreaker?: CircuitBreakerConfig & { state?: any };
  compression?: CompressorConfig;
  rateLimit?: RateLimitConfig;
  telemetry?: boolean;
  meta?: TMeta;
  authorize?: (
    ctx: MergeMeta<TCtx, BaseContext<TMeta>>,
    req: Request,
    context: any,
  ) => MaybePromise<boolean | Partial<ErrorResponse>>;
  mock?: (
    opts: {
      ctx: MergeMeta<TCtx, BaseContext<TMeta>>;
      input: TEnrich;
    },
    req: Request,
    context: any,
  ) => unknown;
  summary?: string;
  description?: string;
  validationHint?: string;
};

/**
 * Represents a fluid RPC procedure builder instance.
 *
 * Provides a chainable API to configure procedure metadata, input/output validation,
 * authorization guards, resilience policies (caching, retries, rate limiting, circuit breaker,
 * timeouts, compression), middlewares, and terminal endpoints (`query`, `mutation`,
 * `stream`, `sse`, `webRoute`, `ws`).
 *
 * @template Ctx - The accumulated context type available to handlers, middlewares, and guards.
 * @template TEnrich - The enriched input data injected into procedure inputs.
 * @template TMeta - Custom metadata record attached to this procedure.
 * @template I - The schema-validated input payload type (defaults to `void` if no schema is configured).
 * @template ICtx - Input context parsing options.
 * @template GIM - The global or effective input mode (`strict`, `form`, `patch`, etc.).
 * @template TName - The assigned name of this procedure.
 * @template TMocked - Whether this procedure is currently configured in mock mode.
 */
export interface ProcedureInstance<
  Ctx,
  TEnrich,
  TMeta extends Record<string, any>,
  I = void,
  ICtx extends InputCtx = InputCtx,
  GIM extends InputMode = InputMode, //Global Input Mode
  TName extends string = string,
  TMocked extends boolean = false,
> {
  // Configurable meta data

  /**
   * Sets a unique, human-readable name for this procedure.
   *
   * Used in OpenAPI route generation, distributed tracing, metrics, and structured logs.
   * Once assigned, the name cannot be reassigned on the returned builder.
   *
   * @param name - The unique procedure identifier.
   * @returns A new procedure instance with the assigned name.
   *
   * @example
   * ```ts
   * const getUser = procedure
   *   .name("users.getById")
   *   .query(async ({ input }) => { ... });
   * ```
   */
  name: <NextName extends string>(
    name: NextName,
  ) => Omit<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, NextName, TMocked>,
    "extend" | "name"
  >;

  /**
   * Attaches custom type-safe metadata to this procedure.
   *
   * Metadata is merged with existing metadata and can be inspected in middlewares,
   * plugins, error handlers, and authorization guards via `ctx.meta`.
   *
   * @param meta - An object containing metadata properties to merge.
   * @returns A new procedure instance with the merged metadata type.
   *
   * @example
   * ```ts
   * const adminOnly = procedure
   *   .meta({ roles: ["admin"], audit: true });
   * ```
   */
  meta: <NextMeta extends Record<string, any>>(
    meta: NextMeta,
  ) => Omit<
    ProcedureInstance<
      Prettify<Ctx>,
      TEnrich,
      Prettify<TMeta & NextMeta>,
      I,
      ICtx,
      GIM,
      TName,
      TMocked
    >,
    "extend" | "meta"
  >;

  /**
   * Sets a short, one-line summary for OpenAPI documentation and interactive API explorers.
   *
   * @param text - The concise summary string.
   * @returns A new procedure instance without the `summary` method.
   *
   * @example
   * ```ts
   * procedure.summary("Fetch active user profile");
   * ```
   */
  summary: (
    text: string,
  ) => Omit<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    "summary"
  >;

  /**
   * Sets a detailed, markdown-compatible description for OpenAPI documentation and developer tooling.
   *
   * @param text - Detailed documentation describing endpoint behavior, parameters, and side-effects.
   * @returns A new procedure instance without the `description` or `summary` methods.
   *
   * @example
   * ```ts
   * procedure.description("Returns full user details including permissions and workspace memberships.");
   * ```
   */
  description: (
    text: string,
  ) => Omit<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    "description" | "summary"
  >;

  /**
   * Attaches an output validation and serialization schema using any supported validator
   * (Zod, Valibot, ArkType, or Standard Schema).
   *
   * Validates the return value at runtime and exposes response schemas to OpenAPI documentation
   * and generated client typings.
   *
   * @param resolver - The schema resolver defining the expected return shape.
   * @returns A new procedure instance configured with output validation.
   *
   * @example
   * ```ts
   * procedure
   *   .output(z.object({ id: z.string(), name: z.string() }))
   *   .query(async () => { ... });
   * ```
   */
  output: <S extends SchemaOrStandard<Record<string, any>>>(
    resolver: S,
  ) => Omit<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    "output" | "description" | "summary"
  >;

  // Validation

  /**
   * Defines the input validation schema and optional input parsing configuration.
   *
   * Incoming request payloads (JSON body, query params, or form data) are parsed and validated
   * against this schema before invoking middlewares or terminal handlers.
   *
   * @param resolver - A schema or Standard Schema validating the input object shape.
   * @param options - Optional input context settings such as mode (`strict`, `form`, `patch`, `partial`) or custom error mappers.
   * @returns A new procedure instance strongly typed with the validated input schema.
   *
   * @example
   * ```ts
   * procedure
   *   .input(z.object({ id: z.string() }))
   *   .query(async ({ input }) => {
   *     return db.users.find(input.id);
   *   });
   * ```
   */
  input: <
    S extends SchemaOrStandard<Record<string, any>>,
    NextICtx extends InputCtx,
  >(
    resolver: S,
    options?: NextICtx,
  ) => Omit<
    ProcedureInstance<
      Ctx,
      TEnrich,
      TMeta,
      InferSchemaOutput<S>,
      NextICtx,
      GIM,
      TName,
      TMocked
    >,
    "input" | "extend" | "middleware" | "plugin" | "name" | "meta"
  >;

  /**
   * Configures cache tags or query keys to invalidate when this mutation or web route finishes successfully.
   *
   * Automatically clears cached responses across the distributed or local cache store.
   *
   * @param options - Invalidation options specifying static keys, tags, or dynamic evaluator callbacks.
   * @returns A restricted procedure builder exposing only mutation or webRoute terminals.
   *
   * @example
   * ```ts
   * procedure
   *   .invalidate({ tags: ["users", "posts"] })
   *   .mutation(async () => { ... });
   * ```
   */
  invalidate: (
    options: CacheInvalidationOptions<
      Prettify<MergeMeta<Ctx, BaseContext<TMeta, TName>>>,
      [I] extends [void] ? TEnrich : Prettify<TEnrich & I>
    >,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    "mutation" | "webRoute"
  >;

  // Authorization

  /**
   * Registers an authorization guard that executes before input validation and handler execution.
   *
   * Receives the request context, HTTP Request, and runtime context. Return `true` to allow,
   * `false` to deny with a 403 Forbidden error, or an error object to return a custom response.
   *
   * @param checker - Authorization callback function.
   * @returns A new procedure instance with authorization configured.
   *
   * @example
   * ```ts
   * procedure
   *   .authorize(({ ctx }) => ctx.user != null)
   *   .query(async ({ ctx }) => { ... });
   * ```
   */
  authorize: (
    checker: (
      ctx: MergeMeta<Ctx, BaseContext<TMeta, TName>>,
      req: Request,
      context: any,
    ) => MaybePromise<boolean | Partial<ErrorResponse>>,
  ) => Omit<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    "input" | "extend" | "middleware" | "plugin" | "name" | "meta" | "authorize"
  >;

  // Resilience

  /**
   * Protects the procedure with a Circuit Breaker pattern.
   *
   * Prevents cascading failures by fast-failing calls when downstream services or databases
   * fail repeatedly, allowing them time to recover before resuming normal operation.
   *
   * @param options - Circuit breaker configuration (failure threshold, reset timeout, half-open probes).
   * @returns A procedure builder constrained to executable endpoints and chained resilience options.
   *
   * @example
   * ```ts
   * procedure
   *   .circuitBreaker({ failureThreshold: 5, resetTimeout: 30_000 })
   *   .query(async () => { ... });
   * ```
   */
  circuitBreaker: (
    options?: CircuitBreakerOptions,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    | "query"
    | "mutation"
    | "webRoute"
    | "cache"
    | "invalidate"
    | "retry"
    | "timeout"
    | "compress"
    | "rateLimit"
    | "telemetry"
    | "authorize"
    | "mock"
    | "stream"
    | "output"
  >;

  /**
   * Configures response caching for this procedure.
   *
   * Caches successful execution results using the configured cache adapter with support for TTL,
   * custom cache key generators, tags, and stale-while-revalidate.
   *
   * @param options - Cache options including `ttl`, `tags`, `key`, and caching conditions.
   * @returns A procedure builder configured with caching.
   *
   * @example
   * ```ts
   * procedure
   *   .cache({ ttl: 60, tags: ["feed"] })
   *   .query(async () => { ... });
   * ```
   */
  cache: (
    options: WithCacheOptions<
      Prettify<MergeMeta<Ctx, BaseContext<TMeta, TName>>>,
      [I] extends [void | undefined] ? TEnrich : Prettify<TEnrich & I>
    >,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    | "query"
    | "mutation"
    | "webRoute"
    | "invalidate"
    | "retry"
    | "timeout"
    | "compress"
    | "rateLimit"
    | "circuitBreaker"
    | "telemetry"
    | "authorize"
    | "mock"
    | "stream"
    | "output"
  >;

  /**
   * Configures automatic retry behavior for transient failures.
   *
   * Retries failed executions using configurable attempts, exponential backoff delays,
   * jitter, and conditional retry filters.
   *
   * @param options - Retry configuration (attempts, backoff strategy, retry condition).
   * @returns A procedure builder configured with retry resilience.
   *
   * @example
   * ```ts
   * procedure
   *   .retry({ attempts: 3, backoff: "exponential", delay: 1000 })
   *   .query(async () => { ... });
   * ```
   */
  retry: (
    options?: RetryOptions,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    | "query"
    | "mutation"
    | "webRoute"
    | "cache"
    | "invalidate"
    | "timeout"
    | "compress"
    | "rateLimit"
    | "circuitBreaker"
    | "telemetry"
    | "authorize"
    | "mock"
    | "stream"
    | "output"
  >;

  /**
   * Enforces a maximum execution duration before aborting the procedure.
   *
   * If the handler does not finish within the specified timeout duration, execution is cancelled
   * and a timeout error is returned.
   *
   * @param options - Timeout configuration specifying duration in milliseconds and error message.
   * @returns A procedure builder configured with execution timeout.
   *
   * @example
   * ```ts
   * procedure
   *   .timeout({ ms: 5000 })
   *   .query(async () => { ... });
   * ```
   */
  timeout: (
    options?: TimeoutOptions,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    | "query"
    | "webRoute"
    | "cache"
    | "invalidate"
    | "retry"
    | "compress"
    | "rateLimit"
    | "circuitBreaker"
    | "telemetry"
    | "authorize"
    | "mock"
    | "stream"
    | "output"
  >;

  /**
   * Configures response payload compression (e.g. gzip, brotli, deflate).
   *
   * Responses exceeding the threshold size are automatically compressed if the client
   * sends compatible `Accept-Encoding` headers.
   *
   * @param options - Compression settings including preferred algorithms and minimum byte threshold.
   * @returns A procedure builder configured with response compression.
   *
   * @example
   * ```ts
   * procedure
   *   .compress({ threshold: 1024 })
   *   .query(async () => { ... });
   * ```
   */
  compress: (
    options?: CompressionOptions,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    | "query"
    | "mutation"
    | "webRoute"
    | "cache"
    | "invalidate"
    | "retry"
    | "timeout"
    | "rateLimit"
    | "circuitBreaker"
    | "telemetry"
    | "authorize"
    | "mock"
    | "stream"
    | "output"
  >;

  /**
   * Configures rate limiting to protect this procedure against abuse or excessive requests.
   *
   * Tracks requests within sliding or fixed time windows partitioned by IP address, authenticated user ID,
   * or a custom key generator.
   *
   * @param options - Rate limit rules (limit, window, custom key extractor, rejection behavior).
   * @returns A procedure builder configured with rate limiting.
   *
   * @example
   * ```ts
   * procedure
   *   .rateLimit({ limit: 100, window: "1m" })
   *   .mutation(async () => { ... });
   * ```
   */
  rateLimit: (
    options?: RateLimitOptions<Ctx, I, TMeta, TName>,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    | "query"
    | "mutation"
    | "webRoute"
    | "cache"
    | "invalidate"
    | "retry"
    | "timeout"
    | "compress"
    | "circuitBreaker"
    | "telemetry"
    | "authorize"
    | "mock"
    | "stream"
    | "output"
  >;

  // Mocking

  /**
   * Defines a mock implementation for testing, prototyping, or local preview environments.
   *
   * When mocking is active (or when `ACTYX_MOCK` is enabled), this mock handler is executed
   * instead of the terminal handler, and input parameters become optional.
   *
   * @param handler - Mock callback returning synthetic response data.
   * @returns A procedure builder flagged as mocked (`TMocked = true`).
   *
   * @example
   * ```ts
   * procedure
   *   .mock(async () => [{ id: "1", name: "Mock User" }])
   *   .query(async () => { ... });
   * ```
   */
  mock: <T = unknown>(
    handler: (
      opts: {
        ctx: MergeMeta<Ctx, BaseContext<TMeta, TName>>;
        input: [I] extends [void | undefined] ? TEnrich : Prettify<I & TEnrich>;
      },
      req: Request,
      context: any,
    ) => MaybePromise<T>,
  ) => Omit<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, true>,
    | "input"
    | "extend"
    | "middleware"
    | "plugin"
    | "name"
    | "meta"
    | "mock"
    | "ws"
  >;

  // Telemetry

  /**
   * Enables OpenTelemetry tracing, span creation, and metric tracking for this procedure.
   *
   * Automatically records request duration, status, and contextual attributes to connected
   * observability exporters.
   *
   * @returns A procedure builder configured with telemetry tracking.
   *
   * @example
   * ```ts
   * procedure
   *   .telemetry()
   *   .query(async () => { ... });
   * ```
   */
  telemetry: () => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    | "query"
    | "mutation"
    | "webRoute"
    | "cache"
    | "invalidate"
    | "retry"
    | "timeout"
    | "compress"
    | "rateLimit"
    | "circuitBreaker"
    | "authorize"
    | "mock"
    | "stream"
    | "output"
  >;

  // Middleware/Plugins

  /**
   * Attaches a middleware or plugin to the procedure pipeline.
   *
   * Middlewares can intercept execution, perform validation, run pre/post logic,
   * and extend or overwrite the procedure's context.
   *
   * @param mw - The middleware or plugin instance.
   * @returns A new procedure instance with the extended context type.
   *
   * @example
   * ```ts
   * const withAuth = procedure.use(async ({ ctx, next }) => {
   *   const user = await verifyToken(ctx.token);
   *   return next({ ctx: { user } });
   * });
   * ```
   */
  use: (<NextCtx = Ctx>(
    mw: Middleware<
      Ctx,
      TEnrich,
      [I] extends [void | undefined] ? TEnrich : Prettify<I & TEnrich>,
      NextCtx,
      TMeta,
      TName
    >,
  ) => Omit<
    ProcedureInstance<
      Prettify<Ctx & NextCtx>,
      TEnrich,
      TMeta,
      I,
      ICtx,
      GIM,
      TName,
      TMocked
    >,
    "input" | "extend" | "middleware" | "plugin" | "name" | "meta"
  >) &
    (<NextCtx = Ctx>(
      plugin: Plugin<
        Ctx,
        TEnrich,
        [I] extends [void | undefined] ? TEnrich : Prettify<I & TEnrich>,
        NextCtx,
        TMeta,
        TName
      >,
    ) => Omit<
      ProcedureInstance<
        Prettify<Ctx & NextCtx>,
        TEnrich,
        TMeta,
        I,
        ICtx,
        GIM,
        TName,
        TMocked
      >,
      "input" | "extend" | "middleware" | "plugin" | "name" | "meta"
    >);

  /**
   * Declare a reusable middleware.
   *
   * - `middleware(mw)` infers `NextCtx` from `mw`'s return type.
   * - `middleware<ExpectedInput>()(mw)` additionally constrains `input` to
   *   `ExpectedInput`. The extra `()` is required because TypeScript cannot
   *   infer a trailing type parameter (`NextCtx`) while an earlier one
   *   (`ExpectedInput`) is supplied explicitly — the `()` defers `NextCtx`
   *   inference to the inner call.
   */
  middleware: {
    <NextCtx = Ctx>(
      mw: Middleware<
        Ctx,
        TEnrich,
        [I] extends [void | undefined] ? TEnrich : Prettify<I & TEnrich>,
        Prettify<NextCtx>,
        TMeta,
        TName
      >,
    ): typeof mw;
    <ExpectedInput = unknown>(
      ...args: []
    ): <NextCtx = Ctx>(
      mw: Middleware<
        Ctx,
        TEnrich,
        [I] extends [void | undefined]
          ? Prettify<ExpectedInput & TEnrich>
          : Prettify<I & TEnrich>,
        Prettify<NextCtx>,
        TMeta,
        TName
      >,
    ) => typeof mw;
  };

  /**
   * Declare a reusable plugin.
   *
   * - `plugin(p)` infers `NextCtx` from `p`'s return type.
   * - `plugin<ExpectedInput>()(p)` additionally constrains `input` to
   *   `ExpectedInput`. The extra `()` defers `NextCtx` inference to the inner call.
   */
  plugin: {
    <NextCtx = Ctx>(
      plugin: Plugin<
        Ctx,
        TEnrich,
        [I] extends [void | undefined] ? TEnrich : Prettify<I & TEnrich>,
        NextCtx,
        TMeta,
        TName
      >,
    ): typeof plugin;
    <ExpectedInput = unknown>(
      ...args: []
    ): <NextCtx = Ctx>(
      plugin: Plugin<
        Ctx,
        TEnrich,
        [I] extends [void | undefined]
          ? Prettify<ExpectedInput & TEnrich>
          : Prettify<I & TEnrich>,
        NextCtx,
        TMeta,
        TName
      >,
    ) => typeof plugin;
  };

  // Terminals

  /**
   * Terminal method defining a state-modifying RPC procedure (POST).
   *
   * Executes the handler inside the configured middleware and resilience pipeline.
   * Returns a callable asynchronous function that resolves to a `MutationResult<T>` tuple `[data, error]`.
   *
   * @template T - The return data type.
   * @template P - Additional arguments passed to the procedure call.
   * @param handler - The mutation implementation function receiving context and input.
   * @returns A callable procedure returning a `Promise<MutationResult<T>>`.
   *
   * @example
   * ```ts
   * const createUser = procedure
   *   .input(z.object({ name: z.string() }))
   *   .mutation(async ({ input, ctx }) => {
   *     return db.users.create({ data: input });
   *   });
   *
   * const [user, error] = await createUser({ name: "Alice" });
   * ```
   */
  mutation: <T, P extends unknown[]>(
    handler: (
      opts: {
        ctx: Prettify<
          MergeMeta<Ctx, BaseContext<TMeta, TName>> &
            ExtraCtx<
              MergeMeta<Ctx, BaseContext<TMeta, TName>>,
              [I] extends [void] ? TEnrich : Prettify<I & TEnrich>
            >
        >;
        input: [I] extends [void | undefined] ? TEnrich : Prettify<I & TEnrich>;
      },
      ...args: P
    ) => T,
  ) => [I] extends [void | undefined]
    ? // No input - just pass through args
      (...args: P) => Promise<MutationResult<Awaited<T>, undefined, P>>
    : // Has input - first arg is input, then optional args
      [TMocked] extends [true]
      ? (
          input?: InputParams<I, ICtx, GIM>,
          ...args: P
        ) => Promise<MutationResult<Awaited<T>, InputParams<I, ICtx, GIM>, P>>
      : (
          input: InputParams<I, ICtx, GIM>,
          ...args: P
        ) => Promise<MutationResult<Awaited<T>, InputParams<I, ICtx, GIM>, P>>;

  /**
   * Terminal method defining an idempotent, read-only RPC procedure (GET/POST).
   *
   * Executes within the middleware pipeline and serves responses from cache when caching is enabled.
   * Returns a callable asynchronous function that resolves to a `QueryResult<T>` tuple `[data, error]`.
   *
   * @template T - The return data type.
   * @template P - Additional arguments passed to the procedure call.
   * @param handler - The query implementation function receiving context and input.
   * @returns A callable procedure returning a `Promise<QueryResult<T>>`.
   *
   * @example
   * ```ts
   * const getUser = procedure
   *   .input(z.object({ id: z.string() }))
   *   .query(async ({ input, ctx }) => {
   *     return db.users.findUnique({ where: { id: input.id } });
   *   });
   *
   * const [user, error] = await getUser({ id: "123" });
   * ```
   */
  query: <T, P extends unknown[]>(
    handler: (
      opts: {
        ctx: Prettify<
          MergeMeta<Ctx, BaseContext<TMeta, TName>> &
            ExtraCtx<
              MergeMeta<Ctx, BaseContext<TMeta, TName>>,
              [I] extends [void | undefined] ? TEnrich : Prettify<I & TEnrich>
            >
        >;
        input: [I] extends [void | undefined] ? TEnrich : Prettify<I & TEnrich>;
      },
      ...args: P
    ) => T,
  ) => [I] extends [void | undefined]
    ? // No input - just pass through args
      (...args: P) => Promise<QueryResult<Awaited<T>, undefined, P>>
    : // Has input - first arg is input, then optional args
      [TMocked] extends [true]
      ? (
          input?: InputParams<I, ICtx, GIM>,
          ...args: P
        ) => Promise<QueryResult<Awaited<T>, InputParams<I, ICtx, GIM>, P>>
      : (
          input: InputParams<I, ICtx, GIM>,
          ...args: P
        ) => Promise<QueryResult<Awaited<T>, InputParams<I, ICtx, GIM>, P>>;

  /**
   * Terminal method defining a chunked streaming procedure.
   *
   * Streams items incrementally over HTTP chunked transfer encoding as an `AsyncIterable<T>`.
   *
   * @template T - The chunk item type emitted by the stream.
   * @template P - Additional arguments passed to the procedure call.
   * @param handler - Generator or async generator yielding chunks to the client.
   * @returns An async iterable yielding chunks.
   *
   * @example
   * ```ts
   * const streamLogs = procedure
   *   .stream(async function* ({ ctx }) {
   *     for await (const log of logSubscription()) {
   *       yield log;
   *     }
   *   });
   * ```
   */
  stream: <T, P extends unknown[]>(
    handler: (
      opts: {
        ctx: Prettify<
          MergeMeta<Ctx, BaseContext<TMeta, TName>> &
            ExtraCtx<
              MergeMeta<Ctx, BaseContext<TMeta, TName>>,
              [I] extends [void | undefined] ? TEnrich : Prettify<I & TEnrich>
            >
        >;
        input: [I] extends [void | undefined] ? TEnrich : Prettify<I & TEnrich>;
      },
      ...args: P
    ) => AsyncIterable<T> | Iterable<T>,
  ) => [I] extends [void | undefined]
    ? (...args: P) => AsyncIterable<T>
    : [TMocked] extends [true]
      ? (input?: InputParams<I, ICtx, GIM>, ...args: P) => AsyncIterable<T>
      : (input: InputParams<I, ICtx, GIM>, ...args: P) => AsyncIterable<T>;

  /**
   * Terminal method defining a Server-Sent Events (SSE) stream endpoint.
   *
   * Produces structured SSE events with automatic framing (`id`, `event`, `data`, `retry`)
   * and provides a `.close()` method to terminate the stream.
   *
   * @template O - The event data payload type.
   * @template P - Additional arguments passed to the procedure call.
   * @param handler - Generator or async generator yielding `SSEEvent<O>` objects.
   * @returns An async iterable representing the SSE stream with a `.close()` method.
   *
   * @example
   * ```ts
   * const liveTicker = procedure
   *   .sse(async function* () {
   *     while (true) {
   *       yield { event: "tick", data: { time: Date.now() } };
   *       await sleep(1000);
   *     }
   *   });
   * ```
   */
  sse: <O = any, P extends unknown[] = []>(
    handler: (
      opts: {
        ctx: Prettify<
          MergeMeta<Ctx, BaseContext<TMeta, TName>> &
            ExtraCtx<
              MergeMeta<Ctx, BaseContext<TMeta, TName>>,
              [I] extends [void | undefined] ? TEnrich : Prettify<I & TEnrich>
            >
        >;
        input: [I] extends [void | undefined] ? TEnrich : Prettify<I & TEnrich>;
      },
      ...args: P
    ) => AsyncIterable<SSEEvent<O>> | Iterable<SSEEvent<O>>,
  ) => [I] extends [void | undefined]
    ? // No input - just pass through args
      (
        ...args: P
      ) => AsyncIterable<SSEEvent<O, undefined>> & { close: () => void }
    : // Has input - first arg is input, then optional args
      [TMocked] extends [true]
      ? (
          input?: InputParams<I, ICtx, GIM>,
          ...args: P
        ) => AsyncIterable<SSEEvent<O, InputParams<I, ICtx, GIM>>> & {
          close: () => void;
        }
      : (
          input: InputParams<I, ICtx, GIM>,
          ...args: P
        ) => AsyncIterable<SSEEvent<O, InputParams<I, ICtx, GIM>>> & {
          close: () => void;
        };

  /**
   * Terminal method exposing the procedure as a standard Web Fetch API route handler.
   *
   * Compatible with Next.js App Router route handlers (`export const GET = ...`), Hono, Remix,
   * Bun, and Cloudflare Workers. Automatically converts returns to HTTP `Response` objects.
   *
   * @template T - The response body type or raw `Response`.
   * @param handler - Route handler receiving context, input, Web `Request`, and route options.
   * @returns A standard Web API `(req: Request, options: any) => Promise<Response>` handler.
   *
   * @example
   * ```ts
   * // app/api/webhook/route.ts
   * export const POST = procedure
   *   .webRoute(async ({ req, ctx }) => {
   *     return Response.json({ received: true });
   *   });
   * ```
   */
  webRoute: <T>(
    handler: (
      opts: {
        ctx: Prettify<
          MergeMeta<Ctx, BaseContext<TMeta, TName>> &
            ExtraCtx<
              MergeMeta<Ctx, BaseContext<TMeta, TName>>,
              [I] extends [void | undefined] ? TEnrich : Prettify<I & TEnrich>
            >
        >;
        input: [I] extends [void | undefined] ? TEnrich : Prettify<I & TEnrich>;
      },
      req: Request,
      options: any,
    ) => MaybePromise<T>,
  ) => (req: Request, options: any) => Promise<Response>;

  /**
   * Terminal method defining a WebSocket connection handler.
   *
   * Exposes real-time communication primitives (`send`, `broadcast`, `onMessage`, `onClose`, `onError`)
   * bound to the procedure's context.
   *
   * @template P - Additional arguments passed to the WebSocket initiator.
   * @param handler - WebSocket connection callback managing event listeners and outgoing messages.
   * @returns A function that mounts or initializes the WebSocket connection.
   *
   * @example
   * ```ts
   * const chatWs = procedure
   *   .ws(async ({ ctx, send, broadcast, onMessage }) => {
   *     send({ message: "Welcome to chat!" });
   *     onMessage((data) => broadcast(data));
   *   });
   * ```
   */
  ws: <P extends unknown[] = []>(
    handler: (
      opts: {
        ctx: Prettify<
          MergeMeta<Ctx, BaseContext<TMeta, TName>> &
            ExtraCtx<
              MergeMeta<Ctx, BaseContext<TMeta, TName>>,
              [I] extends [void | undefined] ? TEnrich : Prettify<I & TEnrich>
            >
        >;
        input: [I] extends [void | undefined] ? TEnrich : Prettify<I & TEnrich>;
        send: <T = any>(data: T) => void;
        broadcast: <T = any>(data: T) => void;
        onMessage: <T = any>(cb: (data: T) => void) => void;
        onClose: (cb: (evt: CloseEvent) => void) => void;
        onError: (cb: (err: Event) => void) => void;
      },
      ...args: P
    ) => MaybePromise<void>,
  ) => [I] extends [void | undefined]
    ? (...args: P) => (wsContext: any) => Promise<void>
    : [TMocked] extends [true]
      ? (
          input?: InputParams<I, ICtx, GIM>,
          ...args: P
        ) => (wsContext: any) => Promise<void>
      : (
          input: InputParams<I, ICtx, GIM>,
          ...args: P
        ) => (wsContext: any) => Promise<void>;

  // Extend

  /**
   * Creates a new procedure builder by extending the current configuration.
   *
   * Allows sub-routers and procedures to inherit and extend existing context, input enrichment,
   * metadata, and middlewares while adding new context fields or overrides.
   *
   * @template NextCtx - Extended context type produced by the extension.
   * @template NextEnrich - Extended enriched input type.
   * @template NextMeta - Extended metadata type.
   * @param config - Extension options (context creator, input enricher, additional middlewares/plugins).
   * @returns A new procedure instance combining previous and newly added configurations.
   *
   * @example
   * ```ts
   * const protectedProcedure = baseProcedure.extend({
   *   createContext: async (ctx, req) => {
   *     const session = await getSession(req);
   *     return { ok: true, ctx: { session } };
   *   },
   * });
   * ```
   */
  extend: <NextCtx = Ctx, NextEnrich = TEnrich, NextMeta = unknown>(
    config: Omit<
      Partial<
        ProcedureProps<Ctx, TEnrich, GIM, NextMeta, MergeMeta<TMeta, NextMeta>>
      >,
      "createContext" | "enrichInput"
    > &
      ProcedureExtensionConfig<
        Ctx,
        TEnrich,
        NextCtx,
        NextEnrich,
        TMeta,
        NextMeta
      >,
  ) => ProcedureInstance<
    NextCtx,
    NextEnrich,
    MergeMeta<TMeta, NextMeta>,
    I,
    ICtx,
    GIM,
    TName,
    TMocked
  >;

  // Context
  /**
   * Returns the current RPC context from `AsyncLocalStorage`.
   *
   * This is a zero-argument, fully-typed alternative to `getContext<T>()`.
   * The context type is inferred directly from this procedure's definition —
   * no generics needed at the call site.
   *
   * Must be called from within the synchronous or async call stack of a
   * procedure handler — throws otherwise.
   *
   * @example
   * ```ts
   * // services/customer.ts
   * import { procedure } from "../rpc";
   *
   * export async function getAllCustomers() {
   *   const ctx = procedure.context; // fully typed!
   *   return db.customer.findMany({ where: { companyId: ctx.company.id } });
   * }
   * ```
   */
  readonly context: MergeMeta<Ctx, BaseContext<TMeta, TName>>;
}

export type ProcedureExtensionConfig<
  TCtx,
  TEnrich,
  TNextCtx,
  TNextEnrich,
  TMeta extends Record<string, any> = {},
  TNextMeta = unknown,
> = {
  createContext?: (
    ctx: MergeMeta<TCtx, PlusMeta<MergeMeta<TMeta, TNextMeta>>>,
    req: Request,
    context: any,
  ) => MaybePromise<ContextResult<TNextCtx>>;
  enrichInput?: (
    options: {
      previous: TEnrich;
      ctx: MergeMeta<
        Prettify<TCtx & TNextCtx>,
        PlusMeta<MergeMeta<TMeta, TNextMeta>>
      >;
    },
    req: Request,
    context: any,
  ) => MaybePromise<TNextEnrich>;
};

/**
 * Configuration options passed to `createProcedure()` to initialize a base RPC procedure builder.
 *
 * Defines context creation factories, input enrichment, error/success lifecycle hooks,
 * default middlewares, plugins, cache adapters, and response compression.
 *
 * @template TCtx - The base context object constructed by `createContext`.
 * @template TEnrich - The enriched input data injected into procedures via `enrichInput`.
 * @template GIM - The default global input mode (`strict`, `form`, `patch`, etc.).
 * @template TMeta - Custom metadata attached to all procedures created by this builder.
 * @template TTotalMeta - Total accumulated metadata across nested extensions.
 */
export type ProcedureProps<
  TCtx,
  TEnrich,
  GIM extends InputMode = InputMode,
  TMeta = unknown,
  TTotalMeta = TMeta,
> = {
  /**
   * Factory function invoked on each incoming request to construct the base context (`TCtx`).
   *
   * Can inspect request headers, cookies, query parameters, or execution environment
   * (e.g. auth tokens, database connections, tenant IDs).
   *
   * @param prevCtx - Any initial or parent context passed from the runtime adapter.
   * @param req - The standard incoming Web `Request` object.
   * @param context - Platform-specific runtime context (e.g. Next.js route params, Cloudflare execution context).
   * @returns A context result object `{ ok: true, ctx }` or error result `{ ok: false, error }`, synchronously or as a Promise.
   *
   * @example
   * ```ts
   * createContext: async (prevCtx, req) => {
   *   const authHeader = req.headers.get("authorization");
   *   const user = await verifyAuth(authHeader);
   *   return { ok: true, ctx: { user, db } };
   * }
   * ```
   */
  createContext: (
    prevCtx: unknown,
    req: Request,
    context: any,
  ) => MaybePromise<ContextResult<TCtx>>;

  /**
   * Optional error handler invoked when `createContext` fails or rejects with an error result.
   *
   * Allows transforming context creation failures into custom client-facing error responses
   * or issuing HTTP redirection instructions.
   *
   * @param options - Object containing the failure reason and any partial context created so far.
   * @param req - The standard incoming Web `Request` object.
   * @param context - Platform-specific runtime context.
   * @returns A partial error response payload and/or a `_redirect` callback.
   *
   * @example
   * ```ts
   * onContextError: ({ reason }) => {
   *   return {
   *     message: "Authentication failed",
   *     code: 401,
   *   };
   * }
   * ```
   */
  onContextError?: (
    options: {
      reason: FailureReason;
      ctx: MergeMeta<TCtx, PlusMeta<TTotalMeta>>;
    },
    req: Request,
    context: any,
  ) => MaybePromise<
    Prettify<Partial<ErrorResponse> & { _redirect?: () => void }>
  >;

  /**
   * Optional hook to automatically inject or derive fields into procedure inputs using the resolved context.
   *
   * Runs before input schema validation and handler execution, allowing seamless injection of
   * user IDs, tenant IDs, or request-scoped secrets into the procedure's input object.
   *
   * @param ctx - The resolved context combined with procedure metadata.
   * @param req - The incoming Web `Request` object.
   * @param context - Platform-specific runtime context.
   * @returns The enriched input object to merge with user-supplied input data.
   *
   * @example
   * ```ts
   * enrichInput: (ctx) => ({
   *   userId: ctx.user.id,
   *   organizationId: ctx.organization.id,
   * })
   * ```
   */
  enrichInput?: (
    ctx: MergeMeta<TCtx, PlusMeta<TTotalMeta>>,
    req: Request,
    context: any,
  ) => MaybePromise<TEnrich>;

  /**
   * Global error lifecycle hook invoked whenever a procedure throws an unhandled exception
   * or returns a failure error tuple.
   *
   * Useful for centralized error logging, reporting to error tracking services (e.g. Sentry),
   * or modifying client error response payloads.
   *
   * @param props - Information about the error, procedure context, raw input, and positional arguments.
   * @param req - The incoming Web `Request` object.
   * @param context - Platform-specific runtime context.
   * @returns An optional partial error response to override the default error payload, or `void`.
   *
   * @example
   * ```ts
   * onError: ({ error, ctx, input }) => {
   *   logger.error("RPC Error:", error, { ctx, input });
   * }
   * ```
   */
  onError?: (
    props: {
      error: any;
      ctx: MergeMeta<TCtx, BaseContext<TTotalMeta>>;
      input: unknown;
      args: any[];
    },
    req: Request,
    context: any,
  ) => MaybePromise<Partial<ErrorResponse> | void>;

  /**
   * Global success lifecycle hook invoked after a procedure successfully completes.
   *
   * Useful for audit trails, analytics, performance monitoring, and cache warming.
   *
   * @param props - Execution details including context, validated input, returned output, duration (in ms), and positional arguments.
   * @param req - The incoming Web `Request` object.
   * @param context - Platform-specific runtime context.
   * @returns A Promise or void.
   *
   * @example
   * ```ts
   * onSuccess: ({ duration, ctx, input }) => {
   *   metrics.timing("rpc.procedure.duration", duration);
   * }
   * ```
   */
  onSuccess?: (
    props: {
      ctx: MergeMeta<TCtx, BaseContext<TTotalMeta>>;
      input: any;
      output: any;
      duration: number;
      args: any[];
    },
    req: Request,
    context: any,
  ) => MaybePromise<void>;

  /**
   * Array of default middlewares applied to every procedure created from this builder.
   *
   * Executed sequentially in array order before any procedure-specific middlewares.
   */
  middlewares?: Middleware<TCtx, NoInfer<TEnrich>, any, any, TTotalMeta>[];

  /**
   * Array of default plugins applied to every procedure created from this builder.
   */
  plugins?: Plugin<TCtx, NoInfer<TEnrich>, any, any, TTotalMeta>[];

  /**
   * Global default input mode (`strict`, `form`, `patch`, `partial`) applied to all procedures,
   * unless overridden individually at the `.input()` call site.
   */
  inputMode?: GIM;

  /**
   * Default cache adapter instance (e.g. `MemoryCache`, `RedisCache`, or a custom adapter)
   * used across all procedures that enable caching via `.cache()`.
   */
  cache?: CacheAdapter;

  /**
   * Default compressor instance used to compress HTTP responses for procedures enabling `.compress()`.
   */
  compression?: Compressor;

  /**
   * Base metadata object attached to all procedures spawned from this builder.
   */
  meta?: TMeta;

  /**
   * A hint to be included in validation error messages when input schema validation fails.
   *
   * @default "Invalid data provided"
   */
  validationHint?: string;
};

/**
 * Infers the context type from a procedure instance.
 * Works exactly like Zod's `z.infer`.
 *
 * @example
 * type MyContext = InferContext<typeof myProcedure>;
 */
export type InferContext<T> =
  T extends ProcedureInstance<
    infer Ctx,
    infer TEnrich,
    infer Meta,
    infer I,
    any,
    any,
    infer Name,
    any
  >
    ? Prettify<
        MergeMeta<Ctx, BaseContext<Meta, Name>> &
          ExtraCtx<
            MergeMeta<Ctx, BaseContext<Meta, Name>>,
            [I] extends [void] ? TEnrich : Prettify<I & TEnrich>
          >
      >
    : unknown;
/**
 * Infers the final merged input type from a procedure instance.
 * (Includes both Zod input and enriched context fields)
 *
 * @example
 * type MyInput = InferInput<typeof myProcedure>;
 */
export type InferInput<T> =
  T extends ProcedureInstance<
    any,
    infer TEnrich,
    any,
    infer I,
    any,
    any,
    any,
    any
  >
    ? [I] extends [void]
      ? TEnrich
      : Prettify<I & TEnrich>
    : unknown;

/**
 * Infers the resolved return data type from a finalized procedure.
 * Extracts the `TOutput` from the internal `ProcedureDefinition` shape,
 * stripping away the tuple wrapper and error types.
 *
 * @example
 * ```ts
 * const getActiveChats = procedure.query(async () => {
 *   return { data: [...], hasMore: false };
 * });
 *
 * type ActiveChats = InferOutput<typeof getActiveChats>;
 * //   ^? { data: [...], hasMore: boolean }
 * ```
 */
export type InferOutput<T> = T extends (...args: any[]) => Promise<any>
  ? Extract<Awaited<ReturnType<T>>, [any, null]>[0]
  : T extends (...args: any[]) => AsyncIterable<SSEEvent<infer O, any>>
    ? O
    : T extends (...args: any[]) => AsyncIterable<infer O>
      ? O
      : T extends { _def: { output: infer O } }
        ? O
        : never;
