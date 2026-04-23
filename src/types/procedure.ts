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
import type { Compressor } from "../core/compression/compressor.js";
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
  FailureReason,
  InputCtx,
  InputMode,
  InputParams,
  MutationResult,
  Prettify,
  QueryResult,
  SchemaResolver,
} from "./misc.js";

export type ProcedureConfig<TCtx, TEnrich> = {
  name?: string;
  resolver?: SchemaResolver<any>;
  middlewares?: Middleware<TCtx, TEnrich, any, any>[];
  plugins?: Plugin<TCtx, TEnrich, any, any>[];
  cache?: CacheConfig;
  invalidate?: CacheInvalidationConfig;
  retry?: RetryConfig;
  timeout?: TimeoutConfig;
  circuitBreaker?: CircuitBreakerConfig & { state?: any };
  compression?: CompressorConfig;
  rateLimit?: RateLimitConfig;
  telemetry?: boolean;
};

export type ProcedureInstance<
  Ctx,
  TEnrich,
  I = void,
  ICtx extends InputCtx = InputCtx,
  GIM extends InputMode = InputMode, //Global Input Mode
> = {
  /**
   * Set the procedure name for debugging and error tracking
   * @param name The procedure name
   */
  name: (
    name: string,
  ) => Omit<ProcedureInstance<Ctx, TEnrich, I, ICtx, GIM>, "extend" | "name">;
  /**
   * Adds a circuit breaker to the procedure.
   * @param options Circuit breaker configuration
   */
  circuitBreaker: (
    options?: CircuitBreakerOptions,
  ) => Omit<ProcedureInstance<Ctx, TEnrich, I, ICtx, GIM>, "circuitBreaker">;
  /**
   * Enables instrumentation/telemetry for the procedure.
   */
  telemetry: () => Omit<
    ProcedureInstance<Ctx, TEnrich, I, ICtx, GIM>,
    "telemetry"
  >;
  /**
   * Adds a middleware to the procedure.
   * @param mw The middleware function.
   * @returns The procedure instance.
   */
  use: (<NextCtx = Ctx>(
    mw: Middleware<Ctx, TEnrich, I extends undefined ? TEnrich : I, NextCtx>,
  ) => Omit<
    ProcedureInstance<Prettify<Ctx & NextCtx>, TEnrich, I, ICtx, GIM>,
    "input" | "extend" | "middleware" | "plugin"
  >) &
    (<NextCtx = Ctx>(
      plugin: Plugin<Ctx, TEnrich, I extends undefined ? TEnrich : I, NextCtx>,
    ) => Omit<
      ProcedureInstance<Prettify<Ctx & NextCtx>, TEnrich, I, ICtx, GIM>,
      "input" | "extend" | "middleware" | "plugin"
    >);

  /**
   * A middleware wrapper for creating type-safe middlewares.
   * @param mw The middleware function.
   * @returns The middleware function.
   */
  middleware: <NextCtx = Ctx>(
    mw: Middleware<Ctx, TEnrich, I extends undefined ? TEnrich : I, NextCtx>,
  ) => typeof mw;

  /**
   * A plugin wrapper for creating type-safe plugins.
   * @param plugin The plugin function.
   * @returns The plugin function.
   */
  plugin: <NextCtx = Ctx>(
    plugin: Plugin<Ctx, TEnrich, I extends undefined ? TEnrich : I, NextCtx>,
  ) => typeof plugin;

  /**
   * Adds an input resolver to the procedure.
   * @param resolver A schema resolver created via `resolver()`.
   * @param options Optional type-level input configuration for the caller API.
   * @returns The procedure instance with the inferred input type.
   */
  input: <T, NextICtx extends InputCtx>(
    resolver: SchemaResolver<T>,
    options?: NextICtx,
  ) => Omit<
    ProcedureInstance<Ctx, TEnrich, T, NextICtx, GIM>,
    "input" | "extend" | "middleware" | "plugin"
  >;

  /**
   * Creates a mutation procedure.
   * @param handler The handler function.
   * @returns The mutation procedure.
   */
  mutation: <T, P extends unknown[]>(
    handler: (
      opts: {
        ctx: Prettify<Ctx & BaseContext>;
        input: [I] extends [void] ? TEnrich : Prettify<I & TEnrich>;
      },
      ...args: P
    ) => T,
  ) => (
    data: InputParams<I, ICtx, GIM>,
    ...args: P
  ) => Promise<MutationResult<Awaited<T>>>;

  /**
   * Creates a query procedure.
   * @param handler The handler function.
   * @returns The query procedure.
   */
  query: <T, P extends unknown[]>(
    handler: (
      opts: {
        ctx: Prettify<Ctx & BaseContext>;
        input: [I] extends [void] ? TEnrich : Prettify<I & TEnrich>;
      },
      ...args: P
    ) => T,
  ) => (
    input: InputParams<I, ICtx, GIM>,
    ...args: P
  ) => Promise<QueryResult<Awaited<T>>>;

  /**
   * Extends the procedure with additional configuration.
   * @param config The configuration to extend the procedure with.
   * @returns The extended procedure instance.
   */
  extend: <NextCtx = Ctx, NextEnrich = TEnrich>(
    config: Omit<
      Partial<ProcedureProps<Ctx, TEnrich, any>>,
      "createContext" | "enrichInput"
    > &
      ProcedureExtensionConfig<Ctx, TEnrich, NextCtx, NextEnrich>,
  ) => ProcedureInstance<NextCtx, NextEnrich, I, ICtx, GIM>;
  /**
   * Adds caching to the procedure.
   * It uses MemoryCache by default.
   * @param options Cache configuration
   * @returns The procedure instance with caching enabled
   */
  cache: <TInput = I>(
    options?: WithCacheOptions<Prettify<Ctx & TEnrich>, TInput>,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, I, ICtx, GIM>,
    "query" | "mutation" | "retry" | "timeout" | "rateLimit"
  >;
  /**
   * Invalidate cache after mutation
   * @param options Cache keys/patterns to invalidate
   */
  invalidate: (
    options: CacheInvalidationOptions<Ctx, I>,
  ) => Pick<ProcedureInstance<Ctx, TEnrich, I, ICtx, GIM>, "mutation">;
  /**
   * Adds retry logic with backoff to the procedure.
   * @param options Retry configuration
   * @returns The procedure instance with retry enabled
   */
  retry: (
    options?: RetryOptions,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, I, ICtx, GIM>,
    "query" | "cache" | "timeout" | "rateLimit"
  >;
  /**
   * Adds a timeout to the procedure.
   * @param options Timeout configuration
   * @returns The procedure instance with timeout enabled
   */
  timeout: (
    options?: TimeoutOptions,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, I, ICtx, GIM>,
    "query" | "mutation" | "retry" | "cache" | "rateLimit"
  >;
  /**
   * Enable request/response compression
   * @param options Compression configuration
   */
  compress: (
    options?: CompressionOptions,
  ) => Omit<
    ProcedureInstance<Ctx, TEnrich, I, ICtx, GIM>,
    "compress" | "extend" | "middleware" | "plugin" | "input"
  >;
  /**
   * Add rate limiting to the procedure
   * @param options Rate limit configuration
   */
  rateLimit: (
    options?: RateLimitOptions<Ctx>,
  ) => Omit<
    ProcedureInstance<Ctx, TEnrich, I, ICtx, GIM>,
    "rateLimit" | "input" | "middleware" | "plugin" | "extend"
  >;
};

type ProcedureExtensionConfig<TCtx, TEnrich, TNextCtx, TNextEnrich> = {
  createContext?: (
    ctx: TCtx,
  ) => Promise<ContextResult<TNextCtx>> | ContextResult<TNextCtx>;
  enrichInput?: (options: {
    previous: TEnrich;
    ctx: TNextCtx;
  }) => Promise<TNextEnrich> | TNextEnrich;
};

export type ProcedureProps<TCtx, TEnrich, GIM extends InputMode> = {
  /**
   * Middlewares to be executed before the procedure.
   */
  middlewares?: Middleware<TCtx, TEnrich, any, any>[];
  /**
   * Plugins to be executed before the procedure.
   */
  plugins?: Plugin<TCtx, TEnrich, any, any>[];
  /**
   * Creates the context for the procedure.
   *
   * If the function returns an object with ok:false, the procedure will not be executed.
   *
   * @returns The context for the procedure.
   */
  createContext: (
    ctx?: unknown,
  ) => Promise<ContextResult<TCtx>> | ContextResult<TCtx>;
  /**
   * Callback function to be executed when the context creation fails.
   * @param reason The reason for the context creation failure.
   */
  onContextError?: (
    reason: FailureReason,
  ) => Promise<Partial<ErrorResponse> | void> | Partial<ErrorResponse> | void;
  /**
   * Enriches the input for the procedure.
   *
   * Whatever is returned here will be added to the input of the procedure.
   *
   * @param ctx The context for the procedure.
   * @returns The enriched input for the procedure.
   */
  enrichInput?: (ctx: TCtx) => Promise<TEnrich> | TEnrich;
  /**
   * Callback function to be executed when the procedure is successful.
   * @param params The parameters for the procedure.
   */
  onSuccess?: <T = unknown, I = {}>(params: {
    ctx: Prettify<TCtx & TEnrich & BaseContext>;
    input: Prettify<I & TEnrich>;
    output: T;
    duration: number;
  }) => void | Promise<void>;
  /**
   * Global onError hook.
   * @param error The error.
   * @param capture The capture.
   */
  onError?: (params: {
    error: unknown;
    ctx: Prettify<TCtx & BaseContext>;
    input: unknown;
    args: any;
  }) => Promise<Partial<ErrorResponse> | void> | Partial<ErrorResponse> | void;

  /**
   * Global cache instance for the procedure.
   * Can be MemoryCache, RedisCache, or any custom implementation of CacheAdapter.
   */
  cache?: CacheAdapter;
  /**
   * Global compression instance for the procedure.
   * Can be MemoryCache, RedisCache, or any custom implementation of CacheAdapter.
   */
  compression?: Compressor;
  /**
   * The input mode for the procedure.
   *
   * [strict] Uses the exact inferred schema shape at the call site.
   *
   * [form] Uses a loose object shape where every declared key is `unknown`.
   *
   * [partial] Uses a partial object shape for patch-style callers.
   *
   * @default "strict"
   */
  inputMode: GIM;
};
