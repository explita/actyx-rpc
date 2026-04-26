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
} from "./misc.js";

export type ProcedureConfig<
  TCtx,
  TEnrich,
  TMeta extends Record<string, any> = {},
> = {
  name?: string;
  resolver?: SchemaResolver<any>;
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
};

export type ProcedureInstance<
  Ctx,
  TEnrich,
  TMeta extends Record<string, any>,
  I = void,
  ICtx extends InputCtx = InputCtx,
  GIM extends InputMode = InputMode, //Global Input Mode
  TName extends string = string,
> = {
  name: <const Name extends string>(
    name: Name,
  ) => Omit<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, Name>,
    "extend" | "name"
  >;
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
      TName
    >,
    "extend" | "meta"
  >;
  circuitBreaker: (
    options?: CircuitBreakerOptions,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName>,
    | "query"
    | "mutation"
    | "cache"
    | "invalidate"
    | "retry"
    | "timeout"
    | "compress"
    | "rateLimit"
    | "telemetry"
  >;
  telemetry: () => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName>,
    | "query"
    | "mutation"
    | "cache"
    | "invalidate"
    | "retry"
    | "timeout"
    | "compress"
    | "rateLimit"
    | "circuitBreaker"
  >;
  use: (<NextCtx = Ctx>(
    mw: Middleware<
      Ctx,
      TEnrich,
      [I] extends [void] ? TEnrich : Prettify<I & TEnrich>,
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
      TName
    >,
    "input" | "extend" | "middleware" | "plugin" | "name" | "meta"
  >) &
    (<NextCtx = Ctx>(
      plugin: Plugin<
        Ctx,
        TEnrich,
        [I] extends [void] ? TEnrich : Prettify<I & TEnrich>,
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
        TName
      >,
      "input" | "extend" | "middleware" | "plugin" | "name" | "meta"
    >);

  middleware: <ExpectedInput = unknown, NextCtx = Ctx>(
    mw: Middleware<
      Ctx,
      TEnrich,
      [I] extends [void]
        ? Prettify<ExpectedInput & TEnrich>
        : Prettify<I & TEnrich>,
      Prettify<NextCtx>,
      TMeta,
      TName
    >,
  ) => typeof mw;

  plugin: <ExpectedInput = unknown, NextCtx = Ctx>(
    plugin: Plugin<
      Ctx,
      TEnrich,
      [I] extends [void]
        ? Prettify<ExpectedInput & TEnrich>
        : Prettify<I & TEnrich>,
      NextCtx,
      TMeta,
      TName
    >,
  ) => typeof plugin;

  input: <T, NextICtx extends InputCtx>(
    resolver: SchemaResolver<T>,
    options?: NextICtx,
  ) => Omit<
    ProcedureInstance<Ctx, TEnrich, TMeta, T, NextICtx, GIM, TName>,
    "input" | "extend" | "middleware" | "plugin" | "name" | "meta"
  >;

  mutation: <T, P extends unknown[]>(
    handler: (
      opts: {
        ctx: MergeMeta<Ctx, BaseContext<TMeta, TName>>;
        input: [I] extends [void] ? TEnrich : Prettify<I & TEnrich>;
      },
      ...args: P
    ) => T,
  ) => [I] extends [void]
    ? // No input - just pass through args
      (...args: P) => Promise<MutationResult<Awaited<T>>>
    : // Has input - first arg is input, then optional args
      (
        input: InputParams<I, ICtx, GIM>,
        ...args: P
      ) => Promise<MutationResult<Awaited<T>>>;

  query: <T, P extends unknown[]>(
    handler: (
      opts: {
        ctx: MergeMeta<Ctx, BaseContext<TMeta, TName>>;
        input: [I] extends [void] ? TEnrich : Prettify<I & TEnrich>;
      },
      ...args: P
    ) => T,
  ) => [I] extends [void]
    ? // No input - just pass through args
      (...args: P) => Promise<QueryResult<Awaited<T>>>
    : // Has input - first arg is input, then optional args
      (
        input: InputParams<I, ICtx, GIM>,
        ...args: P
      ) => Promise<QueryResult<Awaited<T>>>;

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
    TName
  >;

  cache: (
    options?: WithCacheOptions<
      Prettify<MergeMeta<Ctx, BaseContext<TMeta, TName>>>,
      [I] extends [void] ? TEnrich : Prettify<TEnrich & I>
    >,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName>,
    | "query"
    | "mutation"
    | "invalidate"
    | "retry"
    | "timeout"
    | "compress"
    | "rateLimit"
    | "circuitBreaker"
    | "telemetry"
  >;

  invalidate: (
    options: CacheInvalidationOptions<
      Prettify<MergeMeta<Ctx, BaseContext<TMeta, TName>>>,
      [I] extends [void] ? TEnrich : Prettify<TEnrich & I>
    >,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName>,
    "mutation"
  >;

  retry: (
    options?: RetryOptions,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName>,
    | "query"
    | "mutation"
    | "cache"
    | "invalidate"
    | "timeout"
    | "compress"
    | "rateLimit"
    | "circuitBreaker"
    | "telemetry"
  >;

  timeout: (
    options?: TimeoutOptions,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName>,
    | "query"
    | "mutation"
    | "cache"
    | "invalidate"
    | "retry"
    | "compress"
    | "rateLimit"
    | "circuitBreaker"
    | "telemetry"
  >;

  compress: (
    options?: CompressionOptions,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName>,
    | "query"
    | "mutation"
    | "cache"
    | "invalidate"
    | "retry"
    | "timeout"
    | "rateLimit"
    | "circuitBreaker"
    | "telemetry"
  >;

  rateLimit: (
    options?: RateLimitOptions<Ctx, TMeta, TName>,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName>,
    | "query"
    | "mutation"
    | "cache"
    | "invalidate"
    | "retry"
    | "timeout"
    | "compress"
    | "circuitBreaker"
    | "telemetry"
  >;
};

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
  ) => MaybePromise<ContextResult<TNextCtx>>;
  enrichInput?: (options: {
    previous: TEnrich;
    ctx: MergeMeta<
      Prettify<TCtx & TNextCtx>,
      PlusMeta<MergeMeta<TMeta, TNextMeta>>
    >;
  }) => MaybePromise<TNextEnrich>;
};

export type ProcedureProps<
  TCtx,
  TEnrich,
  GIM extends InputMode = InputMode,
  TMeta = unknown,
  TTotalMeta = TMeta,
> = {
  createContext: (prevCtx: unknown) => MaybePromise<ContextResult<TCtx>>;
  onContextError?: (options: {
    reason: FailureReason;
    ctx: MergeMeta<TCtx, PlusMeta<TTotalMeta>>;
  }) => MaybePromise<Partial<ErrorResponse> | void>;
  enrichInput?: (
    ctx: MergeMeta<TCtx, PlusMeta<TTotalMeta>>,
  ) => MaybePromise<TEnrich>;
  onError?: (props: {
    error: any;
    ctx: MergeMeta<TCtx, PlusMeta<TTotalMeta>>;
    input: any;
    args: any[];
  }) => MaybePromise<Partial<ErrorResponse> | void>;
  onSuccess?: (props: {
    ctx: MergeMeta<TCtx, PlusMeta<TTotalMeta>>;
    input: any;
    output: any;
    duration: number;
    args: any[];
  }) => MaybePromise<void>;
  middlewares?: Middleware<any, any, any, any, TTotalMeta>[];
  plugins?: Plugin<any, any, any, any, TTotalMeta>[];
  inputMode?: GIM;
  cache?: CacheAdapter;
  compression?: Compressor;
  meta?: TMeta;
};
