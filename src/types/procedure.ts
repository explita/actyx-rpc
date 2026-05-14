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
  SSEEvent,
} from "./misc.js";

export type ProcedureConfig<
  TCtx,
  TEnrich,
  TMeta extends Record<string, any> = {},
> = {
  name: string;
  type?: "mutation" | "query" | "stream" | "sse" | "ws" | "subscription";
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
  authorize?: (
    ctx: MergeMeta<TCtx, BaseContext<TMeta>>,
  ) => MaybePromise<boolean | Partial<ErrorResponse>>;
  mock?: (opts: {
    ctx: MergeMeta<TCtx, BaseContext<TMeta>>;
    input: TEnrich;
  }) => unknown;
  summary?: string;
  description?: string;
  outputResolver?: SchemaResolver<any>;
};

export type ProcedureInstance<
  Ctx,
  TEnrich,
  TMeta extends Record<string, any>,
  I = void,
  ICtx extends InputCtx = InputCtx,
  GIM extends InputMode = InputMode, //Global Input Mode
  TName extends string = string,
  TMocked extends boolean = false,
> = {
  name: <const Name extends string>(
    name: Name,
  ) => Omit<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, Name, TMocked>,
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
      TName,
      TMocked
    >,
    "extend" | "meta"
  >;
  circuitBreaker: (
    options?: CircuitBreakerOptions,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    | "query"
    | "mutation"
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
  telemetry: () => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    | "query"
    | "mutation"
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
      TName,
      TMocked
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
        TName,
        TMocked
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
    ProcedureInstance<Ctx, TEnrich, TMeta, T, NextICtx, GIM, TName, TMocked>,
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
      [TMocked] extends [true]
      ? (
          input?: InputParams<I, ICtx, GIM>,
          ...args: P
        ) => Promise<MutationResult<Awaited<T>>>
      : (
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
      [TMocked] extends [true]
      ? (
          input?: InputParams<I, ICtx, GIM>,
          ...args: P
        ) => Promise<QueryResult<Awaited<T>>>
      : (
          input: InputParams<I, ICtx, GIM>,
          ...args: P
        ) => Promise<QueryResult<Awaited<T>>>;

  stream: <T, P extends unknown[]>(
    handler: (
      opts: {
        ctx: MergeMeta<Ctx, BaseContext<TMeta, TName>>;
        input: [I] extends [void] ? TEnrich : Prettify<I & TEnrich>;
      },
      ...args: P
    ) => AsyncIterable<T>,
  ) => [I] extends [void]
    ? (...args: P) => AsyncIterable<T>
    : [TMocked] extends [true]
      ? (input?: InputParams<I, ICtx, GIM>, ...args: P) => AsyncIterable<T>
      : (input: InputParams<I, ICtx, GIM>, ...args: P) => AsyncIterable<T>;

  sse: <O = any, P extends unknown[] = []>(
    handler: (
      opts: {
        ctx: MergeMeta<Ctx, BaseContext<TMeta, TName>>;
        input: [I] extends [void] ? TEnrich : Prettify<I & TEnrich>;
      },
      ...args: P
    ) => AsyncIterable<SSEEvent<O>>,
  ) => [I] extends [void]
    ? // No input - just pass through args
      (...args: P) => AsyncIterable<SSEEvent<O>> & { close: () => void }
    : // Has input - first arg is input, then optional args
      [TMocked] extends [true]
      ? (
          input?: InputParams<I, ICtx, GIM>,
          ...args: P
        ) => AsyncIterable<SSEEvent<O>> & { close: () => void }
      : (
          input: InputParams<I, ICtx, GIM>,
          ...args: P
        ) => AsyncIterable<SSEEvent<O>> & { close: () => void };

  // subscription: <T, P extends unknown[] = []>(
  //   handler: (
  //     opts: {
  //       ctx: MergeMeta<Ctx, BaseContext<TMeta, TName>>;
  //       input: [I] extends [void] ? TEnrich : Prettify<I & TEnrich>;
  //       emit: SubscriptionEmit<T>;
  //     },
  //     ...args: P
  //   ) => SubscriptionResult<T>,
  // ) => [I] extends [void]
  //   ? (...args: P) => (wsContext: any) => Promise<void>
  //   : [TMocked] extends [true]
  //     ? (
  //         input?: InputParams<I, ICtx, GIM>,
  //         ...args: P
  //       ) => (wsContext: any) => Promise<void>
  //     : (
  //         input: InputParams<I, ICtx, GIM>,
  //         ...args: P
  //       ) => (wsContext: any) => Promise<void>;

  // ws: <In = any, Out = any, P extends unknown[] = []>(
  //   handler: (
  //     opts: {
  //       ctx: MergeMeta<Ctx, BaseContext<TMeta, TName>>;
  //       input: [I] extends [void] ? TEnrich : Prettify<I & TEnrich>;
  //       send: (data: Out) => void;
  //       onMessage: (cb: (data: In) => void) => void;
  //       onClose: (cb: () => void) => void;
  //       onError: (cb: (err: any) => void) => void;
  //     },
  //     ...args: P
  //   ) => MaybePromise<void>,
  // ) => [I] extends [void]
  //   ? (...args: P) => (wsContext: any) => Promise<void>
  //   : [TMocked] extends [true]
  //     ? (
  //         input?: InputParams<I, ICtx, GIM>,
  //         ...args: P
  //       ) => (wsContext: any) => Promise<void>
  //     : (
  //         input: InputParams<I, ICtx, GIM>,
  //         ...args: P
  //       ) => (wsContext: any) => Promise<void>;

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

  cache: (
    options?: WithCacheOptions<
      Prettify<MergeMeta<Ctx, BaseContext<TMeta, TName>>>,
      [I] extends [void] ? TEnrich : Prettify<TEnrich & I>
    >,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    | "query"
    | "mutation"
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

  invalidate: (
    options: CacheInvalidationOptions<
      Prettify<MergeMeta<Ctx, BaseContext<TMeta, TName>>>,
      [I] extends [void] ? TEnrich : Prettify<TEnrich & I>
    >,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    "mutation"
  >;

  retry: (
    options?: RetryOptions,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    | "query"
    | "mutation"
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

  timeout: (
    options?: TimeoutOptions,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    | "query"
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

  compress: (
    options?: CompressionOptions,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    | "query"
    | "mutation"
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

  rateLimit: (
    options?: RateLimitOptions<Ctx, TMeta, TName>,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    | "query"
    | "mutation"
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

  authorize: (
    checker: (
      ctx: MergeMeta<Ctx, BaseContext<TMeta, TName>>,
    ) => MaybePromise<boolean | Partial<ErrorResponse>>,
  ) => Omit<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    "input" | "extend" | "middleware" | "plugin" | "name" | "meta" | "authorize"
  >;

  mock: <T = unknown>(
    handler: (opts: {
      ctx: MergeMeta<Ctx, BaseContext<TMeta, TName>>;
      input: [I] extends [void] ? TEnrich : Prettify<I & TEnrich>;
    }) => MaybePromise<T>,
  ) => Omit<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, true>,
    "input" | "extend" | "middleware" | "plugin" | "name" | "meta" | "mock"
  >;

  summary: (
    text: string,
  ) => Omit<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    "summary"
  >;
  description: (
    text: string,
  ) => Omit<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    "description" | "summary"
  >;
  output: (
    resolver: SchemaResolver<any>,
  ) => Omit<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    "output" | "description" | "summary"
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
  }) => MaybePromise<
    Prettify<Partial<ErrorResponse> & { _redirect?: () => void }>
  >;
  enrichInput?: (
    ctx: MergeMeta<TCtx, PlusMeta<TTotalMeta>>,
  ) => MaybePromise<TEnrich>;
  onError?: (props: {
    error: any;
    ctx: MergeMeta<TCtx, BaseContext<TTotalMeta>>;
    input: unknown;
    args: any[];
  }) => MaybePromise<Partial<ErrorResponse> | void>;
  onSuccess?: (props: {
    ctx: MergeMeta<TCtx, BaseContext<TTotalMeta>>;
    input: any;
    output: any;
    duration: number;
    args: any[];
  }) => MaybePromise<void>;
  middlewares?: Middleware<TCtx, TEnrich, any, any, TTotalMeta>[];
  plugins?: Plugin<TCtx, TEnrich, any, any, TTotalMeta>[];
  inputMode?: GIM;
  cache?: CacheAdapter;
  compression?: Compressor;
  meta?: TMeta;
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
    any,
    infer Meta,
    any,
    any,
    any,
    infer Name,
    any
  >
    ? MergeMeta<Ctx, BaseContext<Meta, Name>>
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
